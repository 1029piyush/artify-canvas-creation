import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
// HERE ARE THE CHANGES: Added CardFooter and Button
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// END OF CHANGES
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Calendar, DollarSign } from "lucide-react";

interface OrderItem {
  id: string;
  artwork_id: string;
  total_price: number;
  quantity: number;
  status: string;
  created_at: string;
  artworks: {
    title: string;
    image_url: string;
    // HERE IS A CHANGE: We need the stock to restore it
    stock_quantity: number;
  };
  profiles: {
    full_name: string;
  };
  artist_id: string; // Added artist_id here for the main query
}

const Orders = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  // HERE IS A CHANGE: New state to track which order is being cancelled
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndFetchOrders();
  }, []);

  const checkAuthAndFetchOrders = async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      navigate("/auth");
      return;
    }

    await fetchOrders(session.user.id);
  };

  const fetchOrders = async (userId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          id,
          artwork_id,
          artist_id,
          total_price,
          quantity,
          status,
          created_at,
          artworks (
            title,
            image_url,
            stock_quantity
          )
        `
        )
        .eq("buyer_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch artist names separately
      const ordersWithArtists = await Promise.all(
        (data || []).map(async (order) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", order.artist_id)
            .single();

          return {
            ...order,
            profiles: profile || { full_name: "Unknown Artist" },
          };
        })
      );

      setOrders(ordersWithArtists as any);
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast({
        title: "Error",
        description: "Failed to load your orders",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // HERE IS THE NEW FUNCTION TO HANDLE CANCELLATION
  const handleCancelOrder = async (order: OrderItem) => {
    setCancellingId(order.id);
    try {
      // 1. Restore the stock quantity
      const newStock = order.artworks.stock_quantity + order.quantity;
      const { error: stockError } = await supabase
        .from("artworks")
        .update({ stock_quantity: newStock })
        .eq("id", order.artwork_id);

      if (stockError) throw stockError;

      // 2. Update the order status to 'cancelled'
      const { error: orderError } = await supabase
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", order.id);

      if (orderError) throw orderError;

      // 3. Update the UI state locally
      setOrders(
        orders.map((o) =>
          o.id === order.id ? { ...o, status: "cancelled" } : o
        )
      );

      toast({
        title: "Order Cancelled",
        description: "Your order has been successfully cancelled.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cancel order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCancellingId(null);
    }
  };
  // END OF NEW FUNCTION

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30";
      case "completed":
        return "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30";
      case "cancelled":
        return "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30";
      default:
        return "bg-muted";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container py-8 px-4 animate-fade-in">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-[image:var(--gradient-artify)] mb-2">
            My Orders
          </h1>
          <p className="text-muted-foreground">
            View your order history and track your purchases
          </p>
        </div>

        {loading ? (
          <div className="grid gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <Skeleton className="h-24 w-24 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-6 w-1/3" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-1/4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Package className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold mb-2">No orders yet</h3>
              <p className="text-muted-foreground text-center mb-6">
                Start exploring and purchase your first artwork
              </p>
              <button
                onClick={() => navigate("/")}
                className="px-6 py-2 bg-[image:var(--gradient-primary)] text-primary-foreground rounded-lg hover:opacity-90 transition-all duration-300 shadow-[var(--shadow-card)]"
              >
                Browse Artworks
              </button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {orders.map((order) => (
              <Card
                key={order.id}
                className="overflow-hidden hover:shadow-[var(--shadow-hover)] transition-all duration-300 border-border/50"
              >
                <CardHeader className="bg-muted/30 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {new Date(order.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </div>
                    <Badge className={getStatusColor(order.status)}>
                      {order.status.charAt(0).toUpperCase() +
                        order.status.slice(1)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex gap-6">
                    <div className="relative group">
                      <img
                        src={order.artworks.image_url}
                        alt={order.artworks.title}
                        className="h-32 w-32 object-cover rounded-lg border border-border/50 group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>

                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2">
                        {order.artworks.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Artist: {order.profiles?.full_name || "Unknown Artist"}
                      </p>

                      <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span>Quantity: {order.quantity}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold text-lg">
                            ₹{order.total_price.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>

                {/* HERE IS THE NEW CARD FOOTER WITH THE BUTTON */}
                {order.status === "pending" && (
                  <CardFooter className="bg-muted/30 p-4 flex justify-end">
                    <Button
                      variant="destructive"
                      onClick={() => handleCancelOrder(order)}
                      disabled={cancellingId === order.id}
                    >
                      {cancellingId === order.id
                        ? "Cancelling..."
                        : "Cancel Order"}
                    </Button>
                  </CardFooter>
                )}
                {/* END OF NEW SECTION */}
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Orders;