import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { ArtworkPreviewModal } from "@/components/ui/artwork-preview-modal";

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
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

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
        description: "This artwork is currently out of stock",
        variant: "destructive",
      });
      return;
    }

    const { data: existingCartItem, error: fetchError } = await supabase
      .from("cart_items")
      .select("quantity")
      .eq("user_id", userId)
      .eq("artwork_id", id)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      toast({
        title: "Error",
        description: "Failed to check cart. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (existingCartItem) {
      if (existingCartItem.quantity >= stockQuantity) {
        toast({
          title: "Maximum quantity reached",
          description: "You cannot add more of this artwork to your cart",
          variant: "destructive",
        });
        return;
      }

      const { error: updateError } = await supabase
        .from("cart_items")
        .update({ quantity: existingCartItem.quantity + 1 })
        .eq("user_id", userId)
        .eq("artwork_id", id);

      if (updateError) {
        toast({
          title: "Error",
          description: "Failed to update cart. Please try again.",
          variant: "destructive",
        });
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("cart_items")
        .insert([
          {
            user_id: userId,
            artwork_id: id,
            quantity: 1,
          },
        ]);

      if (insertError) {
        toast({
          title: "Error",
          description: "Failed to add to cart. Please try again.",
          variant: "destructive",
        });
        return;
      }
    }

    toast({
      title: "Success",
      description: "Added to cart successfully",
    });

    onAddToCart?.();
  };

  const handleBuyNow = () => {
    handleAddToCart();
    window.location.href = "/cart";
  };

  return (
    <>
      <Card className="overflow-hidden group cursor-pointer transition-transform duration-300 hover:scale-[1.02]">
        <CardContent className="p-0" onClick={() => setIsPreviewOpen(true)}>
          <div className="relative aspect-square">
            <img
              src={imageUrl}
              alt={title}
              className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 p-4">
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
          {userId === artistId ? (
            <p className="text-sm text-muted-foreground w-full text-center">Your artwork</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 w-full">
              <Button 
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddToCart();
                }}
                disabled={stockQuantity <= 0}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                Add to Cart
              </Button>
              <Button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleBuyNow();
                }}
                disabled={stockQuantity <= 0}
              >
                Buy Now
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>

      <ArtworkPreviewModal
        artwork={{
          id,
          title,
          description,
          price,
          imageUrl,
          artistId,
          stockQuantity,
        }}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        onAddToCart={handleAddToCart}
        onBuyNow={handleBuyNow}
        isOwnArtwork={userId === artistId}
      />
    </>
  );
};

export default ArtworkCard;