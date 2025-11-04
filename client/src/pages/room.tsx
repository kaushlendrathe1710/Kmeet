import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, MessageSquare, Users, Settings, Phone, Radio, Copy, Check, UserPlus } from "lucide-react";
import { VideoGrid } from "@/components/video-grid";
import { ChatPanel } from "@/components/chat-panel";
import { ParticipantsPanel } from "@/components/participants-panel";
import { SettingsPanel, type AudioSettings, type VideoSettings } from "@/components/settings-panel";
import { RecordingControls } from "@/components/recording-controls";
import { WaitingRoom } from "@/components/waiting-room";
import { JoinRequestsPanel } from "@/components/join-requests-panel";
import { useToast } from "@/hooks/use-toast";
import { MediaProcessor } from "@/lib/media-processor";
import type { Participant, ChatMessage } from "@shared/schema";

export default function Room() {
  const [, params] = useRoute("/room/:roomId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const roomId = params?.roomId || "";
  const [participantName] = useState(() => localStorage.getItem("participantName") || "Anonymous");
  const [participantId] = useState(() => Math.random().toString(36).substring(7));
  
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showJoinRequests, setShowJoinRequests] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [isWaitingApproval, setIsWaitingApproval] = useState(false);
  const [isHost, setIsHost] = useState(false);
  
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  
  const wsRef = useRef<WebSocket | null>(null);
  const peersRef = useRef<Map<string, any>>(new Map());
  const [duration, setDuration] = useState(0);
  const startTimeRef = useRef<number>(Date.now());
  const mediaProcessorRef = useRef<MediaProcessor | null>(null);
  const [processedStream, setProcessedStream] = useState<MediaStream | null>(null);
  const [videoSettings, setVideoSettings] = useState<VideoSettings>({
    brightness: 100,
    contrast: 100,
    saturation: 100,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!roomId) {
      setLocation("/");
      return;
    }

    initializeMedia();
    connectWebSocket();

    return () => {
      cleanup();
    };
  }, [roomId]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toLowerCase();
      
      switch (key) {
        case 'm':
          toggleAudio();
          break;
        case 'v':
          toggleVideo();
          break;
        case 's':
          toggleScreenShare();
          break;
        case 'r':
          if (isRecording) {
            stopRecording();
          } else {
            startRecording();
          }
          break;
        case 'c':
          setShowChat(prev => !prev);
          break;
        case 'p':
          setShowParticipants(prev => !prev);
          break;
        case 'f':
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            document.documentElement.requestFullscreen();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isRecording, isAudioEnabled, isVideoEnabled, isScreenSharing]);

  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1920, height: 1080 },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
        },
      });
      
      mediaProcessorRef.current = new MediaProcessor();
      const enhanced = mediaProcessorRef.current.initializeAudioProcessing(stream);
      
      setLocalStream(stream);
      setProcessedStream(enhanced);
      
      const localParticipant: Participant = {
        id: participantId,
        name: participantName,
        roomId,
        isAudioEnabled: true,
        isVideoEnabled: true,
        isScreenSharing: false,
        joinedAt: Date.now(),
      };
      
      setParticipants([localParticipant]);
    } catch (error) {
      console.error("Error accessing media devices:", error);
      toast({
        title: "Media Access Error",
        description: "Could not access camera or microphone.",
        variant: "destructive",
      });
    }
  };

  const handleAudioSettingsChange = (settings: AudioSettings) => {
    if (mediaProcessorRef.current) {
      mediaProcessorRef.current.setGain(settings.gainControl / 100);
      if (settings.noiseSuppressionEnabled) {
        mediaProcessorRef.current.setNoiseSuppressionIntensity(settings.noiseSuppression);
      }
    }
  };

  const handleVideoSettingsChange = (settings: VideoSettings) => {
    setVideoSettings(settings);
  };

  const connectWebSocket = () => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;
    
    console.log("Connecting to WebSocket:", wsUrl);
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log("WebSocket connected successfully");
      ws.send(JSON.stringify({
        type: "join-room",
        roomId,
        participantId,
        participantName,
      }));
    };

    ws.onmessage = (event) => {
      handleWebSocketMessage(JSON.parse(event.data));
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to the server. Please try again.",
        variant: "destructive",
      });
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
    };

    wsRef.current = ws;
  };

  const handleWebSocketMessage = (message: any) => {
    console.log("Received WebSocket message:", message.type);
    
    switch (message.type) {
      case "waiting-approval":
        setIsWaitingApproval(true);
        setIsHost(false);
        break;

      case "approval-granted":
        setIsWaitingApproval(false);
        setParticipants(message.participants);
        toast({
          title: "Approved!",
          description: "You have been approved to join the meeting",
        });
        break;

      case "approval-denied":
        toast({
          title: "Access Denied",
          description: message.message,
          variant: "destructive",
        });
        setTimeout(() => setLocation("/"), 2000);
        break;

      case "join-request":
        if (message.participant.id !== participantId) {
          setParticipants(prev => [...prev, message.participant]);
          toast({
            title: "New Join Request",
            description: `${message.participant.name} wants to join the meeting`,
          });
        }
        break;

      case "participant-approved":
        setParticipants(prev => prev.map(p =>
          p.id === message.participantId ? { ...p, approvalStatus: "approved" } : p
        ));
        break;

      case "participant-denied":
        setParticipants(prev => prev.filter(p => p.id !== message.participantId));
        break;

      case "removed-from-room":
        toast({
          title: "Removed from Room",
          description: message.message,
          variant: "destructive",
        });
        setTimeout(() => setLocation("/"), 2000);
        break;
      
      case "participant-left":
        setParticipants(prev => prev.filter(p => p.id !== message.participantId));
        setRemoteStreams(prev => {
          const newStreams = new Map(prev);
          newStreams.delete(message.participantId);
          return newStreams;
        });
        const peer = peersRef.current.get(message.participantId);
        if (peer) {
          peer.destroy();
          peersRef.current.delete(message.participantId);
        }
        toast({
          title: "Participant Left",
          description: `${message.participantName} left the meeting`,
        });
        break;
      
      case "participants-list":
        console.log("Received participants list:", message.participants);
        setIsHost(true);
        setIsWaitingApproval(false);
        setParticipants(message.participants);
        break;
      
      case "chat-message":
        setMessages(prev => [...prev, message.message]);
        break;
      
      case "audio-toggled":
        setParticipants(prev => prev.map(p => 
          p.id === message.participantId ? { ...p, isAudioEnabled: message.isEnabled } : p
        ));
        break;
      
      case "video-toggled":
        setParticipants(prev => prev.map(p => 
          p.id === message.participantId ? { ...p, isVideoEnabled: message.isEnabled } : p
        ));
        break;
    }
  };

  const approveParticipant = (targetParticipantId: string) => {
    wsRef.current?.send(JSON.stringify({
      type: "approve-participant",
      roomId,
      participantId,
      targetParticipantId,
    }));
  };

  const denyParticipant = (targetParticipantId: string) => {
    wsRef.current?.send(JSON.stringify({
      type: "deny-participant",
      roomId,
      participantId,
      targetParticipantId,
    }));
  };

  const removeParticipant = (targetParticipantId: string) => {
    wsRef.current?.send(JSON.stringify({
      type: "remove-participant",
      roomId,
      participantId,
      targetParticipantId,
    }));
    toast({
      title: "Participant Removed",
      description: "The participant has been removed from the room",
    });
  };

  const toggleAudio = async () => {
    if (isAudioEnabled) {
      console.log("🔇 Turning OFF microphone - STOPPING ALL AUDIO TRACKS NOW...");
      
      localStream?.getAudioTracks().forEach(track => {
        console.log("🛑 Stopping localStream audio track:", track.id);
        track.stop();
      });
      
      processedStream?.getAudioTracks().forEach(track => {
        console.log("🛑 Stopping processedStream audio track:", track.id);
        track.stop();
      });

      if (mediaProcessorRef.current) {
        mediaProcessorRef.current.cleanup();
        mediaProcessorRef.current = null;
      }

      const videoTracks = localStream?.getVideoTracks() || [];
      const newStream = new MediaStream(videoTracks);
      setLocalStream(newStream);
      setProcessedStream(newStream);
      setIsAudioEnabled(false);
      
      wsRef.current?.send(JSON.stringify({
        type: "toggle-audio",
        roomId,
        participantId,
        isEnabled: false,
      }));
      
      setParticipants(prev => prev.map(p => 
        p.id === participantId ? { ...p, isAudioEnabled: false } : p
      ));
      
      console.log("✅ ALL microphone tracks STOPPED - device is OFF");
    } else {
      console.log("🎤 Turning ON microphone - STARTING DEVICE NOW...");
      
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 48000,
          },
        });

        const audioTrack = audioStream.getAudioTracks()[0];
        console.log("✅ New microphone track started:", audioTrack.id);
        
        const videoTracks = localStream?.getVideoTracks() || [];
        const newStream = new MediaStream([...videoTracks, audioTrack]);
        setLocalStream(newStream);

        mediaProcessorRef.current = new MediaProcessor();
        const newProcessed = mediaProcessorRef.current.initializeAudioProcessing(newStream);
        setProcessedStream(newProcessed);

        setIsAudioEnabled(true);
        
        wsRef.current?.send(JSON.stringify({
          type: "toggle-audio",
          roomId,
          participantId,
          isEnabled: true,
        }));
        
        setParticipants(prev => prev.map(p => 
          p.id === participantId ? { ...p, isAudioEnabled: true } : p
        ));
        
        console.log("✅ Microphone is ON and working");
      } catch (error) {
        console.error("❌ Error enabling audio:", error);
        toast({
          title: "Microphone Error",
          description: "Could not access microphone.",
          variant: "destructive",
        });
      }
    }
  };

  const toggleVideo = async () => {
    if (isVideoEnabled) {
      console.log("📷 Turning OFF camera - STOPPING ALL VIDEO TRACKS NOW...");
      
      localStream?.getVideoTracks().forEach(track => {
        console.log("🛑 Stopping localStream video track:", track.id);
        track.stop();
      });
      
      processedStream?.getVideoTracks().forEach(track => {
        console.log("🛑 Stopping processedStream video track:", track.id);
        track.stop();
      });

      const audioTracks = processedStream?.getAudioTracks() || localStream?.getAudioTracks() || [];
      const newStream = new MediaStream(audioTracks);
      setLocalStream(new MediaStream(localStream?.getAudioTracks() || []));
      setProcessedStream(newStream);
      setIsVideoEnabled(false);
      
      wsRef.current?.send(JSON.stringify({
        type: "toggle-video",
        roomId,
        participantId,
        isEnabled: false,
      }));
      
      setParticipants(prev => prev.map(p => 
        p.id === participantId ? { ...p, isVideoEnabled: false } : p
      ));
      
      console.log("✅ ALL camera tracks STOPPED - device is OFF");
    } else {
      console.log("📹 Turning ON camera - STARTING DEVICE NOW...");
      
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1920, height: 1080 },
        });

        const videoTrack = videoStream.getVideoTracks()[0];
        console.log("✅ New camera track started:", videoTrack.id);
        
        const currentAudioTracks = localStream?.getAudioTracks() || [];
        const newLocalStream = new MediaStream([...currentAudioTracks, videoTrack]);
        setLocalStream(newLocalStream);

        const processedAudioTracks = processedStream?.getAudioTracks() || [];
        const newProcessedStream = new MediaStream([...processedAudioTracks, videoTrack]);
        setProcessedStream(newProcessedStream);

        setIsVideoEnabled(true);
        
        wsRef.current?.send(JSON.stringify({
          type: "toggle-video",
          roomId,
          participantId,
          isEnabled: true,
        }));
        
        setParticipants(prev => prev.map(p => 
          p.id === participantId ? { ...p, isVideoEnabled: true } : p
        ));
        
        console.log("✅ Camera is ON and working");
      } catch (error) {
        console.error("❌ Error enabling video:", error);
        toast({
          title: "Camera Error",
          description: "Could not access camera.",
          variant: "destructive",
        });
      }
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      screenStream?.getTracks().forEach(track => track.stop());
      setScreenStream(null);
      setIsScreenSharing(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1920, height: 1080 },
          audio: true,
        });
        setScreenStream(stream);
        setIsScreenSharing(true);
        
        stream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          setScreenStream(null);
        };
      } catch (error) {
        console.error("Error sharing screen:", error);
      }
    }
  };

  const sendMessage = (message: string) => {
    wsRef.current?.send(JSON.stringify({
      type: "chat-message",
      roomId,
      message,
      participantId,
      participantName,
    }));
  };

  const leaveRoom = () => {
    wsRef.current?.send(JSON.stringify({
      type: "leave-room",
      roomId,
      participantId,
    }));
    
    cleanup();
    setLocation("/");
  };

  const cleanup = () => {
    localStream?.getTracks().forEach(track => track.stop());
    screenStream?.getTracks().forEach(track => track.stop());
    processedStream?.getTracks().forEach(track => track.stop());
    
    peersRef.current.forEach(peer => {
      peer.destroy();
    });
    peersRef.current.clear();
    
    mediaProcessorRef.current?.cleanup();
    wsRef.current?.close();
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const copyRoomLink = async () => {
    const roomLink = `${window.location.origin}/room/${roomId}`;
    try {
      await navigator.clipboard.writeText(roomLink);
      setLinkCopied(true);
      toast({
        title: "Link Copied!",
        description: "Room link has been copied to clipboard",
      });
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
      toast({
        title: "Copy Failed",
        description: "Could not copy link to clipboard",
        variant: "destructive",
      });
    }
  };

  if (isWaitingApproval) {
    return <WaitingRoom roomId={roomId} participantName={participantName} />;
  }

  const pendingParticipants = participants.filter(p => p.approvalStatus === "pending");
  const approvedParticipants = participants.filter(p => p.approvalStatus === "approved");

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="h-16 border-b flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold" data-testid="text-room-name">Room: {roomId}</h1>
          <span className="text-sm text-muted-foreground font-mono" data-testid="text-duration">
            {formatDuration(duration)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={copyRoomLink}
            className="gap-2"
            data-testid="button-copy-link"
          >
            {linkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {linkCopied ? "Copied!" : "Copy Link"}
          </Button>
        </div>
        
        <div className="flex items-center gap-4">
          {isRecording && (
            <div className="flex items-center gap-2 text-destructive" data-testid="indicator-recording">
              <Radio className="w-4 h-4 animate-pulse-recording" />
              <span className="text-sm font-medium">Recording</span>
            </div>
          )}
          <span className="text-sm text-muted-foreground" data-testid="text-participant-count">
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col">
          <div className="flex-1 p-4 overflow-auto">
            <VideoGrid
              participants={approvedParticipants}
              localStream={processedStream || localStream}
              screenStream={screenStream}
              currentParticipantId={participantId}
              videoSettings={videoSettings}
              remoteStreams={remoteStreams}
            />
          </div>

          <div className="h-20 border-t bg-card/50 backdrop-blur-sm flex items-center justify-center px-6">
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant={isAudioEnabled ? "default" : "destructive"}
                onClick={toggleAudio}
                className="rounded-full w-12 h-12"
                data-testid="button-toggle-audio"
              >
                {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </Button>

              <Button
                size="icon"
                variant={isVideoEnabled ? "default" : "destructive"}
                onClick={toggleVideo}
                className="rounded-full w-12 h-12"
                data-testid="button-toggle-video"
              >
                {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </Button>

              <Button
                size="icon"
                variant={isScreenSharing ? "default" : "secondary"}
                onClick={toggleScreenShare}
                className="rounded-full w-12 h-12"
                data-testid="button-toggle-screen"
              >
                {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
              </Button>

              <RecordingControls
                isRecording={isRecording}
                onToggleRecording={() => setIsRecording(!isRecording)}
                localStream={processedStream || localStream}
              />

              <div className="w-px h-8 bg-border mx-2" />

              <Button
                size="icon"
                variant={showChat ? "default" : "secondary"}
                onClick={() => setShowChat(!showChat)}
                className="rounded-full w-12 h-12"
                data-testid="button-toggle-chat"
              >
                <MessageSquare className="w-5 h-5" />
              </Button>

              <Button
                size="icon"
                variant={showParticipants ? "default" : "secondary"}
                onClick={() => setShowParticipants(!showParticipants)}
                className="rounded-full w-12 h-12"
                data-testid="button-toggle-participants"
              >
                <Users className="w-5 h-5" />
              </Button>

              <Button
                size="icon"
                variant={showSettings ? "default" : "secondary"}
                onClick={() => setShowSettings(!showSettings)}
                className="rounded-full w-12 h-12"
                data-testid="button-toggle-settings"
              >
                <Settings className="w-5 h-5" />
              </Button>

              {isHost && (
                <div className="relative">
                  <Button
                    size="icon"
                    variant={showJoinRequests ? "default" : "secondary"}
                    onClick={() => setShowJoinRequests(!showJoinRequests)}
                    className="rounded-full w-12 h-12"
                    data-testid="button-toggle-requests"
                  >
                    <UserPlus className="w-5 h-5" />
                  </Button>
                  {pendingParticipants.length > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                      data-testid="badge-pending-count"
                    >
                      {pendingParticipants.length}
                    </Badge>
                  )}
                </div>
              )}

              <div className="w-px h-8 bg-border mx-2" />

              <Button
                size="icon"
                variant="destructive"
                onClick={leaveRoom}
                className="rounded-full w-12 h-12"
                data-testid="button-leave-room"
              >
                <Phone className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {showChat && (
          <ChatPanel
            messages={messages}
            onSendMessage={sendMessage}
            onClose={() => setShowChat(false)}
            currentParticipantId={participantId}
          />
        )}

        {showParticipants && (
          <ParticipantsPanel
            participants={approvedParticipants}
            currentParticipantId={participantId}
            isHost={isHost}
            onClose={() => setShowParticipants(false)}
            onRemoveParticipant={removeParticipant}
          />
        )}

        {showSettings && (
          <SettingsPanel
            onClose={() => setShowSettings(false)}
            onAudioSettingsChange={handleAudioSettingsChange}
            onVideoSettingsChange={handleVideoSettingsChange}
          />
        )}

        {showJoinRequests && isHost && (
          <JoinRequestsPanel
            pendingParticipants={pendingParticipants}
            onApprove={approveParticipant}
            onDeny={denyParticipant}
            onClose={() => setShowJoinRequests(false)}
          />
        )}
      </div>
    </div>
  );
}
