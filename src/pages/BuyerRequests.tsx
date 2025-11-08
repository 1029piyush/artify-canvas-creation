import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare } from "lucide-react";

interface CustomRequest {
  id: string;
  title: string;
  description: string;
  budget: number | null;
  status: string;
  created_at: string;
  artist_id: string | null;
}

const BuyerRequests = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<CustomRequest[]>([]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
      return;
    }
    fetchRequests(session.user.id);
  };

  const fetchRequests = async (userId: string) => {
    const { data } = await supabase
      .from('custom_requests')
      .select('*')
      .eq('buyer_id', userId)
      .order('created_at', { ascending: false });

    if (data) {
      setRequests(data);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container py-8">
        <h1 className="mb-8 text-3xl font-bold">My Custom Art Requests</h1>

        <div className="space-y-4">
          {requests.map((request) => (
            <Card key={request.id}>
              <CardContent className="p-6 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="h-6 w-6 text-primary mt-1" />
                    <div className="space-y-1">
                      <h3 className="font-semibold text-lg">{request.title}</h3>
                      <p className="text-sm text-muted-foreground">{request.description}</p>
                    </div>
                  </div>
                  <span className="text-xs px-3 py-1 rounded-full bg-secondary capitalize">
                    {request.status}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Budget</p>
                    <p className="font-bold text-primary">
                      {request.budget ? `₹${request.budget.toFixed(2)}` : 'Not specified'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="font-medium capitalize">{request.status}</p>
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground pt-2">
                  Requested on {new Date(request.created_at).toLocaleDateString()}
                </p>

                {request.artist_id && request.status === 'accepted' && (
                  <div className="mt-4 p-3 bg-primary/10 rounded-lg">
                    <p className="text-sm font-medium text-primary">An artist has accepted your request!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {requests.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No custom requests yet</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default BuyerRequests;
