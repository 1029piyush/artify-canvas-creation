import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Palette, LogOut, User, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { User as SupabaseUser } from "@supabase/supabase-js";

const Navbar = () => {
  const location = useLocation();
  const { toast } = useToast();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [userType, setUserType] = useState<string | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserType(session.user.id);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserType(session.user.id);
      } else {
        setUserType(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserType = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("user_type")
      .eq("id", userId)
      .single();

    if (data) {
      setUserType(data.user_type);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Signed out successfully",
      });
    }
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/20 bg-white/70 backdrop-blur-lg supports-[backdrop-filter]:bg-white/60 shadow-sm">
      <div className="container flex h-16 items-center justify-between">
        {/* 🌈 Brand Logo Section */}
        <Link
          to="/"
          className="flex items-center gap-2 transition-transform hover:scale-105 group"
        >
          <div className="relative flex items-center">
            {/* Gradient shimmer logo */}
            <span className="text-3xl font-extrabold bg-gradient-to-r from-indigo-500 via-sky-500 to-amber-400 bg-clip-text text-transparent animate-gradient-x">
              Artify
            </span>

            {/* Sparkle icon */}
            <span className="ml-1 text-lg text-indigo-400 drop-shadow-[0_0_6px_rgba(99,102,241,0.6)] animate-pulse">
              ✦
            </span>

            {/* Hover underline */}
            <span className="absolute -bottom-1 left-0 w-full h-[2px] bg-gradient-to-r from-indigo-400/40 via-sky-400/60 to-amber-300/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></span>
          </div>
        </Link>

        {/* 🔘 Navigation Buttons */}
        <div className="flex items-center gap-4">
          {user ? (
            <>
              {userType === "artist" && (
                <Button asChild variant="ghost">
                  <Link to="/artist-dashboard">
                    <Palette className="mr-2 h-4 w-4" />
                    Dashboard
                  </Link>
                </Button>
              )}

              <Button asChild variant="ghost">
                <Link to="/custom-art">
                  <Palette className="mr-2 h-4 w-4" />
                  Custom Art
                </Link>
              </Button>

              {userType === "buyer" && (
                <>
                  <Button asChild variant="ghost" className="relative">
                    <Link to="/cart">
                      <ShoppingCart className="h-5 w-5" />
                    </Link>
                  </Button>

                  <Button asChild variant="ghost">
                    <Link to="/orders">
                      <Package className="mr-2 h-4 w-4" />
                      Orders
                    </Link>
                  </Button>
                </>
              )}

              <Button asChild variant="ghost">
                <Link to="/profile">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </Button>

              <Button onClick={handleSignOut} variant="outline">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link to="/auth">Sign In</Link>
              </Button>
              <Button asChild>
                <Link to="/auth">Get Started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
