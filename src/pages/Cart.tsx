import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trash2, ShoppingBag, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
// This is the new import
import { DummyPaymentGateway } from "@/components/DummyPaymentGateway";

interface CartItem {
  id: string;
  quantity: number;
  artwork: {
    id: string;
    title: string;
    price: number;
    image_url: string;
    artist_id: string;
    stock_quantity: number;
  };
}

interface DeliveryAddress {
  id: string;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
}

const Cart = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [showAddressDialog, setShowAddressDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // This is the new state for the modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [addressForm, setAddressForm] = useState({
    full_name: "",
    phone: "",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "India",
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
    setUserId(session.user.id);
    fetchCartItems(session.user.id);
  };

  const fetchCartItems = async (uid: string) => {
    const { data, error } = await supabase
      .from("cart_items")
      .select(
        `
        id,
        quantity,
        artwork:artworks (
          id,
          title,
          price,
          image_url,
          artist_id,
          stock_quantity
        )
      `
      )
      .eq("user_id", uid);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch cart items",
        variant: "destructive",
      });
    } else {
      setCartItems(data as CartItem[]);
    }

    // Fetch addresses
    const { data: addressData, error: addressError } = await supabase
      .from("delivery_addresses")
      .select("*")
      .eq("user_id", uid);

    if (!addressError && addressData) {
      setAddresses(addressData);
      const defaultAddress = addressData.find((addr) => addr.is_default);
      if (defaultAddress) {
        setSelectedAddress(defaultAddress.id);
      }
    }

    setLoading(false);
  };

  const removeFromCart = async (cartItemId: string) => {
    const { error } = await supabase
      .from("cart_items")
      .delete()
      .eq("id", cartItemId);

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

  const handleSaveAddress = async () => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from("delivery_addresses")
        .insert([{ ...addressForm, user_id: userId }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Address saved successfully",
      });

      setShowAddressDialog(false);
      setAddressForm({
        full_name: "",
        phone: "",
        address_line1: "",
        address_line2: "",
        city: "",
        state: "",
        postal_code: "",
        country: "India",
      });
      fetchCartItems(userId);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save address",
        variant: "destructive",
      });
    }
  };

  // This is the new function to open the modal
  const triggerCheckout = () => {
    if (!selectedAddress) {
      toast({
        title: "Address Required",
        description: "Please select a delivery address",
        variant: "destructive",
      });
      return;
    }
    // All good, open the payment modal
    setShowPaymentModal(true);
  };

  // ------------------------------------------------------------------
  // HERE IS THE FIXED, ATOMIC CHECKOUT FUNCTION
  // ------------------------------------------------------------------
  const handleCheckout = async () => {
    if (!userId || cartItems.length === 0) {
      // Don't show a toast, the modal will handle it
      return;
    }

    if (!selectedAddress) {
      toast({
        title: "Address Required",
        description: "Please select a delivery address",
        variant: "destructive",
      });
      return;
    }

    try {
      // This is the ONLY call we make now.
      // All the logic is in the database function.
      
      const { data, error } = await supabase.rpc('handle_checkout', {
        p_buyer_id: userId,
        p_delivery_address_id: selectedAddress,
      });

      if (error) {
        // This will catch the 'Insufficient stock' error
        // from the database function and show it to the user.
        throw new Error(error.message);
      }

      toast({
        title: "Success!",
        description: "Order placed successfully",
      });

      navigate("/orders");

    } catch (error: any) {
      let errorMessage = "Failed to place order";
      
      // Clean up the error message from the database
      if (error.message && error.message.includes("Insufficient stock")) {
        errorMessage = error.message.split('ERROR: ').pop()?.split('CONTEXT:').shift() || "An item in your cart is out of stock.";
      }
      
      // This error will be caught and shown in the modal
      // We re-throw it so the modal's `catch` block can see it
      throw new Error(errorMessage);
    }
  };
  // ------------------------------------------------------------------
  // END OF CHANGES
  // ------------------------------------------------------------------

  const total = cartItems.reduce(
    (sum, item) => sum + item.artwork.price * item.quantity,
    0
  );
  const paymentAmount = total * 0.7;

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
              <p className="text-muted-foreground mb-4">
                Start adding some amazing artworks!
              </p>
              <Button onClick={() => navigate("/")}>Browse Artworks</Button>
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
                        <p
                          className={`text-xs ${
                            item.artwork.stock_quantity < item.quantity
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }`}
                        >
                          {item.artwork.stock_quantity > 0
                            ? `${item.artwork.stock_quantity} available`
                            : "Out of stock"}
                        </p>
                      </div>
                      <p className="font-bold text-primary">
                        ₹{item.artwork.price.toFixed(2)}
                      </p>
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

            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardContent className="p-6 space-y-4">
                  <h2 className="text-xl font-bold">Delivery Address</h2>
                  {addresses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No saved addresses
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {addresses.map((address) => (
                        <div
                          key={address.id}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedAddress === address.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                          onClick={() => setSelectedAddress(address.id)}
                        >
                          <p className="font-semibold">{address.full_name}</p>
                          <p className="text-sm">{address.phone}</p>
                          <p className="text-sm text-muted-foreground">
                            {address.address_line1}, {address.city},{" "}
                            {address.state} - {address.postal_code}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  <Dialog
                    open={showAddressDialog}
                    onOpenChange={setShowAddressDialog}
                  >
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full">
                        <Plus className="mr-2 h-4 w-4" />
                        Add New Address
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Add Delivery Address</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Full Name</Label>
                            <Input
                              value={addressForm.full_name}
                              onChange={(e) =>
                                setAddressForm({
                                  ...addressForm,
                                  full_name: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Phone</Label>
                            <Input
                              value={addressForm.phone}
                              onChange={(e) =>
                                setAddressForm({
                                  ...addressForm,
                                  phone: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Address Line 1</Label>
                          <Input
                            value={addressForm.address_line1}
                            onChange={(e) =>
                              setAddressForm({
                                ...addressForm,
                                address_line1: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Address Line 2 (Optional)</Label>
                          <Input
                            value={addressForm.address_line2}
                            onChange={(e) =>
                              setAddressForm({
                                ...addressForm,
                                address_line2: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>City</Label>
                            <Input
                              value={addressForm.city}
                              onChange={(e) =>
                                setAddressForm({
                                  ...addressForm,
                                  city: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>State</Label>
                            <Input
                              value={addressForm.state}
                              onChange={(e) =>
                                setAddressForm({
                                  ...addressForm,
                                  state: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Postal Code</Label>
                            <Input
                              value={addressForm.postal_code}
                              onChange={(e) =>
                                setAddressForm({
                                  ...addressForm,
                                  postal_code: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Country</Label>
                            <Input
                              value={addressForm.country}
                              onChange={(e) =>
                                setAddressForm({
                                  ...addressForm,
                                  country: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                        <Button
                          onClick={handleSaveAddress}
                          className="w-full"
                        >
                          Save Address
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>

              <Card className="sticky top-20">
                <CardContent className="p-6 space-y-4">
                  <h2 className="text-xl font-bold">Order Summary</h2>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Items ({cartItems.length})
                      </span>
                      <span>₹{total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Total Amount
                      </span>
                      <span>₹{total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-primary">
                      <span>To Pay Now (70%)</span>
                      <span>₹{paymentAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Remaining (30%)</span>
                      <span>₹{(total - paymentAmount).toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between font-bold text-lg">
                        <span>Payment Amount</span>
                        <span className="text-primary">
                          ₹{paymentAmount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* THIS IS THE MODIFIED BUTTON */}
                  <Button
                    className="w-full"
                    onClick={triggerCheckout}
                    disabled={!selectedAddress || cartItems.length === 0}
                  >
                    Buy Now - Pay ₹{paymentAmount.toFixed(2)}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* THIS IS THE ONLY CHANGE.
          'onPaymentSuccess' has been replaced with 'onSubmit'.
        */}
        <DummyPaymentGateway
          isOpen={showPaymentModal}
          onOpenChange={setShowPaymentModal}
          amount={paymentAmount}
          onSubmit={handleCheckout}
        />
      </div>
    </div>
  );
};

export default Cart;