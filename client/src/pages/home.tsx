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
import { Video, VideoOff, Mic, MicOff, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");

  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudio, setSelectedAudio] = useState("");
  const [selectedVideo, setSelectedVideo] = useState("");

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [copied, setCopied] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  //
  // INITIAL DEVICE LOAD
  //
  const loadDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audio = devices.filter((d) => d.kind === "audioinput");
      const video = devices.filter((d) => d.kind === "videoinput");

      setAudioDevices(audio);
      setVideoDevices(video);

      if (!selectedAudio && audio.length > 0)
        setSelectedAudio(audio[0].deviceId);
      if (!selectedVideo && video.length > 0)
        setSelectedVideo(video[0].deviceId);
    } catch (err) {
      console.error("Error loading devices:", err);
    }
  };

  //
  // START INITIAL PREVIEW
  //
  const startInitialPreview = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: selectedVideo ? { deviceId: { exact: selectedVideo } } : true,
        audio: selectedAudio ? { deviceId: { exact: selectedAudio } } : true,
      });

      setStream(mediaStream);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
    } catch (err) {
      console.error("Error starting preview:", err);
      toast({
        title: "Camera/Microphone Error",
        description: "Please allow camera and microphone access.",
        variant: "destructive",
      });
    }
  };

  //
  // ON MOUNT
  //
  useEffect(() => {
    loadDevices();
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  //
  // START PREVIEW AFTER DEVICES LOAD
  //
  useEffect(() => {
    if (selectedAudio && selectedVideo) startInitialPreview();
  }, [selectedAudio, selectedVideo]);

  //
  // UPDATE VIDEO ELEMENT IF STREAM CHANGES
  //
  useEffect(() => {
    if (stream && videoRef.current && isVideoEnabled) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, isVideoEnabled]);

  //
  // SWITCH MICROPHONE ONLY (DO NOT TOUCH CAMERA)
  //
  const switchAudioDevice = async (deviceId: string) => {
    setSelectedAudio(deviceId);

    try {
      const newAudioStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
      });

      const newAudioTrack = newAudioStream.getAudioTracks()[0];
      const videoTracks = stream?.getVideoTracks() ?? [];

      // Stop previous audio
      stream?.getAudioTracks().forEach((t) => t.stop());

      const combined = new MediaStream([...videoTracks, newAudioTrack]);
      setStream(combined);

      if (videoRef.current) videoRef.current.srcObject = combined;
    } catch (err) {
      console.error("Error switching audio:", err);
    }
  };

  //
  // SWITCH CAMERA ONLY (DO NOT TOUCH MICROPHONE)
  //
  const switchVideoDevice = async (deviceId: string) => {
    setSelectedVideo(deviceId);

    try {
      const newVideoStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
      });

      const newVideoTrack = newVideoStream.getVideoTracks()[0];
      const audioTracks = stream?.getAudioTracks() ?? [];

      // Stop previous video
      stream?.getVideoTracks().forEach((t) => t.stop());

      const combined = new MediaStream([newVideoTrack, ...audioTracks]);
      setStream(combined);

      if (videoRef.current) videoRef.current.srcObject = combined;
    } catch (err) {
      console.error("Error switching video:", err);
    }
  };

  //
  // TOGGLE CAMERA
  //
  const toggleVideo = async () => {
    if (!stream) return;

    const videoTrack = stream.getVideoTracks()[0];

    // TURN CAMERA OFF (STOP HARDWARE)
    if (isVideoEnabled) {
      if (videoTrack) videoTrack.stop();
      const audioTracks = stream.getAudioTracks();
      const newStream = new MediaStream(audioTracks);
      setStream(newStream);

      if (videoRef.current) videoRef.current.srcObject = null;

      setIsVideoEnabled(false);
      return;
    }

    // TURN CAMERA ON (GET NEW HARDWARE)
    try {
      const newVideoStream = await navigator.mediaDevices.getUserMedia({
        video: selectedVideo ? { deviceId: { exact: selectedVideo } } : true,
      });

      const newVideoTrack = newVideoStream.getVideoTracks()[0];
      const audioTracks = stream.getAudioTracks();
      const combined = new MediaStream([newVideoTrack, ...audioTracks]);

      setStream(combined);
      if (videoRef.current) videoRef.current.srcObject = combined;

      setIsVideoEnabled(true);
    } catch (err) {
      console.error("Camera error:", err);
    }
  };

  //
  // TOGGLE MICROPHONE
  //
  const toggleAudio = async () => {
    if (!stream) return;

    const audioTrack = stream.getAudioTracks()[0];

    // TURN MIC OFF (STOP HARDWARE)
    if (isAudioEnabled) {
      if (audioTrack) audioTrack.stop();
      const videoTracks = stream.getVideoTracks();
      const newStream = new MediaStream(videoTracks);
      setStream(newStream);
      if (videoRef.current) videoRef.current.srcObject = newStream;

      setIsAudioEnabled(false);
      return;
    }

    // TURN MIC ON (GET NEW HARDWARE)
    try {
      const newAudioStream = await navigator.mediaDevices.getUserMedia({
        audio: selectedAudio ? { deviceId: { exact: selectedAudio } } : true,
      });

      const newAudioTrack = newAudioStream.getAudioTracks()[0];
      const videoTracks = stream.getVideoTracks();
      const combined = new MediaStream([...videoTracks, newAudioTrack]);

      setStream(combined);
      if (videoRef.current) videoRef.current.srcObject = combined;

      setIsAudioEnabled(true);
    } catch (err) {
      console.error("Mic error:", err);
    }
  };

  //
  // ROOM UTILITIES
  //
  const generateRoomCode = () =>
    Math.random().toString(36).substring(2, 10).toUpperCase();

  const createRoom = () => {
    if (!name.trim()) {
      return toast({
        title: "Name Required",
        description: "Please enter your name.",
        variant: "destructive",
      });
    }
    const code = generateRoomCode();
    localStorage.setItem("participantName", name);
    setLocation(`/room/${code}`);
  };

  const joinRoom = () => {
    if (!name.trim()) {
      return toast({
        title: "Name Required",
        description: "Please enter your name.",
        variant: "destructive",
      });
    }
    if (!roomCode.trim()) {
      return toast({
        title: "Room Code Required",
        description: "Please enter a room code.",
        variant: "destructive",
      });
    }

    localStorage.setItem("participantName", name);
    setLocation(`/room/${roomCode.toUpperCase()}`);
  };

  const copyRoomCode = async () => {
    const code = generateRoomCode();
    await navigator.clipboard.writeText(code);
    setRoomCode(code);
    setCopied(true);

    setTimeout(() => setCopied(false), 1500);
    toast({
      title: "Room Code Copied",
      description: "Share this with participants.",
    });
  };

  //
  // UI
  //
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid md:grid-cols-2 gap-6">
        {/* VIDEO PREVIEW */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Video Preview</CardTitle>
            <CardDescription>Test your camera and microphone</CardDescription>
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
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <VideoOff className="w-16 h-16 text-muted-foreground" />
                </div>
              )}

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                <Button size="icon" onClick={toggleAudio}>
                  {isAudioEnabled ? <Mic /> : <MicOff />}
                </Button>

                <Button size="icon" onClick={toggleVideo}>
                  {isVideoEnabled ? <Video /> : <VideoOff />}
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Microphone</Label>
                <Select value={selectedAudio} onValueChange={switchAudioDevice}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select microphone" />
                  </SelectTrigger>
                  <SelectContent>
                    {audioDevices.map((d, i) => (
                      <SelectItem
                        key={d.deviceId}
                        value={d.deviceId || "device not found"}
                      >
                        {d.label || `Microphone ${i + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Camera</Label>
                <Select value={selectedVideo} onValueChange={switchVideoDevice}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select camera" />
                  </SelectTrigger>
                  <SelectContent>
                    {videoDevices.map((d, i) => (
                      <SelectItem
                        key={d.deviceId}
                        value={d.deviceId || "device not found"}
                      >
                        {d.label || `Camera ${i + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* RIGHT SIDE */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-4xl font-bold">PodcastMeet</CardTitle>
              <CardDescription>Professional podcast recording</CardDescription>
            </CardHeader>

            <CardContent>
              <Label>Your Name</Label>
              <Input
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Create New Meeting</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <Button onClick={createRoom} className="w-full" size="lg">
                Create Meeting Room
              </Button>

              <Button
                onClick={copyRoomCode}
                className="w-full"
                variant="outline"
              >
                {copied ? (
                  <Check className="mr-2" />
                ) : (
                  <Copy className="mr-2" />
                )}
                Generate Room Code
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Join Meeting</CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <Label>Room Code</Label>
              <Input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Enter room code"
                className="font-mono text-lg"
              />

              <Button onClick={joinRoom} size="lg" className="w-full">
                Join Meeting
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
