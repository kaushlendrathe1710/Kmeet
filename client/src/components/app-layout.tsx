import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import { LogOut, Shield, Video } from "lucide-react";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location, navigate] = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);

  const usesSharedLayout =
    location === "/dashboard" || location === "/profile";

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  if (!usesSharedLayout) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Video className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-xl font-bold">PodcastMeet</h1>
            </Link>

            <div className="flex items-center gap-3">
              {isAdmin && (
                <Button variant="outline" size="sm" asChild data-testid="link-admin">
                  <Link href="/admin">
                    <Shield className="h-4 w-4 mr-2" />
                    Admin
                  </Link>
                </Button>
              )}

              <Link href="/profile" className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {getInitials(user?.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium leading-none">
                    {user?.fullName || "User"}
                  </p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </Link>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsLogoutDialogOpen(true)}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
              <AlertDialog
                open={isLogoutDialogOpen}
                onOpenChange={setIsLogoutDialogOpen}
              >
                <AlertDialogOverlay className="fixed inset-0 bg-black/50" />
                <AlertDialogContent className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background rounded-lg p-6 w-full max-w-sm">
                  <AlertDialogTitle className="text-lg font-semibold">
                    Confirm Logout
                  </AlertDialogTitle>
                  <AlertDialogDescription className="mt-2 text-sm text-muted-foreground">
                    Are you sure you want to log out?
                  </AlertDialogDescription>
                  <div className="mt-4 flex justify-end gap-2">
                    <AlertDialogCancel asChild>
                      <Button variant="outline" data-testid="button-cancel-logout">
                        Cancel
                      </Button>
                    </AlertDialogCancel>
                    <AlertDialogAction asChild>
                      <Button
                        variant="destructive"
                        onClick={handleLogout}
                        data-testid="button-confirm-logout"
                      >
                        Log Out
                      </Button>
                    </AlertDialogAction>
                  </div>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
