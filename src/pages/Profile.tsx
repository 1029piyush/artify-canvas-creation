import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  User,
  LogOut,
  ListOrdered,
  ClipboardPen,
  Trash2,
  Plus,
  Check,
  Palette, // Added for Artist link
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface ProfileData {
  id: string;
  full_name: string | null;
  email: string;
  user_type: string;
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

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddressDialog, setShowAddressDialog] = useState(false);
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
    checkAuthAndFetchData();
  }, []);

  const checkAuthAndFetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    try {
      // Fetch profile and addresses at the same time
      const [profileRes, addressesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", session.user.id).single(),
        supabase.from("delivery_addresses").select("*").eq("user_id", session.user.id),
      ]);

      if (profileRes.data) {
        setProfile(profileRes.data);
      }
      if (addressesRes.data) {
        setAddresses(addressesRes.data);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not fetch your profile data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleSaveAddress = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from("delivery_addresses")
        .insert([{ ...addressForm, user_id: profile.id }])
        .select();

      if (error) throw error;

      if (data) {
        setAddresses([...addresses, data[0]]);
      }

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
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save address",
        variant: "destructive",
      });
    }
  };

  // ------------------------------------------------------------------
  // HERE IS THE FIXED DELETE FUNCTION
  // ------------------------------------------------------------------
  const handleDeleteAddress = async (addressId: string) => {
    if (!profile) {
      toast({
        title: "Error",
        description: "Cannot delete address, user not found.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("delivery_addresses")
        .delete()
        .eq("id", addressId)
        // THIS IS THE FIX: We prove ownership by matching the user's ID
        .eq("user_id", profile.id); 

      if (error) throw error;

      setAddresses(addresses.filter((addr) => addr.id !== addressId));
      toast({
        title: "Success",
        description: "Address removed",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove address",
        variant: "destructive",
      });
    }
  };
  // ------------------------------------------------------------------
  // END OF FIX
  // ------------------------------------------------------------------

  const handleSetDefault = async (addressId: string) => {
    if (!profile) return;
    const currentDefault = addresses.find((addr) => addr.is_default);

    try {
      // 1. Unset the current default (if one exists)
      if (currentDefault) {
        await supabase
          .from("delivery_addresses")
          .update({ is_default: false })
          .eq("id", currentDefault.id);
      }

      // 2. Set the new default
      const { error } = await supabase
        .from("delivery_addresses")
        .update({ is_default: true })
        .eq("id", addressId);

      if (error) throw error;

      // 3. Update local state to reflect change
      setAddresses(
        addresses.map((addr) => ({
          ...addr,
          is_default: addr.id === addressId,
        }))
      );

      toast({
        title: "Success",
        description: "Default address updated",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to set default address",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container py-8">
        <div className="mx-auto max-w-2xl space-y-8">
          <h1 className="mb-8 text-3xl font-bold">My Account</h1>

          {loading ? (
            <Card>
              <CardContent className="py-12">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ) : profile ? (
            <>
              {/* Profile Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <CardTitle>{profile.full_name || "User"}</CardTitle>
                      <p className="text-sm text-muted-foreground capitalize">
                        {profile.user_type}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Email
                    </p>
                    <p className="text-base">{profile.email}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Account Type
                    </p>
                    <p className="text-base capitalize">{profile.user_type}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Conditional Quick Links Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Links</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  {profile.user_type === 'artist' ? (
                    // --- ARTIST LINKS ---
                    <Button
                      variant="outline"
                      className="justify-start gap-3 p-6 text-base sm:col-span-2"
                      onClick={() => navigate("/artist-dashboard")}
                    >
                      <Palette className="h-5 w-5" />
                      Go to My Artist Dashboard
                    </Button>
                  ) : (
                    // --- BUYER LINKS ---
                    <>
                      <Button
                        variant="outline"
                        className="justify-start gap-3 p-6 text-base"
                        onClick={() => navigate("/orders")}
                      >
                        <ListOrdered className="h-5 w-5" />
                        My Orders
                      </Button>
                      <Button
                        variant="outline"
                        className="justify-start gap-3 p-6 text-base"
                        onClick={() => navigate("/custom-art-requests")}
                      >
                        <ClipboardPen className="h-5 w-5" />
                        My Custom Requests
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>


              {/* Manage Addresses Card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Manage Addresses</CardTitle>
                  <Dialog
                    open={showAddressDialog}
                    onOpenChange={setShowAddressDialog}
                  >
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Add New
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
                </CardHeader>
                <CardContent className="space-y-4">
                  {addresses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      You have no saved addresses.
                    </p>
                  ) : (
                    addresses.map((address) => (
                      <div
                        key={address.id}
                        className="flex justify-between rounded-lg border p-4"
                      >
                        <div>
                          <p className="font-semibold flex items-center gap-2">
                            {address.full_name}
                            {address.is_default && (
                              <span className="flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                <Check className="h-3 w-3" /> Default
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {address.phone}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {address.address_line1}, {address.city},{" "}
                            {address.state} - {address.postal_code}
                          </p>
                          {!address.is_default && (
                            <Button
                              variant="link"
                              size="sm"
                              className="p-0 h-auto mt-2"
                              onClick={() => handleSetDefault(address.id)}
                            >
                              Set as Default
                            </Button>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDeleteAddress(address.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Log Out Button */}
              <Button
                variant="destructive"
                className="w-full gap-2"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Log Out
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Profile;