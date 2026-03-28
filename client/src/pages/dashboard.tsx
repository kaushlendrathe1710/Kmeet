import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { useDevicePreview } from "@/hooks/use-device-preview";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Plus,
  ArrowRight,
  History,
  Film,
  Settings,
  Crown,
  Calendar,
  Clock,
  Users,
} from "lucide-react";
import type { Recording, MeetingHistory } from "@shared/schema";

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
  const { user, subscription } = useAuth();
  const [meetingCode, setMeetingCode] = useState("");
  const [isPreJoinOpen, setIsPreJoinOpen] = useState(false);

  const {
    stream,
    audioDevices,
    videoDevices,
    selectedAudio,
    setSelectedAudio,
    selectedVideo,
    setSelectedVideo,
    isAudioEnabled,
    isVideoEnabled,
    toggleAudio,
    toggleVideo,
    error: previewError,
    clearError,
  } = useDevicePreview({ active: isPreJoinOpen });

  const { data: recordingsData } = useQuery<{ recordings: Recording[] }>({
    queryKey: ["/api/recordings"],
    enabled: !!user,
  });

  const { data: meetingsData } = useQuery<{ meetings: MeetingHistory[] }>({
    queryKey: ["/api/users/meetings"],
    enabled: !!user,
  });

  const handleNewMeeting = () => {
    setIsPreJoinOpen(true);
  };

  const handleContinueToMeeting = () => {
    const roomId = generateMeetingId();
    const displayName = user?.fullName || user?.email || "Anonymous";
    localStorage.setItem("participantName", displayName);
    localStorage.setItem(
      "podcastmeet_prejoin_media_prefs",
      JSON.stringify({
        isAudioEnabled,
        isVideoEnabled,
        selectedAudio,
        selectedVideo,
      })
    );
    setIsPreJoinOpen(false);
    navigate(`/room/${roomId}`);
  };

  const handleJoinMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (meetingCode.trim()) {
      navigate(`/room/${meetingCode.trim().toUpperCase()}`);
    }
  };

  const recordings = recordingsData?.recordings || [];
  const meetings = meetingsData?.meetings || [];

  const displayName = user?.fullName || user?.email || "Anonymous";

  return (
    <>
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

      <Dialog
        open={isPreJoinOpen}
        onOpenChange={(open) => {
          setIsPreJoinOpen(open);
          if (!open) {
            clearError();
          }
        }}
      >
        <DialogContent className="max-w-3xl" data-testid="dialog-prejoin-meeting">
          <DialogHeader>
            <DialogTitle>Prepare before joining</DialogTitle>
            <DialogDescription>
              Check your camera, microphone, and devices before starting the meeting.
            </DialogDescription>
          </DialogHeader>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                {isVideoEnabled && stream ? (
                  <video
                    autoPlay
                    muted
                    playsInline
                    ref={(node) => {
                      if (node && stream) {
                        node.srcObject = stream;
                      }
                    }}
                    className="w-full h-full object-cover"
                    data-testid="video-preview-dashboard"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <VideoOff className="w-16 h-16 text-muted-foreground" />
                  </div>
                )}

                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  <Button
                    size="icon"
                    variant={isAudioEnabled ? "default" : "destructive"}
                    onClick={toggleAudio}
                    className="rounded-full"
                    type="button"
                    data-testid="button-toggle-audio-prejoin"
                  >
                    {isAudioEnabled ? (
                      <Mic className="w-5 h-5" />
                    ) : (
                      <MicOff className="w-5 h-5" />
                    )}
                  </Button>

                  <Button
                    size="icon"
                    variant={isVideoEnabled ? "default" : "destructive"}
                    onClick={toggleVideo}
                    className="rounded-full"
                    type="button"
                    data-testid="button-toggle-video-prejoin"
                  >
                    {isVideoEnabled ? (
                      <Video className="w-5 h-5" />
                    ) : (
                      <VideoOff className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>

              {previewError && (
                <p className="text-sm text-destructive" data-testid="text-prejoin-error">
                  {previewError}
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="display-name">Name (visible to others)</Label>
                <Input id="display-name" value={displayName} disabled readOnly />
              </div>

              <div className="space-y-2">
                <Label htmlFor="audio-device">Microphone</Label>
                <Select value={selectedAudio} onValueChange={setSelectedAudio}>
                  <SelectTrigger id="audio-device" data-testid="select-audio-device-prejoin">
                    <SelectValue placeholder="Select microphone" />
                  </SelectTrigger>
                  <SelectContent>
                    {audioDevices.map((device, index) => {
                      const value = device.deviceId || `audio-${index}`;
                      return (
                        <SelectItem key={value} value={value}>
                          {device.label || `Microphone ${index + 1}`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="video-device">Camera</Label>
                <Select value={selectedVideo} onValueChange={setSelectedVideo}>
                  <SelectTrigger id="video-device" data-testid="select-video-device-prejoin">
                    <SelectValue placeholder="Select camera" />
                  </SelectTrigger>
                  <SelectContent>
                    {videoDevices.map((device, index) => {
                      const value = device.deviceId || `video-${index}`;
                      return (
                        <SelectItem key={value} value={value}>
                          {device.label || `Camera ${index + 1}`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPreJoinOpen(false)}
              type="button"
            >
              Cancel
            </Button>
            <Button onClick={handleContinueToMeeting} type="button" data-testid="button-continue-to-meeting">
              Start Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
