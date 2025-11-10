import { useEffect, useState, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, CheckCircle } from "lucide-react";
import { z } from "zod";

// Zod schema for validation
const customRequestSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  budget: z.number().min(500, "Minimum budget is ₹500").optional(),
});

interface CustomRequest {
  id: string;
  title: string;
  description: string;
  budget: number | null;
  status: string;
  created_at: string;
  artist_id: string | null;
  artist?: {
    full_name: string | null;
    email: string;
  } | null;
}

const CustomArt = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<CustomRequest[]>([]);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    budget: "",
  });

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
    fetchRequests(session.user.id);
  };

  const fetchRequests = async (uid: string) => {
    const { data, error } = await supabase
      .from('custom_requests')
      .select('*')
      .eq('buyer_id', uid)
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: "Error", description: "Failed to fetch requests.", variant: "destructive" });
      setRequests([]);
    } else {
      setRequests((data || []) as CustomRequest[]);
    }
    setLoading(false);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    try {
      const validatedData = customRequestSchema.parse({
        ...formData,
        budget: formData.budget ? parseFloat(formData.budget) : undefined,
      });

      setSubmitting(true);

      const { error } = await supabase
        .from('custom_requests')
        .insert({
          buyer_id: userId,
          title: validatedData.title,
          description: validatedData.description,
          budget: validatedData.budget,
          status: 'pending',
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Your custom artwork request has been submitted. Artists will be notified!",
      });

      // Clear form and refetch
      setFormData({ title: "", description: "", budget: "" });
      fetchRequests(userId);

    } catch (error) {
      let errorMessage = "Failed to submit request.";
      if (error instanceof z.ZodError) {
        errorMessage = error.errors[0].message;
      } else {
        errorMessage = (error as Error).message;
      }
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container py-8">
        <h1 className="mb-8 text-3xl font-bold">Custom Artwork Request</h1>

        <div className="grid gap-8 lg:grid-cols-2">
          
          {/* Column 1: Submission Form */}
          <Card>
            <CardHeader>
              <CardTitle>Submit a New Request</CardTitle>
              <CardDescription>Describe the masterpiece you want to commission.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title / Theme</Label>
                  <Input id="title" name="title" value={formData.title} onChange={handleChange} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Detailed Description</Label>
                  <Textarea id="description" name="description" value={formData.description} onChange={handleChange} rows={5} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget">Your Budget (₹)</Label>
                  <Input id="budget" name="budget" type="number" min="500" placeholder="e.g., 5000" value={formData.budget} onChange={handleChange} />
                  <p className="text-xs text-muted-foreground">Min. recommended budget is ₹500.</p>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Send className="mr-2 h-4 w-4" />
                  Submit Request
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Column 2: Status and Notifications */}
          <Card>
            <CardHeader>
              <CardTitle>Your Active Requests ({requests.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {loading ? (
                <div className="h-40 w-full animate-pulse bg-muted rounded-lg" />
              ) : requests.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  You have no active custom requests.
                </p>
              ) : (
                requests.map((req) => (
                  <Card key={req.id} className="border-l-4" style={{ borderColor: req.status === 'accepted' ? '#10B981' : '#F59E0B' }}>
                    <CardHeader className="p-4 flex flex-row items-center justify-between">
                      <div className="space-y-1">
                        <h3 className="font-semibold">{req.title}</h3>
                        <p className="text-sm text-muted-foreground">Status: <span className="capitalize font-medium">{req.status}</span></p>
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(req.created_at).toLocaleDateString()}</span>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-4">
                      <p className="text-sm">{req.description}</p>
                      
                      {/* Accepted Notification */}
                      {req.status === 'accepted' && (
                        <div className="p-3 bg-green-50/50 border border-green-200 rounded-lg space-y-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            <h4 className="font-bold text-green-700">Request Accepted!</h4>
                          </div>
                          <p className="text-sm">
                            An artist has claimed your request and will contact you shortly.
                          </p>
                        </div>
                      )}

                      {/* Pending status */}
                      {req.status === 'pending' && (
                        <div className="p-2 bg-yellow-50/50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
                          Waiting for an artist to claim this request...
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CustomArt;