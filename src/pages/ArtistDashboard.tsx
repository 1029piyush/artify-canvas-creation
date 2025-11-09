import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Trash2, Package, MessageSquare } from "lucide-react";
import { z } from "zod";

const artworkSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  price: z.number().min(1, "Price must be greater than 0"),
  category: z.string().optional(),
  stock_quantity: z.number().min(1, "Stock must be at least 1").max(10, "Maximum 10 items allowed"),
});

interface Artwork {
  id: string;
  title: string;
  description: string | null;
  price: number;
  image_url: string;
  category: string | null;
  stock_quantity: number;
}

// This interface is now based on 'order_items'
interface Order {
  id: string;
  quantity: number;
  created_at: string;
  order: { // Nested 'orders' table data
    id: string;
    total_price: number;
    status: string;
  };
  artwork: { // Nested 'artworks' table data
    title: string;
    image_url: string;
  };
}

// This interface is updated for the new, simpler query
interface CustomRequest {
  id: string;
  title: string;
  description: string;
  budget: number | null;
  status: string;
  created_at: string;
  artist_id: string | null;
  buyer: {
    id: string;
    email: string;
    full_name: string | null;
  };
}

const ArtistDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customRequests, setCustomRequests] = useState<CustomRequest[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
    stock_quantity: "1",
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }

    // ---
    // FIX 1: Keeping your correct 'user_type' check
    // ---
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_type') 
      .eq('id', session.user.id)
      .single();

    // Allow 'admin' to see this page as well
    if (profile?.user_type !== 'artist' && profile?.user_type !== 'admin') {
      toast({
        title: "Access Denied",
        description: "Only artists can access this page",
        variant: "destructive",
      });
      navigate('/');
      return;
    }

    setUserId(session.user.id);
    fetchArtworks(session.user.id);
    fetchOrders(session.user.id);
    fetchCustomRequests();
  };

  const fetchArtworks = async (uid: string) => {
    const { data } = await supabase
      .from('artworks')
      .select('*')
      .eq('artist_id', uid)
      .order('created_at', { ascending: false });

    if (data) {
      setArtworks(data);
    }
  };

  // ---
  // FIX 3: Rewrote 'fetchOrders' to work with the new 'order_items' table
  // ---
  const fetchOrders = async (uid: string) => {
    const { data, error } = await supabase
      .from('order_items') // We query 'order_items'
      .select(`
        id,
        quantity,
        created_at,
        order:orders (
          id,
          total_price,
          status
        ),
        artwork:artworks (
          title,
          image_url
        )
      `)
      .eq('artworks.artist_id', uid) // Filter by artist_id on the *joined* artwork
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("Error fetching orders:", error);
    } else if (data) {
      setOrders(data as Order[]);
    }
  };

  // ---
  // FIX 4: Simplified 'fetchCustomRequests' to a single, efficient query
  // ---
  const fetchCustomRequests = async () => {
    const { data, error } = await supabase
      .from('custom_requests')
      .select(`
        id,
        title,
        description,
        budget,
        status,
        created_at,
        artist_id,
        buyer:profiles!buyer_id (
          id,
          email,
          full_name
        )
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("Error fetching requests:", error);
    } else if (data) {
      // Ensure 'buyer' is not null, default to an object
      const safeData = data.map(req => ({
        ...req,
        buyer: req.buyer || { id: 'unknown', email: 'N/A', full_name: 'Unknown' }
      }));
      setCustomRequests(safeData as CustomRequest[]);
    }
  };

  const handleClaimRequest = async (requestId: string) => {
    if (!userId) return; // Added check for safety
    
    const { error } = await supabase
      .from('custom_requests')
      .update({ artist_id: userId, status: 'accepted' })
      .eq('id', requestId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to claim request",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Request claimed successfully",
      });
      fetchCustomRequests();
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!imageFile) {
      toast({
        title: "Error",
        description: "Please select an image",
        variant: "destructive",
      });
      return;
    }

    // ---
    // (CRITICAL) Make sure you have created a PUBLIC bucket named "artworks" in your Supabase project.
    // ---
    if (!userId) return;

    try {
      const validatedData = artworkSchema.parse({
        ...formData,
        price: parseFloat(formData.price),
        stock_quantity: parseInt(formData.stock_quantity),
      });

      setLoading(true);

      // Upload image
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('artworks') // Assumes 'artworks' bucket exists
        .upload(fileName, imageFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('artworks')
        .getPublicUrl(fileName);

      // ---
      // FIX 5: Removed 'is_available' field, which is not in our new database
      // ---
      const { error: insertError } = await supabase
        .from('artworks')
        .insert({
          artist_id: userId,
          title: validatedData.title,
          description: validatedData.description,
          price: validatedData.price,
          category: validatedData.category || null,
          image_url: publicUrl,
          // is_available: true, // This column does not exist
          stock_quantity: validatedData.stock_quantity,
        });

      if (insertError) throw new Error(insertError.message);

      toast({
        title: "Success!",
        description: "Artwork uploaded successfully",
      });

      setFormData({ title: "", description: "", price: "", category: "", stock_quantity: "1" });
      setImageFile(null);
      if (userId) fetchArtworks(userId);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        console.error("Upload error:", error);
        toast({
          title: "Error",
          description: (error as Error).message || "Failed to upload artwork. (Did you create the 'artworks' storage bucket?)",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const deleteArtwork = async (id: string) => {
    const { error } = await supabase
      .from('artworks')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete artwork",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Artwork deleted",
      });
      if (userId) fetchArtworks(userId);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container py-8">
        <h1 className="mb-8 text-3xl font-bold">Artist Dashboard</h1>

        <Tabs defaultValue="upload" className="space-y-6">
          <TabsList>
            <TabsTrigger value="upload">Upload Artwork</TabsTrigger>
            <TabsTrigger value="artworks">My Artworks</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="custom-requests">Custom Requests</TabsTrigger>
          </TabsList>

          <TabsContent value="upload">
            <Card>
              <CardHeader>
                <CardTitle>Upload New Artwork</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="image">Artwork Image</Label>
                    <div className="flex items-center gap-4">
                      <Input
                        id="image"
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        required
                      />
                      {imageFile && (
                        <span className="text-sm text-muted-foreground">
                          {imageFile.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      placeholder="Artwork title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe your artwork..."
                      rows={4}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      required
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="price">Price (₹)</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="stock_quantity">Stock Quantity</Label>
                      <Input
                        id="stock_quantity"
                        type="number"
                        min="1"
                        max="10"
                        placeholder="1"
                        value={formData.stock_quantity}
                        onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category">Category (Optional)</Label>
                      <Input
                        id="category"
                        placeholder="e.g., Abstract, Portrait"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    <Upload className="mr-2 h-4 w-4" />
                    {loading ? "Uploading..." : "Upload Artwork"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="artworks">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {artworks.map((artwork) => (
                <Card key={artwork.id}>
                  <CardContent className="p-0">
                    <img
                      src={artwork.image_url}
                      alt={artwork.title}
                      className="aspect-square w-full object-cover rounded-t-lg"
                    />
                    <div className="p-4 space-y-2">
                      <h3 className="font-semibold">{artwork.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {artwork.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-primary">₹{artwork.price.toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">Stock: {artwork.stock_quantity}</p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        onClick={() => deleteArtwork(artwork.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {artworks.length === 0 && (
                <Card className="col-span-full">
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No artworks uploaded yet</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="orders">
            <div className="space-y-4">
              {orders.map((orderItem) => (
                <Card key={orderItem.id}>
                  <CardContent className="flex gap-4 p-4">
                    <img
                      src={orderItem.artwork.image_url}
                      alt={orderItem.artwork.title}
                      className="h-20 w-20 rounded-lg object-cover"
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold">{orderItem.artwork.title}</h3>
                      {/* --- FIX 6: Accessing nested order data correctly --- */}
                      <p className="text-sm text-muted-foreground">
                        Quantity: {orderItem.quantity} • Total: ₹{orderItem.order.total_price.toFixed(2)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Status: <span className="font-medium capitalize">{orderItem.order.status}</span>
                      </p>
                    </div>
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </CardContent>
                </Card>
              ))}
              {orders.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No orders yet</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="custom-requests">
            <div className="space-y-4">
              {customRequests.map((request) => (
                <Card key={request.id}>
                  <CardContent className="p-6 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <MessageSquare className="h-6 w-6 text-primary mt-1" />
                        <div className="space-y-1">
                          <h3 className="font-semibold text-lg">{request.title}</h3>
                          <p className="text-sm text-muted-foreground">{request.description}</p>
                        </div>
                      </div>
                      <span className="text-xs px-3 py-1 rounded-full bg-secondary capitalize">
                        {request.status}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                      <div>
                        <p className="text-xs text-muted-foreground">Requested by</p>
                        <p className="font-medium">{request.buyer?.full_name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">{request.buyer?.email || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Budget</p>
                        <p className="font-bold text-primary">
                          {request.budget ? `₹${request.budget.toFixed(2)}` : 'Not specified'}
                        </p>
                      </div>
                    </div>
                    
                    <p className="text-xs text-muted-foreground pt-2">
                      Requested on {new Date(request.created_at).toLocaleDateString()}
                    </p>

                    {request.status === 'pending' && !request.artist_id && (
                      <Button 
                        onClick={() => handleClaimRequest(request.id)}
                        className="w-full mt-4"
                      >
                        Accept & Claim Request
                      </Button>
                    )}
                    {request.artist_id === userId && (
                      <div className="mt-4 p-3 bg-primary/10 rounded-lg">
                        <p className="text-sm font-medium text-primary">You claimed this request</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {customRequests.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No custom requests yet</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ArtistDashboard;