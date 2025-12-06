import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Settings,
  Copy,
  Check,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudio, setSelectedAudio] = useState("");
  const [selectedVideo, setSelectedVideo] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [copied, setCopied] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    loadDevices();
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (stream && videoRef.current && isVideoEnabled) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, isVideoEnabled]);

  useEffect(() => {
    if (selectedAudio || selectedVideo) {
      startPreview();
    }
  }, [selectedAudio, selectedVideo]);

  const loadDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audio = devices.filter((d) => d.kind === "audioinput");
      const video = devices.filter((d) => d.kind === "videoinput");

      setAudioDevices(audio);
      setVideoDevices(video);

      if (audio.length > 0) setSelectedAudio(audio[0].deviceId);
      if (video.length > 0) setSelectedVideo(video[0].deviceId);
    } catch (error) {
      console.error("Error loading devices:", error);
    }
  };

  const startPreview = async () => {
    try {
      stream?.getTracks().forEach((track) => track.stop());
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: selectedVideo ? { deviceId: selectedVideo } : true,
        audio: selectedAudio ? { deviceId: selectedAudio } : true,
      });
      setStream(mediaStream);

      loadDevices();
    } catch (error) {
      console.error("Error starting preview:", error);
      toast({
        title: "Camera/Microphone Error",
        description: "Please allow camera and microphone access to continue.",
        variant: "destructive",
      });
    }
  };

  const toggleVideo = async () => {
    if (!stream) return;

    if (isVideoEnabled) {
      // TURN OFF: Stop camera hardware
      stream.getVideoTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
      setIsVideoEnabled(false);
      console.log("Camera OFF");
    } else {
      // TURN ON: Get fresh camera
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: selectedVideo ? { deviceId: { exact: selectedVideo } } : true,
        });
        const newVideoTrack = newStream.getVideoTracks()[0];
        const combined = new MediaStream([
          newVideoTrack,
          ...stream.getAudioTracks(),
        ]);
        setStream(combined);
        if (videoRef.current) videoRef.current.srcObject = combined;
        setIsVideoEnabled(true);
        console.log("Camera ON");
      } catch (err) {
        console.error("Camera error:", err);
        toast({
          title: "Camera Error",
          description: "Cannot access camera.",
          variant: "destructive",
        });
      }
    }
  };

  const toggleAudio = async () => {
    if (!stream) return;

    if (isAudioEnabled) {
      // TURN OFF: Stop microphone hardware
      stream.getAudioTracks().forEach((track) => track.stop());
      setIsAudioEnabled(false);
      console.log("Microphone OFF");
    } else {
      // TURN ON: Get fresh microphone
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: selectedAudio ? { deviceId: { exact: selectedAudio } } : true,
        });
        const newAudioTrack = newStream.getAudioTracks()[0];
        const combined = new MediaStream([
          ...stream.getVideoTracks(),
          newAudioTrack,
        ]);
        setStream(combined);
        if (videoRef.current) videoRef.current.srcObject = combined;
        setIsAudioEnabled(true);
        console.log("Microphone ON");
      } catch (err) {
        console.error("Microphone error:", err);
        toast({
          title: "Microphone Error",
          description: "Cannot access microphone.",
          variant: "destructive",
        });
      }
    }
  };

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  };

  const createRoom = () => {
    if (!name.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter your name to continue.",
        variant: "destructive",
      });
      return;
    }

    const newRoomCode = generateRoomCode();
    localStorage.setItem("participantName", name);
    setLocation(`/room/${newRoomCode}`);
  };

  const joinRoom = () => {
    if (!name.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter your name to continue.",
        variant: "destructive",
      });
      return;
    }

    if (!roomCode.trim()) {
      toast({
        title: "Room Code Required",
        description: "Please enter a room code to join.",
        variant: "destructive",
      });
      return;
    }

    localStorage.setItem("participantName", name);
    setLocation(`/room/${roomCode.toUpperCase()}`);
  };

  const copyRoomCode = async () => {
    const code = generateRoomCode();
    await navigator.clipboard.writeText(code);
    setRoomCode(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Room Code Copied",
      description: "Share this code with participants to join your meeting.",
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid md:grid-cols-2 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-2xl">Video Preview</CardTitle>
            <CardDescription>
              Test your camera and microphone before joining
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
              {isVideoEnabled ? (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  data-testid="video-preview"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center bg-muted"
                  data-testid="video-off-state"
                >
                  <VideoOff className="w-16 h-16 text-muted-foreground" />
                </div>
              )}

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                <Button
                  size="icon"
                  variant={isAudioEnabled ? "default" : "destructive"}
                  onClick={toggleAudio}
                  className="rounded-full"
                  data-testid="button-toggle-audio-preview"
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
                  data-testid="button-toggle-video-preview"
                >
                  {isVideoEnabled ? (
                    <Video className="w-5 h-5" />
                  ) : (
                    <VideoOff className="w-5 h-5" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="audio-device">Microphone</Label>
                <Select value={selectedAudio} onValueChange={setSelectedAudio}>
                  <SelectTrigger
                    id="audio-device"
                    data-testid="select-audio-device"
                  >
                    <SelectValue placeholder="Select microphone" />
                  </SelectTrigger>
                  <SelectContent>
                    {audioDevices.map((device, index) => (
                      <SelectItem
                        key={device.deviceId || `audio-${index}`}
                        value={device.deviceId || `audio-${index}`}
                      >
                        {device.label || `Microphone ${index + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="video-device">Camera</Label>
                <Select value={selectedVideo} onValueChange={setSelectedVideo}>
                  <SelectTrigger
                    id="video-device"
                    data-testid="select-video-device"
                  >
                    <SelectValue placeholder="Select camera" />
                  </SelectTrigger>
                  <SelectContent>
                    {videoDevices.map((device, index) => (
                      <SelectItem
                        key={device.deviceId || `video-${index}`}
                        value={device.deviceId || `video-${index}`}
                      >
                        {device.label || `Camera ${index + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-4xl font-bold">PodcastMeet</CardTitle>
              <CardDescription className="text-base">
                Professional video conferencing for podcast recording
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Your Name</Label>
                <Input
                  id="name"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="input-name"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Create New Meeting</CardTitle>
              <CardDescription>
                Start a new podcast recording session
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={createRoom}
                className="w-full"
                size="lg"
                data-testid="button-create-room"
              >
                Create Meeting Room
              </Button>

              <div className="flex gap-2">
                <Button
                  onClick={copyRoomCode}
                  variant="outline"
                  className="flex-1"
                  data-testid="button-generate-code"
                >
                  {copied ? (
                    <Check className="w-4 h-4 mr-2" />
                  ) : (
                    <Copy className="w-4 h-4 mr-2" />
                  )}
                  Generate Room Code
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Join Meeting</CardTitle>
              <CardDescription>
                Enter a room code to join an existing session
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="room-code">Room Code</Label>
                <Input
                  id="room-code"
                  placeholder="Enter room code"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  className="font-mono text-lg"
                  data-testid="input-room-code"
                />
              </div>
              <Button
                onClick={joinRoom}
                className="w-full"
                variant="secondary"
                size="lg"
                data-testid="button-join-room"
              >
                Join Meeting
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
