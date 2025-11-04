import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, MessageSquare, Users, Settings, Phone, Radio } from "lucide-react";
import { VideoGrid } from "@/components/video-grid";
import { ChatPanel } from "@/components/chat-panel";
import { ParticipantsPanel } from "@/components/participants-panel";
import { SettingsPanel, type AudioSettings, type VideoSettings } from "@/components/settings-panel";
import { RecordingControls } from "@/components/recording-controls";
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
      case "participant-joined":
        if (message.participant.id !== participantId) {
          setParticipants(prev => {
            const exists = prev.find(p => p.id === message.participant.id);
            if (exists) return prev;
            return [...prev, message.participant];
          });
          
          toast({
            title: "Participant Joined",
            description: `${message.participant.name} joined the meeting`,
          });
        }
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
        setParticipants(prev => {
          const others = message.participants.filter((p: Participant) => p.id !== participantId);
          const me = prev.find(p => p.id === participantId);
          return me ? [me, ...others] : others;
        });
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

  const toggleAudio = async () => {
    if (isAudioEnabled) {
      console.log("🔇 Turning OFF microphone - STOPPING DEVICE NOW...");
      
      if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
          console.log("🛑 IMMEDIATELY STOPPING audio track:", audioTrack.id);
          audioTrack.stop();
          localStream.removeTrack(audioTrack);
        }
      }

      if (processedStream) {
        const processedAudioTrack = processedStream.getAudioTracks()[0];
        if (processedAudioTrack) {
          processedAudioTrack.stop();
          processedStream.removeTrack(processedAudioTrack);
        }
        setProcessedStream(new MediaStream(processedStream.getTracks()));
      }

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
      
      console.log("✅ Microphone STOPPED - device should be OFF");
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
        console.log("✅ IMMEDIATELY STARTED new audio track:", audioTrack.id);
        
        if (localStream) {
          localStream.addTrack(audioTrack);
        } else {
          setLocalStream(new MediaStream([audioTrack]));
        }

        if (mediaProcessorRef.current) {
          mediaProcessorRef.current.cleanup();
        }
        mediaProcessorRef.current = new MediaProcessor();
        const newProcessed = mediaProcessorRef.current.initializeAudioProcessing(
          localStream || new MediaStream([audioTrack])
        );
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
        
        console.log("✅ Microphone STARTED - device should be ON");
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
      console.log("📷 Turning OFF camera - STOPPING DEVICE NOW...");
      
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          console.log("🛑 IMMEDIATELY STOPPING video track:", videoTrack.id);
          videoTrack.stop();
          localStream.removeTrack(videoTrack);
        }
      }

      if (processedStream) {
        const processedVideoTrack = processedStream.getVideoTracks()[0];
        if (processedVideoTrack) {
          processedVideoTrack.stop();
          processedStream.removeTrack(processedVideoTrack);
        }
        setProcessedStream(new MediaStream(processedStream.getTracks()));
      }

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
      
      console.log("✅ Camera STOPPED - device should be OFF");
    } else {
      console.log("📹 Turning ON camera - STARTING DEVICE NOW...");
      
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1920, height: 1080 },
        });

        const videoTrack = videoStream.getVideoTracks()[0];
        console.log("✅ IMMEDIATELY STARTED new video track:", videoTrack.id);
        
        if (localStream) {
          localStream.addTrack(videoTrack);
        } else {
          setLocalStream(new MediaStream([videoTrack]));
        }

        if (processedStream) {
          const oldProcessedVideo = processedStream.getVideoTracks()[0];
          if (oldProcessedVideo) {
            processedStream.removeTrack(oldProcessedVideo);
          }
          processedStream.addTrack(videoTrack);
          setProcessedStream(new MediaStream(processedStream.getTracks()));
        }

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
        
        console.log("✅ Camera STARTED - device should be ON");
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

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="h-16 border-b flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold" data-testid="text-room-name">Room: {roomId}</h1>
          <span className="text-sm text-muted-foreground font-mono" data-testid="text-duration">
            {formatDuration(duration)}
          </span>
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
              participants={participants}
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
            participants={participants}
            onClose={() => setShowParticipants(false)}
          />
        )}

        {showSettings && (
          <SettingsPanel
            onClose={() => setShowSettings(false)}
            onAudioSettingsChange={handleAudioSettingsChange}
            onVideoSettingsChange={handleVideoSettingsChange}
          />
        )}
      </div>
    </div>
  );
}
