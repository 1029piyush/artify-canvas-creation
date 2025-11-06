import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import ArtworkCard from "@/components/ArtworkCard";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Palette, Sparkles, Shield } from "lucide-react";
import { Link } from "react-router-dom";

interface Artwork {
  id: string;
  title: string;
  description: string | null;
  price: number;
  image_url: string;
  artist_id: string;
  stock_quantity: number;
}

const Index = () => {
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArtworks();
  }, []);

  const fetchArtworks = async () => {
    const { data, error } = await supabase
      .from('artworks')
      .select('*')
      .eq('is_available', true)
      .order('created_at', { ascending: false })
      .limit(12);

    if (data) {
      setArtworks(data);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 py-20">
        <div className="container relative z-10">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-6 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-5xl font-bold text-transparent md:text-6xl">
              Discover Unique Artworks
            </h1>
            <p className="mb-8 text-xl text-muted-foreground">
              Connect with talented artists and find the perfect piece for your collection
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button asChild size="lg" className="shadow-[var(--shadow-artwork)]">
                <Link to="/auth">Start Exploring</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/custom-art">Request Custom Art</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-muted/30">
        <div className="container">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Palette className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Curated Collection</h3>
              <p className="text-muted-foreground">
                Browse through carefully selected artworks from talented artists
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/10">
                <Sparkles className="h-8 w-8 text-secondary" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Custom Creations</h3>
              <p className="text-muted-foreground">
                Request personalized artwork tailored to your vision
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
                <Shield className="h-8 w-8 text-accent" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Secure Platform</h3>
              <p className="text-muted-foreground">
                Safe and secure transactions for buyers and artists
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Artworks Gallery */}
      <section className="py-16">
        <div className="container">
          <h2 className="mb-8 text-center text-3xl font-bold">Featured Artworks</h2>
          
          {loading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-96 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : artworks.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-xl text-muted-foreground">No artworks available yet</p>
              <p className="mt-2 text-muted-foreground">Check back soon for amazing art!</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {artworks.map((artwork) => (
                <ArtworkCard
                  key={artwork.id}
                  id={artwork.id}
                  title={artwork.title}
                  description={artwork.description}
                  price={artwork.price}
                  imageUrl={artwork.image_url}
                  artistId={artwork.artist_id}
                  stockQuantity={artwork.stock_quantity}
                  onAddToCart={fetchArtworks}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Index;