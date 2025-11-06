import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

interface ArtworkCardProps {
  id: string;
  title: string;
  description?: string;
  price: number;
  imageUrl: string;
  artistId: string;
  stockQuantity: number;
  onAddToCart?: () => void;
}

const ArtworkCard = ({ id, title, description, price, imageUrl, artistId, stockQuantity, onAddToCart }: ArtworkCardProps) => {
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      setUserId(session?.user?.id ?? null);
    });
  }, []);

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to add items to cart",
        variant: "destructive",
      });
      return;
    }

    if (userId === artistId) {
      toast({
        title: "Cannot add own artwork",
        description: "You cannot add your own artwork to cart",
        variant: "destructive",
      });
      return;
    }

    if (stockQuantity <= 0) {
      toast({
        title: "Out of stock",
        description: "This artwork is currently unavailable",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from('cart_items')
      .upsert({ 
        user_id: userId!, 
        artwork_id: id,
        quantity: 1
      }, {
        onConflict: 'user_id,artwork_id'
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to add to cart",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Added to cart",
      });
      onAddToCart?.();
    }
  };

  return (
    <Card className="group overflow-hidden transition-all duration-300 hover:shadow-[var(--shadow-hover)]">
      <CardContent className="p-0">
        <div className="aspect-square overflow-hidden bg-muted">
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
          />
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-3 p-4">
        <div className="w-full">
          <h3 className="font-semibold text-lg line-clamp-1">{title}</h3>
          {description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{description}</p>
          )}
          <div className="flex items-center justify-between mt-2">
            <p className="font-bold text-xl text-primary">₹{price.toFixed(2)}</p>
            <p className={`text-sm font-medium ${stockQuantity > 0 ? 'text-muted-foreground' : 'text-destructive'}`}>
              {stockQuantity > 0 ? `${stockQuantity} in stock` : 'Out of Stock'}
            </p>
          </div>
        </div>
        <Button 
          className="w-full" 
          onClick={handleAddToCart}
          disabled={userId === artistId || stockQuantity <= 0}
        >
          <ShoppingCart className="mr-2 h-4 w-4" />
          {stockQuantity <= 0 ? 'Out of Stock' : 'Add to Cart'}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ArtworkCard;