import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, LogOut, Users, ShoppingCart, Package } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface Artist {
  id: string;
  email: string;
  full_name: string | null;
  artworks_count: number;
}

interface Artwork {
  id: string;
  title: string;
  artist_id: string;
  artist_name: string | null;
  price: number;
}

interface Order {
  id: string;
  created_at: string;
  buyer_email: string;
  artwork_title: string;
  total_price: number;
  status: string;
  payment_amount: number;
}

interface Stats {
  totalArtists: number;
  totalOrders: number;
  deliveredOrders: number;
  pendingOrders: number;
}

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalArtists: 0,
    totalOrders: 0,
    deliveredOrders: 0,
    pendingOrders: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminAccess();
    fetchData();

    // Set up realtime subscription for orders
    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const checkAdminAccess = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/admin-auth');
      return;
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .eq('role', 'admin')
      .single();
    
    if (!roles) {
      toast({
        title: "Access Denied",
        description: "You do not have admin privileges.",
        variant: "destructive",
      });
      await supabase.auth.signOut();
      navigate('/admin-auth');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch artists with artwork count
      const { data: artistsData, error: artistsError } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          full_name,
          user_type
        `)
        .eq('user_type', 'artist');

      if (artistsError) throw artistsError;

      // Get artwork counts for each artist
      const artistsWithCounts = await Promise.all(
        (artistsData || []).map(async (artist) => {
          const { count } = await supabase
            .from('artworks')
            .select('*', { count: 'exact', head: true })
            .eq('artist_id', artist.id);
          
          return {
            ...artist,
            artworks_count: count || 0,
          };
        })
      );

      setArtists(artistsWithCounts);

      // Fetch all artworks with artist info
      const { data: artworksData, error: artworksError } = await supabase
        .from('artworks')
        .select(`
          id,
          title,
          artist_id,
          price,
          profiles:artist_id (full_name)
        `);

      if (artworksError) throw artworksError;

      const formattedArtworks = (artworksData || []).map((artwork: any) => ({
        id: artwork.id,
        title: artwork.title,
        artist_id: artwork.artist_id,
        artist_name: artwork.profiles?.full_name || 'Unknown',
        price: artwork.price,
      }));

      setArtworks(formattedArtworks);

      // Fetch orders with buyer and artwork info
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          total_price,
          status,
          payment_amount,
          buyer:buyer_id (email),
          artwork:artwork_id (title)
        `)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      const formattedOrders = (ordersData || []).map((order: any) => ({
        id: order.id,
        created_at: order.created_at,
        buyer_email: order.buyer?.email || 'Unknown',
        artwork_title: order.artwork?.title || 'Unknown',
        total_price: order.total_price,
        status: order.status,
        payment_amount: order.payment_amount,
      }));

      setOrders(formattedOrders);

      // Calculate stats
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      
      const lastMonthOrders = formattedOrders.filter(
        order => new Date(order.created_at) >= lastMonth
      );

      setStats({
        totalArtists: artistsWithCounts.length,
        totalOrders: lastMonthOrders.length,
        deliveredOrders: lastMonthOrders.filter(o => o.status === 'delivered').length,
        pendingOrders: lastMonthOrders.filter(o => o.status === 'pending').length,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteArtwork = async (artworkId: string) => {
    try {
      const { error } = await supabase
        .from('artworks')
        .delete()
        .eq('id', artworkId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Artwork deleted successfully",
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting artwork:', error);
      toast({
        title: "Error",
        description: "Failed to delete artwork",
        variant: "destructive",
      });
    }
  };

  const handleDeleteArtist = async (artistId: string) => {
    try {
      // First delete all artworks by this artist
      const { error: artworksError } = await supabase
        .from('artworks')
        .delete()
        .eq('artist_id', artistId);

      if (artworksError) throw artworksError;

      // Then delete the artist's profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', artistId);

      if (profileError) throw profileError;

      toast({
        title: "Success",
        description: "Artist and their artworks deleted successfully",
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting artist:', error);
      toast({
        title: "Error",
        description: "Failed to delete artist",
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/admin-auth');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  const pieData = [
    { name: 'Delivered', value: stats.deliveredOrders },
    { name: 'Pending', value: stats.pendingOrders },
  ];

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-[image:var(--gradient-artify)]">
            Admin Dashboard
          </h1>
          <Button onClick={handleSignOut} variant="outline">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Artists</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalArtists}</div>
              <p className="text-xs text-muted-foreground">Registered artists</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Orders (Last Month)</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrders}</div>
              <p className="text-xs text-muted-foreground">
                {stats.deliveredOrders} delivered, {stats.pendingOrders} pending
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalOrders > 0 
                  ? Math.round((stats.deliveredOrders / stats.totalOrders) * 100)
                  : 0}%
              </div>
              <p className="text-xs text-muted-foreground">Completion rate</p>
            </CardContent>
          </Card>
        </div>

        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Order Status Distribution (Last Month)</CardTitle>
            <CardDescription>Visual breakdown of order statuses</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
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

        {/* Real-time Orders */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders (Real-time)</CardTitle>
            <CardDescription>Live order updates from users</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Artwork</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No orders yet
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.slice(0, 10).map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{order.buyer_email}</TableCell>
                      <TableCell>{order.artwork_title}</TableCell>
                      <TableCell>₹{order.total_price}</TableCell>
                      <TableCell>₹{order.payment_amount}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          order.status === 'delivered' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {order.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Artists Section */}
        <Card>
          <CardHeader>
            <CardTitle>Artists</CardTitle>
            <CardDescription>Manage registered artists</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Artworks</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {artists.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No artists found
                    </TableCell>
                  </TableRow>
                ) : (
                  artists.map((artist) => (
                    <TableRow key={artist.id}>
                      <TableCell>{artist.full_name || 'N/A'}</TableCell>
                      <TableCell>{artist.email}</TableCell>
                      <TableCell>{artist.artworks_count}</TableCell>
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
                                This will permanently delete {artist.full_name || artist.email} and all their artworks. This action cannot be undone.
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
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* All Artworks Section */}
        <Card>
          <CardHeader>
            <CardTitle>All Artworks</CardTitle>
            <CardDescription>Manage all published artworks</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Artist</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {artworks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No artworks found
                    </TableCell>
                  </TableRow>
                ) : (
                  artworks.map((artwork) => (
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
                                This will permanently delete "{artwork.title}". This action cannot be undone.
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
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
