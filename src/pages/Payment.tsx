import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Building2 } from "lucide-react";

const Payment = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'bank'>('upi');
  const [orderDetails, setOrderDetails] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    upi_id: "",
    bank_name: "",
    account_number: "",
    ifsc_code: "",
    account_holder_name: "",
    transaction_id: "",
  });

  const orderId = searchParams.get('orderId');
  const amount = searchParams.get('amount');

  useEffect(() => {
    if (!orderId || !amount) {
      navigate('/cart');
      return;
    }
    checkAuth();
  }, [orderId, amount]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }
    fetchOrderDetails();
  };

  const fetchOrderDetails = async () => {
    const { data } = await supabase
      .from('orders')
      .select(`
        *,
        artwork:artworks(title, image_url)
      `)
      .eq('id', orderId)
      .single();

    if (data) {
      setOrderDetails(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const paymentData: any = {
        order_id: orderId,
        payment_method: paymentMethod,
        payment_status: 'pending',
        transaction_id: formData.transaction_id,
      };

      if (paymentMethod === 'upi') {
        paymentData.upi_id = formData.upi_id;
      } else {
        paymentData.bank_name = formData.bank_name;
        paymentData.account_number = formData.account_number;
        paymentData.ifsc_code = formData.ifsc_code;
        paymentData.account_holder_name = formData.account_holder_name;
      }

      const { error } = await supabase
        .from('payment_details')
        .insert(paymentData);

      if (error) throw error;

      // Update order payment amount
      await supabase
        .from('orders')
        .update({ payment_amount: parseFloat(amount!) })
        .eq('id', orderId);

      toast({
        title: "Payment Submitted",
        description: "Your payment details have been submitted for verification",
      });

      navigate('/orders');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit payment details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!orderDetails) {
    return <div>Loading...</div>;
  }

  const advanceAmount = parseFloat(amount!) * 0.7;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container py-8 max-w-2xl">
        <h1 className="mb-8 text-3xl font-bold">Payment Details</h1>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span>Artwork:</span>
              <span className="font-semibold">{orderDetails.artwork.title}</span>
            </div>
            <div className="flex justify-between">
              <span>Quantity:</span>
              <span>{orderDetails.quantity}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Price:</span>
              <span>₹{parseFloat(amount!).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-primary font-bold pt-2 border-t">
              <span>Advance Payment (70%):</span>
              <span>₹{advanceAmount.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <RadioGroup value={paymentMethod} onValueChange={(value: 'upi' | 'bank') => setPaymentMethod(value)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="upi" id="upi" />
                  <Label htmlFor="upi" className="flex items-center gap-2 cursor-pointer">
                    <CreditCard className="h-4 w-4" />
                    UPI Payment
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="bank" id="bank" />
                  <Label htmlFor="bank" className="flex items-center gap-2 cursor-pointer">
                    <Building2 className="h-4 w-4" />
                    Bank Transfer
                  </Label>
                </div>
              </RadioGroup>

              {paymentMethod === 'upi' ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="upi_id">UPI ID</Label>
                    <Input
                      id="upi_id"
                      placeholder="yourname@upi"
                      value={formData.upi_id}
                      onChange={(e) => setFormData({ ...formData, upi_id: e.target.value })}
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bank_name">Bank Name</Label>
                    <Input
                      id="bank_name"
                      placeholder="State Bank of India"
                      value={formData.bank_name}
                      onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account_holder_name">Account Holder Name</Label>
                    <Input
                      id="account_holder_name"
                      placeholder="Full name as per bank"
                      value={formData.account_holder_name}
                      onChange={(e) => setFormData({ ...formData, account_holder_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account_number">Account Number</Label>
                    <Input
                      id="account_number"
                      placeholder="1234567890"
                      value={formData.account_number}
                      onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ifsc_code">IFSC Code</Label>
                    <Input
                      id="ifsc_code"
                      placeholder="SBIN0001234"
                      value={formData.ifsc_code}
                      onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value })}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="transaction_id">Transaction ID / Reference Number</Label>
                <Input
                  id="transaction_id"
                  placeholder="Enter transaction ID after payment"
                  value={formData.transaction_id}
                  onChange={(e) => setFormData({ ...formData, transaction_id: e.target.value })}
                  required
                />
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Please transfer ₹{advanceAmount.toFixed(2)} (70% advance) and enter the transaction details above.
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Submitting..." : "Submit Payment Details"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Payment;
