import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Image, 
  ShoppingCart, 
  TrendingUp,
  Trash2,
  CheckCircle,
  AlertCircle,
  LogOut
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface Artist {
  id: string;
  email: string;
  full_name: string;
  artwork_count: number;
  has_pending_orders: boolean;
  bank_details?: {
    bank_name: string;
    account_holder_name: string;
    account_number: string;
    ifsc_code: string;
    upi_id?: string;
  };
}

interface Artwork {
  id: string;
  title: string;
  artist_name: string;
  price: number;
}

interface Order {
  id: string;
  created_at: string;
  buyer_email: string;
  artwork_title: string;
  total_price: number;
  payment_amount: number;
  status: string;
  payment_verified: boolean;
  payment_id?: string;
}

interface Stats {
  total_artists: number;
  total_artworks: number;
  total_orders: number;
  delivered_orders: number;
  pending_payments: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats>({
    total_artists: 0,
    total_artworks: 0,
    total_orders: 0,
    delivered_orders: 0,
    pending_payments: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/admin-auth');
      return;
    }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      navigate('/admin-auth');
      return;
    }

    fetchData();
  };

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch artists with artwork count
    const { data: artistsData } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('user_type', 'artist');

    // Fetch artworks count per artist and bank details
    const artistsWithDetails = await Promise.all(
      (artistsData || []).map(async (artist) => {
        const { count } = await supabase
          .from('artworks')
          .select('*', { count: 'exact', head: true })
          .eq('artist_id', artist.id);

        const { data: bankData } = await supabase
          .from('artist_bank_details')
          .select('*')
          .eq('user_id', artist.id)
          .single();

        const { data: pendingOrders } = await supabase
          .from('orders')
          .select('id')
          .eq('artist_id', artist.id)
          .eq('status', 'pending');

        return {
          ...artist,
          artwork_count: count || 0,
          has_pending_orders: (pendingOrders?.length || 0) > 0,
          bank_details: bankData || undefined,
        };
      })
    );

    setArtists(artistsWithDetails);

    // Fetch all artworks with artist names
    const { data: artworksData } = await supabase
      .from('artworks')
      .select(`
        id,
        title,
        price,
        artist:profiles(full_name)
      `);

    setArtworks(
      (artworksData || []).map((artwork: any) => ({
        id: artwork.id,
        title: artwork.title,
        price: artwork.price,
        artist_name: artwork.artist?.full_name || 'Unknown',
      }))
    );

    // Fetch orders with payment details
    const { data: ordersData } = await supabase
      .from('orders')
      .select(`
        id,
        created_at,
        total_price,
        payment_amount,
        status,
        buyer:profiles!orders_buyer_id_fkey(email),
        artwork:artworks(title),
        payment:payment_details(id, payment_status, verified_by_admin)
      `)
      .order('created_at', { ascending: false });

    const formattedOrders = (ordersData || []).map((order: any) => ({
      id: order.id,
      created_at: order.created_at,
      buyer_email: order.buyer?.email || 'Unknown',
      artwork_title: order.artwork?.title || 'Unknown',
      total_price: order.total_price,
      payment_amount: order.payment_amount || 0,
      status: order.status,
      payment_verified: order.payment?.[0]?.verified_by_admin || false,
      payment_id: order.payment?.[0]?.id,
    }));

    setOrders(formattedOrders);

    // Calculate stats
    const { count: totalOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

    const { count: deliveredOrders } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'delivered');

    const { data: paymentsData } = await supabase
      .from('payment_details')
      .select('verified_by_admin')
      .eq('verified_by_admin', false);

    setStats({
      total_artists: artistsWithDetails.length,
      total_artworks: artworksData?.length || 0,
      total_orders: totalOrders || 0,
      delivered_orders: deliveredOrders || 0,
      pending_payments: paymentsData?.length || 0,
    });

    // Set up realtime listeners
    const ordersChannel = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_details' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'artworks' }, () => {
        fetchData();
      })
      .subscribe();

    setLoading(false);

    return () => {
      supabase.removeChannel(ordersChannel);
    };
  };

  const handleDeleteArtwork = async (artworkId: string) => {
    const { error } = await supabase
      .from('artworks')
      .delete()
      .eq('id', artworkId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete artwork",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Artwork deleted successfully",
      });
      fetchData();
    }
  };

  const handleDeleteArtist = async (artistId: string) => {
    // Delete all artworks first
    await supabase
      .from('artworks')
      .delete()
      .eq('artist_id', artistId);

    // Delete artist role
    await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', artistId);

    // Delete profile
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', artistId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete artist",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Artist and their artworks deleted successfully",
      });
      fetchData();
    }
  };

  const handleVerifyPayment = async (paymentId: string, orderId: string) => {
    const { error: paymentError } = await supabase
      .from('payment_details')
      .update({ 
        verified_by_admin: true,
        verified_at: new Date().toISOString()
      })
      .eq('id', paymentId);

    const { error: orderError } = await supabase
      .from('orders')
      .update({ 
        status: 'confirmed',
        artist_notified: true
      })
      .eq('id', orderId);

    if (paymentError || orderError) {
      toast({
        title: "Error",
        description: "Failed to verify payment",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Payment Verified",
        description: "Order confirmed and artist notified",
      });
      fetchData();
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/admin-auth');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const pieData = [
    { name: 'Delivered', value: stats.delivered_orders },
    { name: 'Pending', value: stats.total_orders - stats.delivered_orders },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <Button onClick={handleSignOut} variant="outline">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Artists</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_artists}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Artworks</CardTitle>
              <Image className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_artworks}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_orders}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Delivered</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.delivered_orders}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending_payments}</div>
            </CardContent>
          </Card>
        </div>

        {/* Pie Chart */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Order Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent Orders with Payment Verification */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Artwork</TableHead>
                  <TableHead>Total Price</TableHead>
                  <TableHead>Payment Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{order.buyer_email}</TableCell>
                    <TableCell>{order.artwork_title}</TableCell>
                    <TableCell>₹{order.total_price}</TableCell>
                    <TableCell>₹{order.payment_amount}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        order.status === 'delivered' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {order.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {order.payment_verified ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                      )}
                    </TableCell>
                    <TableCell>
                      {!order.payment_verified && order.payment_id && (
                        <Button
                          size="sm"
                          onClick={() => handleVerifyPayment(order.payment_id!, order.id)}
                        >
                          Verify Payment
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Artists with Bank Details */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Artists & Bank Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Artist</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Artworks</TableHead>
                  <TableHead>Bank Details</TableHead>
                  <TableHead>UPI ID</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {artists.map((artist) => (
                  <TableRow key={artist.id}>
                    <TableCell>
                      {artist.has_pending_orders && (
                        <div className="w-2 h-2 bg-red-500 rounded-full" title="Has pending orders" />
                      )}
                    </TableCell>
                    <TableCell>{artist.full_name}</TableCell>
                    <TableCell>{artist.email}</TableCell>
                    <TableCell>{artist.artwork_count}</TableCell>
                    <TableCell>
                      {artist.bank_details ? (
                        <div className="text-xs">
                          <div>{artist.bank_details.bank_name}</div>
                          <div>{artist.bank_details.account_number}</div>
                          <div>{artist.bank_details.ifsc_code}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Not provided</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {artist.bank_details?.upi_id || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Artist</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will delete the artist and all their artworks. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteArtist(artist.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* All Artworks */}
        <Card>
          <CardHeader>
            <CardTitle>All Artworks</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Artist</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {artworks.map((artwork) => (
                  <TableRow key={artwork.id}>
                    <TableCell>{artwork.title}</TableCell>
                    <TableCell>{artwork.artist_name}</TableCell>
                    <TableCell>₹{artwork.price}</TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Artwork</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this artwork? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteArtwork(artwork.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
