import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trash2, ShoppingBag } from "lucide-react";

interface CartItem {
  id: string;
  quantity: number;
  artwork: {
    id: string;
    title: string;
    price: number;
    image_url: string;
    artist_id: string;
  };
}

const Cart = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }
    setUserId(session.user.id);
    fetchCartItems(session.user.id);
  };

  const fetchCartItems = async (uid: string) => {
    const { data, error } = await supabase
      .from('cart_items')
      .select(`
        id,
        quantity,
        artwork:artworks (
          id,
          title,
          price,
          image_url,
          artist_id
        )
      `)
      .eq('user_id', uid);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch cart items",
        variant: "destructive",
      });
    } else {
      setCartItems(data as CartItem[]);
    }
    setLoading(false);
  };

  const removeFromCart = async (cartItemId: string) => {
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', cartItemId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to remove item",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Item removed from cart",
      });
      if (userId) {
        fetchCartItems(userId);
      }
    }
  };

  const handleCheckout = async () => {
    if (!userId || cartItems.length === 0) return;

    try {
      // Create orders for each cart item
      const orders = cartItems.map(item => ({
        buyer_id: userId,
        artwork_id: item.artwork.id,
        artist_id: item.artwork.artist_id,
        quantity: item.quantity,
        total_price: item.artwork.price * item.quantity,
        status: 'pending'
      }));

      const { error: orderError } = await supabase
        .from('orders')
        .insert(orders);

      if (orderError) throw orderError;

      // Clear cart
      const { error: deleteError } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      toast({
        title: "Success!",
        description: "Order placed successfully",
      });
      
      fetchCartItems(userId);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to place order",
        variant: "destructive",
      });
    }
  };

  const total = cartItems.reduce((sum, item) => sum + (item.artwork.price * item.quantity), 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container py-8">
        <h1 className="mb-8 text-3xl font-bold">Shopping Cart</h1>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : cartItems.length === 0 ? (
          <Card className="py-12">
            <CardContent className="text-center">
              <ShoppingBag className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              <h2 className="text-2xl font-semibold mb-2">Your cart is empty</h2>
              <p className="text-muted-foreground mb-4">Start adding some amazing artworks!</p>
              <Button onClick={() => navigate('/')}>Browse Artworks</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item) => (
                <Card key={item.id}>
                  <CardContent className="flex gap-4 p-4">
                    <img
                      src={item.artwork.image_url}
                      alt={item.artwork.title}
                      className="h-24 w-24 rounded-lg object-cover"
                    />
                    <div className="flex flex-1 flex-col justify-between">
                      <div>
                        <h3 className="font-semibold">{item.artwork.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          Quantity: {item.quantity}
                        </p>
                      </div>
                      <p className="font-bold text-primary">₹{item.artwork.price.toFixed(2)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFromCart(item.id)}
                    >
                      <Trash2 className="h-5 w-5 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="lg:col-span-1">
              <Card className="sticky top-20">
                <CardContent className="p-6 space-y-4">
                  <h2 className="text-xl font-bold">Order Summary</h2>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Items ({cartItems.length})</span>
                      <span>₹{total.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between font-bold text-lg">
                        <span>Total</span>
                        <span className="text-primary">₹{total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <Button className="w-full" onClick={handleCheckout}>
                    Proceed to Checkout
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Cart;