import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, X } from "lucide-react";

interface ArtworkPreviewModalProps {
  artwork: {
    id: string;
    title: string;
    description?: string;
    price: number;
    imageUrl: string;
    artistId: string;
    stockQuantity: number;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: () => void;
  onBuyNow: () => void;
  isOwnArtwork: boolean;
}

export function ArtworkPreviewModal({
  artwork,
  isOpen,
  onClose,
  onAddToCart,
  onBuyNow,
  isOwnArtwork,
}: ArtworkPreviewModalProps) {
  if (!artwork) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
        <div className="grid md:grid-cols-2 gap-0">
          {/* Artwork Image */}
          <div className="relative aspect-square">
            <img
              src={artwork.imageUrl}
              alt={artwork.title}
              className="object-cover w-full h-full"
            />
          </div>

          {/* Artwork Details */}
          <div className="p-6 flex flex-col">
            <div className="flex-1">
              <h2 className="text-2xl font-bold tracking-tight">{artwork.title}</h2>
              {artwork.description && (
                <p className="mt-2 text-muted-foreground">{artwork.description}</p>
              )}
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Price</span>
                  <span className="text-xl font-bold text-primary">
                    ₹{artwork.price.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Availability</span>
                  <Badge variant={artwork.stockQuantity > 0 ? "default" : "destructive"}>
                    {artwork.stockQuantity > 0
                      ? `${artwork.stockQuantity} in stock`
                      : "Out of Stock"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {isOwnArtwork ? (
              <p className="text-sm text-muted-foreground w-full text-center mt-6">
                Your artwork
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4 mt-6">
                <Button
                  variant="outline"
                  onClick={onAddToCart}
                  disabled={artwork.stockQuantity <= 0}
                  className="w-full"
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Add to Cart
                </Button>
                <Button
                  onClick={onBuyNow}
                  disabled={artwork.stockQuantity <= 0}
                  className="w-full"
                >
                  Buy Now
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
