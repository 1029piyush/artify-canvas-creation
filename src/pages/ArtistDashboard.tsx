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
import { Upload, Trash2, Package } from "lucide-react";
import { z } from "zod";

const artworkSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  price: z.number().min(1, "Price must be greater than 0"),
  category: z.string().optional(),
});

interface Artwork {
  id: string;
  title: string;
  description: string | null;
  price: number;
  image_url: string;
  category: string | null;
}

interface Order {
  id: string;
  quantity: number;
  total_price: number;
  status: string;
  created_at: string;
  artwork: {
    title: string;
    image_url: string;
  };
}

const ArtistDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', session.user.id)
      .single();

    if (profile?.user_type !== 'artist') {
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

  const fetchOrders = async (uid: string) => {
    const { data } = await supabase
      .from('orders')
      .select(`
        id,
        quantity,
        total_price,
        status,
        created_at,
        artwork:artworks (
          title,
          image_url
        )
      `)
      .eq('artist_id', uid)
      .order('created_at', { ascending: false });

    if (data) {
      setOrders(data as Order[]);
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

    try {
      const validatedData = artworkSchema.parse({
        ...formData,
        price: parseFloat(formData.price),
      });

      setLoading(true);

      // Upload image
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('artworks')
        .upload(fileName, imageFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('artworks')
        .getPublicUrl(fileName);

      // Create artwork
      const { error: insertError } = await supabase
        .from('artworks')
        .insert({
          artist_id: userId!,
          title: validatedData.title,
          description: validatedData.description,
          price: validatedData.price,
          category: validatedData.category || null,
          image_url: publicUrl,
          is_available: true,
        });

      if (insertError) throw insertError;

      toast({
        title: "Success!",
        description: "Artwork uploaded successfully",
      });

      setFormData({ title: "", description: "", price: "", category: "" });
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
        toast({
          title: "Error",
          description: "Failed to upload artwork",
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

                  <div className="grid gap-4 md:grid-cols-2">
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
                      <p className="font-bold text-primary">₹{artwork.price.toFixed(2)}</p>
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
              {orders.map((order) => (
                <Card key={order.id}>
                  <CardContent className="flex gap-4 p-4">
                    <img
                      src={order.artwork.image_url}
                      alt={order.artwork.title}
                      className="h-20 w-20 rounded-lg object-cover"
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold">{order.artwork.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        Quantity: {order.quantity} • Total: ₹{order.total_price.toFixed(2)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Status: <span className="font-medium capitalize">{order.status}</span>
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
        </Tabs>
      </div>
    </div>
  );
};

export default ArtistDashboard;