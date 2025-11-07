import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Shield } from "lucide-react";

const adminSignInSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const AdminAuth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const checkAdminAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .eq('role', 'admin')
          .single();
        
        if (roles) {
          navigate('/admin-dashboard');
        }
      }
    };

    checkAdminAccess();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session && event === 'SIGNED_IN') {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .eq('role', 'admin')
          .single();
        
        if (roles) {
          navigate('/admin-dashboard');
        } else {
          toast({
            title: "Access Denied",
            description: "You do not have admin privileges.",
            variant: "destructive",
          });
          await supabase.auth.signOut();
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      adminSignInSchema.parse({ email });
      setLoading(true);

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) throw error;

      setOtpSent(true);
      toast({
        title: "OTP Sent!",
        description: "Check your email for the verification code.",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else if (error instanceof Error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);

      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });

      if (error) throw error;
    } catch (error) {
      if (error instanceof Error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[image:var(--gradient-hero)] p-4 animate-fade-in">
      <Card className="w-full max-w-md shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-hover)] transition-all duration-300 border-border/50 backdrop-blur-sm bg-card/95">
        <CardHeader className="text-center">
          <Link to="/" className="mx-auto mb-4 hover:scale-105 transition-transform duration-300">
            <div className="flex items-center justify-center gap-2">
              <Shield className="h-10 w-10 text-primary" />
              <span className="text-2xl font-bold">Admin Portal</span>
            </div>
          </Link>
          <CardTitle className="text-3xl bg-clip-text text-transparent bg-[image:var(--gradient-artify)]">Admin Sign In</CardTitle>
          <CardDescription>Secure authentication for administrators</CardDescription>
        </CardHeader>
        <CardContent>
          {!otpSent ? (
            <form onSubmit={handleSendOTP} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email">Admin Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-border/50 focus:border-primary transition-colors"
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-[image:var(--gradient-primary)] hover:opacity-90 transition-all duration-300 shadow-[var(--shadow-card)]" disabled={loading}>
                <Shield className="mr-2 h-4 w-4" />
                {loading ? "Sending..." : "Send OTP"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} className="space-y-4 py-4">
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">Enter OTP</h3>
                <p className="text-sm text-muted-foreground">
                  We sent a code to <span className="font-medium text-foreground">{email}</span>
                </p>
              </div>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button type="submit" className="w-full bg-[image:var(--gradient-primary)] hover:opacity-90" disabled={loading || otp.length !== 6}>
                {loading ? "Verifying..." : "Verify & Sign In"}
              </Button>
              <Button 
                variant="ghost" 
                type="button"
                className="w-full"
                onClick={() => {
                  setOtpSent(false);
                  setOtp("");
                }}
              >
                Use a different email
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAuth;
