import { useEffect, useState, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const UploadArtwork = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [artistId, setArtistId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [formState, setFormState] = useState({
    title: "",
    description: "",
    price: "",
    stock_quantity: "1",
    category: "Painting", // Default category
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setArtistId(session.user.id);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !artistId) {
      toast({
        title: "Error",
        description: "Please fill all fields and select an image.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // 1. Upload the image file to Supabase Storage
      const fileExt = file.name.split(".").pop();
      const filePath = `${artistId}/${Date.now()}.${fileExt}`;

      // We are using the "artworks" bucket
      const { error: uploadError } = await supabase.storage
        .from("artworks") 
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get the public URL of the uploaded image
      const { data: urlData } = supabase.storage
        .from("artworks")
        .getPublicUrl(filePath);
      
      const imageUrl = urlData.publicUrl;

      // 3. Insert the artwork details into the "artworks" table
      const { error: insertError } = await supabase.from("artworks").insert({
        artist_id: artistId,
        title: formState.title,
        description: formState.description,
        price: parseFloat(formState.price),
        stock_quantity: parseInt(formState.stock_quantity, 10),
        category: formState.category,
        image_url: imageUrl,
      });

      if (insertError) throw insertError;

      toast({
        title: "Success!",
        description: "Your artwork has been uploaded.",
      });
      navigate("/artist-dashboard");

    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "Could not upload artwork.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Upload New Artwork</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" value={formState.title} onChange={handleChange} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" value={formState.description} onChange={handleChange} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price (₹)</Label>
                  <Input id="price" name="price" type="number" min="0" value={formState.price} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock_quantity">Stock Quantity</Label>
                  <Input id="stock_quantity" name="stock_quantity" type="number" min="0" value={formState.stock_quantity} onChange={handleChange} required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <select id="category" name="category" value={formState.category} onChange={handleChange} className="w-full p-2 border rounded-md">
                  <option value="Painting">Painting</option>
                  <option value="Sculpture">Sculpture</option>
                  <option value="Photography">Photography</option>
                  <option value="Digital Art">Digital Art</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="image">Artwork Image</Label>
                <Input id="image" type="file" onChange={handleFileChange} accept="image/*" required />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Upload Artwork
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UploadArtwork;