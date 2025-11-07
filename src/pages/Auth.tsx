import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Mail, Shield } from "lucide-react";

const signUpSchema = z.object({
  email: z.string().email("Invalid email address").refine(
    (email) => {
      // Check for valid email format with real domain
      const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      return emailRegex.test(email);
    },
    { message: "Please enter a valid email address" }
  ),
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  userType: z.enum(['artist', 'buyer']),
});

const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    fullName: "",
    userType: "buyer" as 'artist' | 'buyer',
  });

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && event === 'SIGNED_IN') {
        navigate('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSendOTP = async (e: React.FormEvent, isSignUp: boolean = false) => {
    e.preventDefault();
    
    try {
      if (isSignUp) {
        signUpSchema.parse(formData);
      } else {
        signInSchema.parse({ email: formData.email });
      }
      
      setLoading(true);

      const { error } = await supabase.auth.signInWithOtp({
        email: formData.email,
        options: {
          shouldCreateUser: isSignUp,
          data: isSignUp ? {
            full_name: formData.fullName,
            user_type: formData.userType,
          } : undefined,
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
        email: formData.email,
        token: otp,
        type: 'email',
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "You have been signed in successfully.",
      });
      
      navigate('/');
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
            <img 
              src="/src/assets/artify-logo.jpg" 
              alt="Artify" 
              className="h-12 w-auto object-contain"
            />
          </Link>
          <CardTitle className="text-3xl bg-clip-text text-transparent bg-[image:var(--gradient-artify)]">Welcome to Artify</CardTitle>
          <CardDescription>Sign in or create an account to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-muted/50">
              <TabsTrigger value="signin" className="data-[state=active]:bg-[image:var(--gradient-primary)] data-[state=active]:text-primary-foreground">Sign In</TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:bg-[image:var(--gradient-primary)] data-[state=active]:text-primary-foreground">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              {!otpSent ? (
                <form onSubmit={(e) => handleSendOTP(e, false)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="border-border/50 focus:border-primary transition-colors"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full bg-[image:var(--gradient-primary)] hover:opacity-90 transition-all duration-300 shadow-[var(--shadow-card)]" disabled={loading}>
                    <Mail className="mr-2 h-4 w-4" />
                    {loading ? "Sending..." : "Send OTP"}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOTP} className="space-y-4 py-4">
                  <div className="text-center space-y-4">
                    <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                      <Mail className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg">Enter OTP</h3>
                    <p className="text-sm text-muted-foreground">
                      We sent a code to <span className="font-medium text-foreground">{formData.email}</span>
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
                    {loading ? "Verifying..." : "Verify OTP"}
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
            </TabsContent>
            
            <TabsContent value="signup">
              {!otpSent ? (
                <form onSubmit={(e) => handleSendOTP(e, true)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Doe"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="border-border/50 focus:border-primary transition-colors"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="border-border/50 focus:border-primary transition-colors"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>I am a</Label>
                    <RadioGroup
                      value={formData.userType}
                      onValueChange={(value) => setFormData({ ...formData, userType: value as 'artist' | 'buyer' })}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="buyer" id="buyer" />
                        <Label htmlFor="buyer" className="font-normal cursor-pointer">
                          Art Buyer
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="artist" id="artist" />
                        <Label htmlFor="artist" className="font-normal cursor-pointer">
                          Artist
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <Button type="submit" className="w-full bg-[image:var(--gradient-primary)] hover:opacity-90 transition-all duration-300 shadow-[var(--shadow-card)]" disabled={loading}>
                    <Mail className="mr-2 h-4 w-4" />
                    {loading ? "Sending..." : "Send OTP"}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOTP} className="space-y-4 py-4">
                  <div className="text-center space-y-4">
                    <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                      <Mail className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg">Enter OTP</h3>
                    <p className="text-sm text-muted-foreground">
                      We sent a code to <span className="font-medium text-foreground">{formData.email}</span>
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
                    {loading ? "Verifying..." : "Verify & Create Account"}
                  </Button>
                  <Button 
                    variant="ghost" 
                    type="button"
                    className="w-full"
                    onClick={() => {
                      setOtpSent(false);
                      setOtp("");
                      setFormData({ email: "", fullName: "", userType: "buyer" });
                    }}
                  >
                    Use a different email
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
