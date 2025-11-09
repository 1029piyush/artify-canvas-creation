import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, Package } from "lucide-react";

// 1. Define the types for the data we are fetching
interface SaleItem {
  id: string;
  quantity: number;
  created_at: string;
  order: {
    id: string;
    status: string;
    delivery_addresses: {
      full_name: string;
      phone: string;
      address_line1: string;
      city: string;
    };
  };
  artwork: {
    title: string;
    price: number;
    image_url: string;
  };
}

const ArtistDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sales, setSales] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [artistId, setArtistId] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  // 2. Check auth and get the artist's ID
  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setArtistId(session.user.id);
    fetchSales(session.user.id);
  };

  // 3. The key function to fetch sales for this specific artist
  const fetchSales = async (uid: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("order_items")
      .select(`
        id,
        quantity,
        created_at,
        order:orders (
          id,
          status,
          delivery_addresses (full_name, phone, address_line1, city)
        ),
        artwork:artworks (
          title,
          price,
          image_url
        )
      `)
      // This is the filter: only get items where the artwork's
      // artist_id matches the currently logged-in user's ID.
      .eq("artworks.artist_id", uid)
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch sales history.",
        variant: "destructive",
      });
      console.error(error);
    } else {
      setSales(data as SaleItem[]);
    }
    setLoading(false);
  };

  const totalRevenue = sales.reduce(
    (sum, item) => sum + item.artwork.price * item.quantity,
    0
  );
  const totalItemsSold = sales.reduce((sum, item) => sum + item.quantity, 0);

  // 4. Render the page
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8">
        <h1 className="mb-8 text-3xl font-bold">Artist Dashboard</h1>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Revenue
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₹{totalRevenue.toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Items Sold</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalItemsSold}</div>
            </CardContent>
          </Card>
        </div>

        {/* Sales List */}
        <h2 className="mb-4 text-2xl font-semibold">Sales History</h2>
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : sales.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <h3 className="text-xl font-medium">No sales yet</h3>
              <p className="text-muted-foreground">
                When a buyer purchases your art, it will show up here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sales.map((item) => (
              <Card key={item.id}>
                <CardContent className="flex gap-4 p-4">
                  <img
                    src={item.artwork.image_url}
                    alt={item.artwork.title}
                    className="h-24 w-24 rounded-lg object-cover"
                  />
                  <div className="flex-1 space-y-1">
                    <h3 className="font-semibold">{item.artwork.title}</h3>
                    <p className="text-sm">
                      <span className="font-medium">Quantity:</span>{" "}
                      {item.quantity}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Price per item:</span> ₹
                      {item.artwork.price.toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Order ID: {item.order.id}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Sold on: {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">
                      +₹{(item.artwork.price * item.quantity).toFixed(2)}
                    </p>
                    <p className="text-sm font-medium">Shipping to:</p>
                    <p className="text-sm text-muted-foreground">
                      {item.order.delivery_addresses.full_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {item.order.delivery_addresses.city}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ArtistDashboard;