import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Video,
  Plus,
  ArrowRight,
  History,
  Film,
  Settings,
  LogOut,
  Crown,
  Calendar,
  Clock,
  Users,
  Shield,
} from "lucide-react";
import type { Recording, MeetingHistory } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";

function generateMeetingId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function DashboardPage() {
  const [, navigate] = useLocation();
  const { user, subscription, logout, isAdmin } = useAuth();
  const [meetingCode, setMeetingCode] = useState("");
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);

  const { data: recordingsData } = useQuery<{ recordings: Recording[] }>({
    queryKey: ["/api/recordings"],
    enabled: !!user,
  });

  const { data: meetingsData } = useQuery<{ meetings: MeetingHistory[] }>({
    queryKey: ["/api/users/meetings"],
    enabled: !!user,
  });

  const handleNewMeeting = () => {
    const roomId = generateMeetingId();
    navigate(`/room/${roomId}`);
  };

  const handleJoinMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (meetingCode.trim()) {
      navigate(`/room/${meetingCode.trim().toUpperCase()}`);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const recordings = recordingsData?.recordings || [];
  const meetings = meetingsData?.meetings || [];

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

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
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  data-testid="link-admin"
                >
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
                  <p className="text-sm font-medium leading-none">{user?.fullName || "User"}</p>
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
                      <Button
                        variant="outline"
                        data-testid="button-cancel-logout"
                      >
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

      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <Card
                className="hover-elevate cursor-pointer"
                onClick={handleNewMeeting}
                data-testid="card-new-meeting"
              >
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-primary/10 p-4 rounded-xl">
                      <Plus className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">New Meeting</h3>
                      <p className="text-sm text-muted-foreground">
                        Start an instant meeting
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <form
                    onSubmit={handleJoinMeeting}
                    className="flex items-center gap-2"
                  >
                    <Input
                      placeholder="Enter meeting code"
                      value={meetingCode}
                      onChange={(e) =>
                        setMeetingCode(e.target.value.toUpperCase())
                      }
                      className="font-mono tracking-wide"
                      data-testid="input-meeting-code"
                    />
                    <Button
                      type="submit"
                      disabled={!meetingCode.trim()}
                      data-testid="button-join-meeting"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">Recent Meetings</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {meetings.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No meeting history yet. Start your first meeting!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {meetings.slice(0, 5).map((meeting) => (
                      <div
                        key={meeting.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover-elevate cursor-pointer"
                        onClick={() => navigate(`/room/${meeting.roomId}`)}
                        data-testid={`meeting-history-${meeting.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-background p-2 rounded-lg">
                            <Video className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium font-mono">
                              {meeting.roomId}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>
                                {new Date(
                                  meeting.joinedAt,
                                ).toLocaleDateString()}
                              </span>
                              <Clock className="h-3 w-3 ml-2" />
                              <span>
                                {meeting.duration
                                  ? `${Math.round(meeting.duration / 60)}min`
                                  : "-"}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Badge
                          variant={meeting.wasHost ? "default" : "secondary"}
                        >
                          {meeting.wasHost ? "Host" : "Guest"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Film className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">My Recordings</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {recordings.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No recordings yet. Record your meetings to save them here.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {recordings.slice(0, 5).map((recording) => (
                      <div
                        key={recording.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        data-testid={`recording-${recording.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-background p-2 rounded-lg">
                            <Film className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{recording.fileName}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(
                                recording.createdAt,
                              ).toLocaleDateString()}{" "}
                              ·{Math.round(recording.duration / 60)}min
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`button-download-${recording.id}`}
                        >
                          Download
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-500" />
                  Subscription
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {subscription ? (
                  <>
                    <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                      <p className="font-semibold text-lg">
                        {subscription.plan?.name || "Unknown Plan"}
                      </p>
                      <Badge
                        className="mt-2"
                        variant={
                          subscription.status === "active"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {subscription.status}
                      </Badge>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Recording Minutes
                        </span>
                        <span>
                          {subscription.recordingMinutesUsed} /{" "}
                          {subscription.plan?.maxRecordingMinutes || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Max Participants
                        </span>
                        <span>{subscription.plan?.maxParticipants || 10}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Expires</span>
                        <span>
                          {new Date(subscription.endDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground mb-4">
                      No active subscription
                    </p>
                    <Button className="w-full" data-testid="button-view-plans">
                      View Plans
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  Quick Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{meetings.length}</p>
                    <p className="text-xs text-muted-foreground">Meetings</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{recordings.length}</p>
                    <p className="text-xs text-muted-foreground">Recordings</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  data-testid="button-settings"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Account Settings
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
