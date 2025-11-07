import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Shield, LogOut } from "lucide-react";
import Navbar from "@/components/Navbar";
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

interface Artist {
  id: string;
  email: string;
  full_name: string;
  artworks_count: number;
}

interface Artwork {
  id: string;
  title: string;
  artist_id: string;
  artist_name: string;
  price: number;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
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
        navigate('/');
        return;
      }

      await fetchData();
    } catch (error) {
      console.error('Error checking admin access:', error);
      navigate('/admin-auth');
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch artists
      const { data: artistsData, error: artistsError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
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

      // Fetch all artworks
      const { data: artworksData, error: artworksError } = await supabase
        .from('artworks')
        .select(`
          id,
          title,
          price,
          artist_id,
          profiles!artworks_artist_id_fkey(full_name)
        `);

      if (artworksError) throw artworksError;

      const formattedArtworks = (artworksData || []).map((artwork: any) => ({
        id: artwork.id,
        title: artwork.title,
        price: artwork.price,
        artist_id: artwork.artist_id,
        artist_name: artwork.profiles?.full_name || 'Unknown',
      }));

      setArtworks(formattedArtworks);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch data.",
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
        description: "Artwork deleted successfully.",
      });

      await fetchData();
    } catch (error) {
      console.error('Error deleting artwork:', error);
      toast({
        title: "Error",
        description: "Failed to delete artwork.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteArtist = async (artistId: string) => {
    try {
      // Delete artist's artworks first
      const { error: artworksError } = await supabase
        .from('artworks')
        .delete()
        .eq('artist_id', artistId);

      if (artworksError) throw artworksError;

      // Delete artist profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', artistId);

      if (profileError) throw profileError;

      toast({
        title: "Success",
        description: "Artist and all their artworks deleted successfully.",
      });

      await fetchData();
    } catch (error) {
      console.error('Error deleting artist:', error);
      toast({
        title: "Error",
        description: "Failed to delete artist.",
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
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <p className="text-center">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Admin Dashboard</h1>
          </div>
          <Button onClick={handleSignOut} variant="outline">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Artists ({artists.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {artists.map((artist) => (
                  <div key={artist.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-semibold">{artist.full_name}</p>
                      <p className="text-sm text-muted-foreground">{artist.email}</p>
                      <p className="text-xs text-muted-foreground">{artist.artworks_count} artworks</p>
                    </div>
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
                            This will permanently delete {artist.full_name} and all their artworks. This action cannot be undone.
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
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>All Artworks ({artworks.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {artworks.map((artwork) => (
                  <div key={artwork.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-semibold">{artwork.title}</p>
                      <p className="text-sm text-muted-foreground">by {artwork.artist_name}</p>
                      <p className="text-sm font-medium">₹{artwork.price}</p>
                    </div>
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
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
