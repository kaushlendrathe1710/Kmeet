import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, MessageSquare, Users, Settings, Phone, Radio, Copy, Check, UserPlus, Hand, Smile, Grid3x3, UserCircle, Lock, LockOpen, ArrowRightLeft, Maximize, Minimize, Wand2, FileUp, User, LayoutGrid } from "lucide-react";
import { VideoGrid, type ViewMode } from "@/components/video-grid";
import { ChatPanel } from "@/components/chat-panel";
import { ParticipantsPanel } from "@/components/participants-panel";
import { SettingsPanel, type AudioSettings, type VideoSettings } from "@/components/settings-panel";
import { FileSharing } from "@/components/file-sharing";
import { RecordingControls } from "@/components/recording-controls";
import { WaitingRoom } from "@/components/waiting-room";
import { JoinRequestsPanel } from "@/components/join-requests-panel";
import { EmojiReactionsContainer } from "@/components/emoji-reaction";
import { AudioWaveform } from "@/components/audio-waveform";
import { NetworkQualityIndicator } from "@/components/network-quality-indicator";
import { QualitySelector } from "@/components/quality-selector";
import { PresetSelector } from "@/components/preset-selector";
import { useToast } from "@/hooks/use-toast";
import { MediaProcessor } from "@/lib/media-processor";
import { BackgroundProcessor, type BackgroundSettings } from "@/lib/background-processor";
import { BackgroundControls } from "@/components/background-controls";
import { useNetworkQuality } from "@/hooks/use-network-quality";
import { useBandwidthAdaptation, VIDEO_QUALITY_CONSTRAINTS, type VideoQualityLevel } from "@/hooks/use-bandwidth-adaptation";
import { QUALITY_PRESETS, type QualityPreset } from "@/lib/quality-presets";
import { useAutoSave, recoverRoomState, clearSavedRoomState } from "@/hooks/use-auto-save";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [canRecord, setCanRecord] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showJoinRequests, setShowJoinRequests] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [isWaitingApproval, setIsWaitingApproval] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [reactions, setReactions] = useState<Array<{ id: string; emoji: string }>>([]);
  const [recordingCountdown, setRecordingCountdown] = useState<number | null>(null);
  const [hideSelfView, setHideSelfView] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "speaker" | "self">("grid");
  const [pinnedParticipantId, setPinnedParticipantId] = useState<string | null>(null);
  const [spotlightedParticipantId, setSpotlightedParticipantId] = useState<string | null>(null);
  const [isRoomLocked, setIsRoomLocked] = useState(false);
  const [showTransferHost, setShowTransferHost] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [gridColumns, setGridColumns] = useState<2 | 3 | 4>(3);
  const [chapterMarkers, setChapterMarkers] = useState<Array<{ timestamp: number; label: string }>>([]);
  const [showNotes, setShowNotes] = useState<Array<{ timestamp: number; note: string }>>([]);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [videoQuality, setVideoQuality] = useState<VideoQualityLevel>("auto");
  const [currentPreset, setCurrentPreset] = useState<QualityPreset>("interview");
  const [showBackgroundControls, setShowBackgroundControls] = useState(false);
  const [backgroundSettings, setBackgroundSettings] = useState<BackgroundSettings>({
    mode: 'none',
    blurAmount: 15,
    backgroundImage: null,
  });
  const [isBackgroundProcessing, setIsBackgroundProcessing] = useState(false);
  const [showFileSharing, setShowFileSharing] = useState(false);
  const [sharedFiles, setSharedFiles] = useState<Array<{
    id: string;
    name: string;
    size: number;
    type: string;
    uploadedBy: string;
    timestamp: number;
    data: string;
  }>>([]);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const isScreenSharingRef = useRef(false);
  const recordingControlsRef = useRef<{ toggleRecording: () => void; cancelCountdown: () => void; pauseRecording: () => void; resumeRecording: () => void } | null>(null);
  const roomContainerRef = useRef<HTMLDivElement | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  
  const wsRef = useRef<WebSocket | null>(null);
  const peersRef = useRef<Map<string, any>>(new Map());
  const pendingConnectionsRef = useRef<Participant[]>([]);
  const streamReadyRef = useRef<boolean>(false);
  const peerRetryCountRef = useRef<Map<string, number>>(new Map());
  const MAX_RETRY_ATTEMPTS = 3;
  const [primaryPeerConnection, setPrimaryPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [duration, setDuration] = useState(0);
  const startTimeRef = useRef<number>(Date.now());
  const mediaProcessorRef = useRef<MediaProcessor | null>(null);
  const backgroundProcessorRef = useRef<BackgroundProcessor | null>(null);
  const [processedStream, setProcessedStream] = useState<MediaStream | null>(null);
  const [backgroundProcessedStream, setBackgroundProcessedStream] = useState<MediaStream | null>(null);
  
  // Refs to track current stream values for use in callbacks (avoids closure issues)
  const localStreamRef = useRef<MediaStream | null>(null);
  const processedStreamRef = useRef<MediaStream | null>(null);
  const backgroundProcessedStreamRef = useRef<MediaStream | null>(null);
  
  const [videoSettings, setVideoSettings] = useState<VideoSettings>({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    smoothing: 0,
    sharpness: 100,
  });

  const networkStats = useNetworkQuality(primaryPeerConnection);
  const bandwidthStats = useBandwidthAdaptation(primaryPeerConnection, videoQuality === "auto");

  // Keep refs in sync with state (for use in callbacks to avoid stale closures)
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);
  
  useEffect(() => {
    processedStreamRef.current = processedStream;
  }, [processedStream]);
  
  useEffect(() => {
    backgroundProcessedStreamRef.current = backgroundProcessedStream;
  }, [backgroundProcessedStream]);

  useAutoSave({
    roomId,
    participantName,
    participantId,
    isAudioEnabled,
    isVideoEnabled,
    videoQuality,
    currentPreset,
    viewMode,
    hideSelfView,
    gridColumns,
    videoSettings,
  }, !isWaitingApproval);

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

    const recoveredState = recoverRoomState(roomId);
    if (recoveredState) {
      if (recoveredState.isAudioEnabled !== undefined) setIsAudioEnabled(recoveredState.isAudioEnabled);
      if (recoveredState.isVideoEnabled !== undefined) setIsVideoEnabled(recoveredState.isVideoEnabled);
      if (recoveredState.videoQuality) setVideoQuality(recoveredState.videoQuality as VideoQualityLevel);
      if (recoveredState.currentPreset) setCurrentPreset(recoveredState.currentPreset as QualityPreset);
      if (recoveredState.viewMode) setViewMode(recoveredState.viewMode as "grid" | "speaker" | "self");
      if (recoveredState.hideSelfView !== undefined) setHideSelfView(recoveredState.hideSelfView);
      if (recoveredState.gridColumns) setGridColumns(recoveredState.gridColumns as 2 | 3 | 4);
      if (recoveredState.videoSettings) setVideoSettings(recoveredState.videoSettings);
      
      toast({
        title: "Session Recovered",
        description: "Your previous settings have been restored",
      });
    }

    initializeMedia();
    connectWebSocket();

    return () => {
      cleanup();
      clearSavedRoomState();
    };
  }, [roomId]);

  useEffect(() => {
    if (!backgroundProcessorRef.current || !processedStream) {
      return;
    }

    const applyBackgroundProcessing = async () => {
      if (backgroundSettings.mode === 'none') {
        setBackgroundProcessedStream(null);
        backgroundProcessedStreamRef.current = null;
        backgroundProcessorRef.current?.stopProcessing();
        return;
      }

      if (!backgroundProcessorRef.current) return;
      
      backgroundProcessorRef.current.updateSettings(backgroundSettings);
      const bgStream = await backgroundProcessorRef.current.startProcessing(processedStream);
      if (bgStream) {
        setBackgroundProcessedStream(bgStream);
        backgroundProcessedStreamRef.current = bgStream;
      }
    };

    applyBackgroundProcessing();
  }, [backgroundSettings, processedStream]);

  // Push-to-talk state
  const pushToTalkActiveRef = useRef(false);
  const wasAudioEnabledRef = useRef(false);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toLowerCase();
      
      // Push-to-talk on spacebar press
      if (key === ' ' && !pushToTalkActiveRef.current) {
        e.preventDefault();
        pushToTalkActiveRef.current = true;
        wasAudioEnabledRef.current = isAudioEnabled;
        if (!isAudioEnabled) {
          toggleAudio();
        }
        return;
      }
      
      if (key === 'escape' && recordingCountdown !== null) {
        recordingControlsRef.current?.cancelCountdown();
        return;
      }
      
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
          recordingControlsRef.current?.toggleRecording();
          break;
        case 'c':
          setShowChat(prev => !prev);
          break;
        case 'p':
          if (isRecording) {
            // When recording, P pauses (no-op if already paused)
            recordingControlsRef.current?.pauseRecording();
          } else {
            // When not recording, P toggles participants panel
            setShowParticipants(prev => !prev);
          }
          break;
        case 'u':
          // U resumes recording when paused
          if (isRecording) {
            recordingControlsRef.current?.resumeRecording();
          }
          break;
        case 'h':
          toggleHandRaise();
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'i':
          togglePictureInPicture();
          break;
        case 'k':
          addChapterMarker();
          break;
        case 'g':
          setViewMode("grid");
          break;
        case 'b':
          setViewMode("speaker");
          break;
        case 'l':
          setViewMode("self");
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toLowerCase();
      
      // Push-to-talk release
      if (key === ' ' && pushToTalkActiveRef.current) {
        e.preventDefault();
        pushToTalkActiveRef.current = false;
        if (!wasAudioEnabledRef.current && isAudioEnabled) {
          toggleAudio();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isRecording, isAudioEnabled, isVideoEnabled, isScreenSharing, recordingCountdown]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handlePiPChange = () => {
      setIsPiPActive(!!document.pictureInPictureElement);
    };

    document.addEventListener('enterpictureinpicture', handlePiPChange, true);
    document.addEventListener('leavepictureinpicture', handlePiPChange, true);
    return () => {
      document.removeEventListener('enterpictureinpicture', handlePiPChange, true);
      document.removeEventListener('leavepictureinpicture', handlePiPChange, true);
    };
  }, []);

  const initializeMedia = async () => {
    try {
      // Detect if mobile device
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      console.log(`[Media] Initializing media, mobile: ${isMobile}`);
      
      // Mobile-friendly video constraints with fallback
      const videoConstraints = isMobile 
        ? { 
            facingMode: "user",
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
          }
        : { 
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 },
          };
      
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        console.log("[Media] ✅ Got media stream with preferred settings");
      } catch (preferredError) {
        console.warn("[Media] Preferred settings failed, trying basic constraints:", preferredError);
        // Fallback to basic constraints
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        console.log("[Media] ✅ Got media stream with basic settings");
      }
      
      mediaProcessorRef.current = new MediaProcessor();
      const enhanced = mediaProcessorRef.current.initializeAudioProcessing(stream);
      
      // Set both state and refs for immediate availability in callbacks
      setLocalStream(stream);
      setProcessedStream(enhanced);
      localStreamRef.current = stream;
      processedStreamRef.current = enhanced;
      streamReadyRef.current = true;
      console.log("✅ Local stream ready, processing pending connections...");
      
      // Also drain any ICE-gated pending connections
      setTimeout(() => drainPendingPeers(), 50);
      
      // Process any pending connections that were queued before stream was ready
      if (pendingConnectionsRef.current.length > 0) {
        console.log(`📋 Processing ${pendingConnectionsRef.current.length} pending connections`);
        const pendingParticipants = [...pendingConnectionsRef.current];
        pendingConnectionsRef.current = [];
        // Small delay to ensure state is updated
        setTimeout(() => {
          // Create composite stream with video from original + audio from enhanced
          const compositeStream = new MediaStream();
          stream.getVideoTracks().forEach(track => {
            if (track.readyState === 'live') compositeStream.addTrack(track);
          });
          (enhanced || stream).getAudioTracks().forEach(track => {
            if (track.readyState === 'live') compositeStream.addTrack(track);
          });
          console.log(`📡 Composite stream for pending: ${compositeStream.getVideoTracks().length} video, ${compositeStream.getAudioTracks().length} audio`);
          
          pendingParticipants.forEach(participant => {
            if (participant.id !== participantId && participant.approvalStatus === "approved") {
              createPeerConnectionWithStream(participant.id, true, compositeStream);
            }
          });
        }, 100);
      }

      backgroundProcessorRef.current = new BackgroundProcessor();
      const initialized = await backgroundProcessorRef.current.initialize();
      if (initialized) {
        setIsBackgroundProcessing(true);
      }
      
      const localParticipant: Participant = {
        id: participantId,
        name: participantName,
        roomId,
        isAudioEnabled: true,
        isVideoEnabled: true,
        isScreenSharing: false,
        isHost: false,
        approvalStatus: "pending",
        handRaised: false,
        canRecord: false,
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

  // Dynamic ICE server configuration - fetched from Cloudflare for reliable TURN
  const [iceServers, setIceServers] = useState<RTCIceServer[]>([
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ]);
  const iceServersRef = useRef<RTCIceServer[]>(iceServers);
  const [iceServersReady, setIceServersReady] = useState(false);
  const iceServersReadyRef = useRef(false);
  const pendingPeerConnectionsRef = useRef<Array<{ remoteId: string; initiator: boolean }>>([]);
  
  // Configure TURN credentials on mount - using Open Relay Project (free, reliable)
  useEffect(() => {
    const setupIceServers = () => {
      console.log("[WebRTC] Setting up ICE servers with TURN support...");
      
      // Open Relay Project configuration (https://www.metered.ca/tools/openrelay/)
      // This is a free, production-ready TURN service with 99.999% uptime
      const iceServersConfig: RTCIceServer[] = [
        // STUN servers for NAT traversal discovery
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:openrelay.metered.ca:80" },
        
        // TURN servers for relay when direct connection fails (cross-network)
        // UDP on port 80 - most likely to work through firewalls
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        // UDP on port 443 - fallback
        {
          urls: "turn:openrelay.metered.ca:443",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        // TCP on port 443 - works through most restrictive firewalls
        {
          urls: "turn:openrelay.metered.ca:443?transport=tcp",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        // TLS/TURNS on port 443 - encrypted relay for highest security
        {
          urls: "turns:openrelay.metered.ca:443",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
      ];
      
      console.log("[WebRTC] ✅ ICE servers configured with Open Relay Project TURN");
      console.log("[WebRTC] TURN servers: openrelay.metered.ca (ports 80, 443, TCP, TLS)");
      
      setIceServers(iceServersConfig);
      iceServersRef.current = iceServersConfig;
      setIceServersReady(true);
      iceServersReadyRef.current = true;
    };
    
    setupIceServers();
  }, []);

  // Helper to drain pending peer connections - called when both ICE servers and stream are ready
  const drainPendingPeers = useCallback(() => {
    if (!iceServersReadyRef.current || !streamReadyRef.current) {
      return; // Not ready yet
    }
    
    const pending = pendingPeerConnectionsRef.current;
    if (pending.length === 0) {
      return; // Nothing to drain
    }
    
    const outboundStream = getOutboundStream();
    if (!outboundStream) {
      console.log(`[WebRTC] ⏳ Stream not ready yet, keeping ${pending.length} connections queued`);
      return; // Keep queue intact until stream is available
    }
    
    console.log(`[WebRTC] 🚀 Draining ${pending.length} pending peer connections`);
    // Clear queue and process
    const toProcess = [...pending];
    pendingPeerConnectionsRef.current = [];
    
    toProcess.forEach(({ remoteId, initiator }) => {
      if (!peersRef.current.has(remoteId)) {
        console.log(`[WebRTC] Creating deferred connection to ${remoteId}`);
        createPeerConnectionWithStream(remoteId, initiator, outboundStream);
      }
    });
  }, []);
  
  // Trigger drain when ICE servers become ready
  useEffect(() => {
    if (iceServersReady) {
      drainPendingPeers();
    }
  }, [iceServersReady, drainPendingPeers]);

  // Helper function to get outbound stream with both audio and video
  // Uses refs to avoid stale closure issues when called from state setter callbacks
  const getOutboundStream = (): MediaStream | null => {
    // Use refs for current stream values (avoids closure issues in callbacks)
    const videoSource = backgroundProcessedStreamRef.current || localStreamRef.current;
    const videoTracks = videoSource?.getVideoTracks() || [];
    
    const audioSource = processedStreamRef.current || localStreamRef.current;
    const audioTracks = audioSource?.getAudioTracks() || [];
    
    if (videoTracks.length === 0 && audioTracks.length === 0) {
      console.log("⚠️ No tracks available for outbound stream");
      return null;
    }
    
    // Create a composite stream with both audio and video
    const compositeStream = new MediaStream();
    videoTracks.forEach(track => {
      if (track.readyState === 'live') {
        compositeStream.addTrack(track);
      }
    });
    audioTracks.forEach(track => {
      if (track.readyState === 'live') {
        compositeStream.addTrack(track);
      }
    });
    
    console.log(`📡 Outbound stream: ${compositeStream.getVideoTracks().length} video, ${compositeStream.getAudioTracks().length} audio tracks`);
    return compositeStream;
  };

  // Helper to log the selected ICE candidate pair after connection
  const logSelectedCandidatePair = (pc: RTCPeerConnection, remoteId: string) => {
    try {
      pc.getStats().then((stats) => {
        stats.forEach((report) => {
          if (report.type === "candidate-pair" && report.state === "succeeded") {
            console.log(`[WebRTC] Connection type for ${remoteId}:`, {
              localType: report.localCandidateType,
              remoteType: report.remoteCandidateType,
              protocol: report.protocol,
            });
            
            // Find the actual candidate details
            stats.forEach((candidate: any) => {
              if (candidate.id === report.localCandidateId) {
                console.log(`[WebRTC] Local endpoint: ${candidate.candidateType} via ${candidate.protocol}`);
              }
              if (candidate.id === report.remoteCandidateId) {
                console.log(`[WebRTC] Remote endpoint: ${candidate.candidateType} via ${candidate.protocol}`);
              }
            });
          }
        });
      }).catch(() => {});
    } catch (e) {
      // Stats not available
    }
  };

  // Helper function to create peer connection with a specific stream (used when stream is passed directly)
  const createPeerConnectionWithStream = (
    remoteParticipantId: string,
    initiator: boolean,
    stream: MediaStream
  ) => {
    console.log(`🔗 Creating peer connection to ${remoteParticipantId}, initiator: ${initiator}, stream tracks: ${stream.getTracks().length}`);
    
    // Don't create duplicate connections
    if (peersRef.current.has(remoteParticipantId)) {
      console.log(`Already have connection to ${remoteParticipantId}`);
      return peersRef.current.get(remoteParticipantId);
    }

    // Gate: Wait for ICE servers (including TURN) before creating connections
    if (!iceServersReadyRef.current) {
      console.log(`[WebRTC] ⏳ ICE servers not ready yet, queuing connection to ${remoteParticipantId}`);
      pendingPeerConnectionsRef.current.push({ remoteId: remoteParticipantId, initiator });
      // Schedule a drain attempt in case ICE becomes ready soon
      setTimeout(() => drainPendingPeers(), 100);
      return null;
    }

    // Use ref for latest ICE servers to avoid stale closures
    const currentIceServers = iceServersRef.current;
    const hasTurn = currentIceServers.some(s => {
      const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
      return urls.some(url => url.startsWith('turn:') || url.startsWith('turns:'));
    });
    console.log(`[WebRTC] Using ${currentIceServers.length} ICE servers (TURN available: ${hasTurn})`);
    console.log(`[WebRTC] ICE servers config:`, JSON.stringify(currentIceServers, null, 2));
    
    // Create peer connection - for debugging, we can force relay if direct connection fails
    const pc = new RTCPeerConnection({ 
      iceServers: currentIceServers,
      // Uncomment below to FORCE relay mode for debugging (will fail if TURN doesn't work)
      // iceTransportPolicy: 'relay',
    });

    // Add local tracks to the connection
    stream.getTracks().forEach(track => {
      console.log(`Adding track to peer connection: ${track.kind}`);
      pc.addTrack(track, stream);
    });

    // Handle ICE candidates with detailed logging
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // Log candidate type for debugging
        const candidateStr = event.candidate.candidate;
        const candidateType = candidateStr.includes("typ relay") ? "relay (TURN)" :
                             candidateStr.includes("typ srflx") ? "srflx (STUN)" :
                             candidateStr.includes("typ host") ? "host (local)" : "unknown";
        console.log(`📤 ICE candidate for ${remoteParticipantId}: ${candidateType}`);
        
        if (candidateType === "relay (TURN)") {
          console.log(`[WebRTC] ✅ TURN relay candidate found - cross-network connections should work!`);
        }
        
        wsRef.current?.send(JSON.stringify({
          type: "signal",
          roomId,
          participantId,
          targetId: remoteParticipantId,
          signal: { type: "candidate", candidate: event.candidate },
        }));
      }
    };

    // Handle incoming remote tracks
    pc.ontrack = (event) => {
      console.log(`📥 Received track from ${remoteParticipantId}:`, event.track.kind, event.streams.length);
      const remoteStream = event.streams[0];
      if (remoteStream) {
        console.log(`📥 Setting remote stream for ${remoteParticipantId}, tracks: ${remoteStream.getTracks().length}`);
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.set(remoteParticipantId, remoteStream);
          return newMap;
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${remoteParticipantId}: ${pc.connectionState}`);
      if (pc.connectionState === "connected") {
        console.log(`✅ Successfully connected to ${remoteParticipantId}`);
        // Reset retry counter on success
        peerRetryCountRef.current.delete(remoteParticipantId);
        // Log the selected candidate pair
        logSelectedCandidatePair(pc, remoteParticipantId);
      }
      if (pc.connectionState === "failed") {
        console.error(`[WebRTC] ❌ Connection FAILED to ${remoteParticipantId}`);
        
        // Only the initiator should retry to avoid both sides racing
        if (!initiator) {
          console.log(`[WebRTC] Not initiator, waiting for other side to retry...`);
          peersRef.current.delete(remoteParticipantId);
          return;
        }
        
        // Check if peer is still in participants list before retrying
        const peerStillExists = participants.some(p => p.id === remoteParticipantId && p.approvalStatus === "approved");
        if (!peerStillExists) {
          console.log(`[WebRTC] Peer ${remoteParticipantId} no longer in room, not retrying`);
          peersRef.current.delete(remoteParticipantId);
          peerRetryCountRef.current.delete(remoteParticipantId);
          return;
        }
        
        // Attempt retry if we haven't exceeded max attempts
        const retryCount = peerRetryCountRef.current.get(remoteParticipantId) || 0;
        if (retryCount < MAX_RETRY_ATTEMPTS) {
          console.log(`[WebRTC] 🔄 Retrying connection (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})...`);
          peerRetryCountRef.current.set(remoteParticipantId, retryCount + 1);
          
          // Close the failed connection
          pc.close();
          peersRef.current.delete(remoteParticipantId);
          
          // Retry with exponential backoff
          const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 8000);
          setTimeout(() => {
            // Re-check if peer still exists before retry
            const stillExists = participants.some(p => p.id === remoteParticipantId && p.approvalStatus === "approved");
            if (stillExists && streamReadyRef.current) {
              const outboundStream = getOutboundStream();
              if (outboundStream) {
                console.log(`[WebRTC] 🔄 Recreating peer connection to ${remoteParticipantId}...`);
                createPeerConnectionWithStream(remoteParticipantId, true, outboundStream);
              }
            }
          }, backoffDelay);
          return;
        } else {
          console.error(`[WebRTC] ❌ Max retry attempts reached for ${remoteParticipantId}`);
          console.error(`[WebRTC] TURN servers may be blocked. Try: different network, disable VPN, or use mobile data`);
          peerRetryCountRef.current.delete(remoteParticipantId);
        }
        
        peersRef.current.delete(remoteParticipantId);
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.delete(remoteParticipantId);
          return newMap;
        });
      } else if (pc.connectionState === "closed") {
        // Only clean up on closed, not on transient disconnects
        peersRef.current.delete(remoteParticipantId);
        peerRetryCountRef.current.delete(remoteParticipantId);
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.delete(remoteParticipantId);
          return newMap;
        });
      }
      // Note: "disconnected" is transient - don't cleanup, wait for reconnection or failure
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE state with ${remoteParticipantId}: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === "failed") {
        console.error(`[WebRTC] ❌ ICE connection FAILED - No suitable candidates found`);
      }
    };
    
    // Log ICE gathering state
    pc.onicegatheringstatechange = () => {
      console.log(`ICE gathering state with ${remoteParticipantId}: ${pc.iceGatheringState}`);
      if (pc.iceGatheringState === "complete") {
        console.log(`[WebRTC] ICE gathering complete for ${remoteParticipantId}`);
      }
    };

    // Store the peer connection with metadata
    const peerData = { _pc: pc, remoteId: remoteParticipantId };
    peersRef.current.set(remoteParticipantId, peerData);

    // If we're the initiator, create and send an offer
    if (initiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          console.log(`📤 Sending offer to ${remoteParticipantId}`);
          wsRef.current?.send(JSON.stringify({
            type: "signal",
            roomId,
            participantId,
            targetId: remoteParticipantId,
            signal: { type: "offer", sdp: pc.localDescription },
          }));
        })
        .catch(err => console.error("Error creating offer:", err));
    }

    return peerData;
  };

  // Create a WebRTC peer connection with another participant using native RTCPeerConnection
  const createPeerConnection = useCallback((
    remoteParticipantId: string,
    initiator: boolean,
    stream: MediaStream
  ) => {
    console.log(`🔗 Creating peer connection to ${remoteParticipantId}, initiator: ${initiator}`);
    
    // Don't create duplicate connections
    if (peersRef.current.has(remoteParticipantId)) {
      console.log(`Already have connection to ${remoteParticipantId}`);
      return peersRef.current.get(remoteParticipantId);
    }

    // Gate: Wait for ICE servers (including TURN) before creating connections
    if (!iceServersReadyRef.current) {
      console.log(`[WebRTC] ⏳ ICE servers not ready yet, queuing connection to ${remoteParticipantId}`);
      pendingPeerConnectionsRef.current.push({ remoteId: remoteParticipantId, initiator });
      // Schedule a drain attempt in case ICE becomes ready soon
      setTimeout(() => drainPendingPeers(), 100);
      return null;
    }

    // Use ref for latest ICE servers
    const currentIceServers = iceServersRef.current;
    const hasTurn = currentIceServers.some(s => {
      const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
      return urls.some(url => url.startsWith('turn:') || url.startsWith('turns:'));
    });
    console.log(`[WebRTC] Using ${currentIceServers.length} ICE servers (TURN available: ${hasTurn})`);
    const pc = new RTCPeerConnection({ iceServers: currentIceServers });

    // Add local tracks to the connection
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // Handle ICE candidates with detailed logging
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candidateStr = event.candidate.candidate;
        const candidateType = candidateStr.includes("typ relay") ? "relay (TURN)" :
                             candidateStr.includes("typ srflx") ? "srflx (STUN)" :
                             candidateStr.includes("typ host") ? "host (local)" : "unknown";
        console.log(`📤 ICE candidate for ${remoteParticipantId}: ${candidateType}`);
        
        wsRef.current?.send(JSON.stringify({
          type: "signal",
          roomId,
          participantId,
          targetId: remoteParticipantId,
          signal: { type: "candidate", candidate: event.candidate },
        }));
      }
    };

    // Handle incoming remote tracks
    pc.ontrack = (event) => {
      console.log(`📥 Received track from ${remoteParticipantId}:`, event.track.kind);
      const remoteStream = event.streams[0];
      if (remoteStream) {
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.set(remoteParticipantId, remoteStream);
          return newMap;
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${remoteParticipantId}: ${pc.connectionState}`);
      if (pc.connectionState === "connected") {
        console.log(`✅ Successfully connected to ${remoteParticipantId}`);
        peerRetryCountRef.current.delete(remoteParticipantId);
        logSelectedCandidatePair(pc, remoteParticipantId);
      }
      if (pc.connectionState === "failed") {
        console.error(`[WebRTC] ❌ Connection FAILED to ${remoteParticipantId}`);
        
        // Only initiator should retry
        if (!initiator) {
          peersRef.current.delete(remoteParticipantId);
          return;
        }
        
        const retryCount = peerRetryCountRef.current.get(remoteParticipantId) || 0;
        if (retryCount < MAX_RETRY_ATTEMPTS) {
          console.log(`[WebRTC] 🔄 Retrying connection (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})...`);
          peerRetryCountRef.current.set(remoteParticipantId, retryCount + 1);
          pc.close();
          peersRef.current.delete(remoteParticipantId);
          
          const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 8000);
          setTimeout(() => {
            if (streamReadyRef.current) {
              const outboundStream = getOutboundStream();
              if (outboundStream) {
                createPeerConnectionWithStream(remoteParticipantId, true, outboundStream);
              }
            }
          }, backoffDelay);
          return;
        } else {
          peerRetryCountRef.current.delete(remoteParticipantId);
        }
        
        peersRef.current.delete(remoteParticipantId);
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.delete(remoteParticipantId);
          return newMap;
        });
      } else if (pc.connectionState === "closed") {
        peersRef.current.delete(remoteParticipantId);
        peerRetryCountRef.current.delete(remoteParticipantId);
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.delete(remoteParticipantId);
          return newMap;
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE state with ${remoteParticipantId}: ${pc.iceConnectionState}`);
    };

    // Store the peer connection with metadata
    const peerData = { _pc: pc, remoteId: remoteParticipantId };
    peersRef.current.set(remoteParticipantId, peerData);

    // If we're the initiator, create and send an offer
    if (initiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          console.log(`📤 Sending offer to ${remoteParticipantId}`);
          wsRef.current?.send(JSON.stringify({
            type: "signal",
            roomId,
            participantId,
            targetId: remoteParticipantId,
            signal: { type: "offer", sdp: pc.localDescription },
          }));
        })
        .catch(err => console.error("Error creating offer:", err));
    }

    return peerData;
  }, [roomId, participantId]);

  // Handle incoming signaling data (offers, answers, ICE candidates)
  const handleSignal = useCallback((fromParticipantId: string, signal: { type: string; sdp?: RTCSessionDescription; candidate?: RTCIceCandidate }) => {
    console.log(`📥 Received signal from ${fromParticipantId}:`, signal.type);
    
    let peerData = peersRef.current.get(fromParticipantId);
    
    // If we receive an offer but don't have a peer, create one
    if (!peerData && signal.type === "offer") {
      if (!streamReadyRef.current) {
        console.error("No local stream available for peer connection - stream not ready yet");
        return;
      }
      const stream = getOutboundStream();
      if (!stream) {
        console.error("No outbound stream available for peer connection");
        return;
      }
      peerData = createPeerConnectionWithStream(fromParticipantId, false, stream);
    }
    
    if (!peerData) {
      console.error("No peer connection for signal from:", fromParticipantId);
      return;
    }

    const pc = peerData._pc as RTCPeerConnection;
    
    if (signal.type === "offer" && signal.sdp) {
      pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
        .then(() => pc.createAnswer())
        .then(answer => pc.setLocalDescription(answer))
        .then(() => {
          console.log(`📤 Sending answer to ${fromParticipantId}`);
          wsRef.current?.send(JSON.stringify({
            type: "signal",
            roomId,
            participantId,
            targetId: fromParticipantId,
            signal: { type: "answer", sdp: pc.localDescription },
          }));
        })
        .catch(err => console.error("Error handling offer:", err));
    } else if (signal.type === "answer" && signal.sdp) {
      pc.setRemoteDescription(new RTCSessionDescription(signal.sdp))
        .catch(err => console.error("Error setting remote description:", err));
    } else if (signal.type === "candidate" && signal.candidate) {
      pc.addIceCandidate(new RTCIceCandidate(signal.candidate))
        .catch(err => console.error("Error adding ICE candidate:", err));
    }
  }, [backgroundProcessedStream, processedStream, localStream, roomId, participantId]);

  // Initiate connections to all existing participants
  const initiateConnections = useCallback((otherParticipants: Participant[]) => {
    // If stream isn't ready yet, queue the participants for later
    if (!streamReadyRef.current) {
      console.log("⏳ Stream not ready yet, queueing connections for:", otherParticipants.map(p => p.name).join(", "));
      pendingConnectionsRef.current = [...pendingConnectionsRef.current, ...otherParticipants];
      return;
    }

    const stream = getOutboundStream();
    if (!stream) {
      console.error("❌ No outbound stream available for initiating connections");
      pendingConnectionsRef.current = [...pendingConnectionsRef.current, ...otherParticipants];
      return;
    }

    console.log("🚀 Initiating connections to:", otherParticipants.map(p => p.name).join(", "));
    otherParticipants.forEach(participant => {
      if (participant.id !== participantId && participant.approvalStatus === "approved") {
        createPeerConnectionWithStream(participant.id, true, stream);
      }
    });
  }, [participantId, backgroundProcessedStream, processedStream, localStream]);

  const connectWebSocket = () => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;
    
    console.log("Connecting to WebSocket:", wsUrl);
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log("WebSocket connected successfully");
      setIsReconnecting(false);
      reconnectAttemptsRef.current = 0;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      ws.send(JSON.stringify({
        type: "join-room",
        roomId,
        participantId,
        participantName,
      }));
      
      if (reconnectAttemptsRef.current > 0) {
        toast({
          title: "Reconnected",
          description: "Connection restored successfully.",
        });
      }
    };

    ws.onmessage = (event) => {
      handleWebSocketMessage(JSON.parse(event.data));
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = (event) => {
      console.log("WebSocket disconnected", event.code, event.reason);
      
      if (event.code !== 1000 && event.code !== 1001) {
        attemptReconnect();
      }
    };

    wsRef.current = ws;
  };

  const attemptReconnect = () => {
    const maxAttempts = 10;
    const baseDelay = 1000;
    const maxDelay = 30000;
    
    if (reconnectAttemptsRef.current >= maxAttempts) {
      toast({
        title: "Connection Lost",
        description: "Could not reconnect to the server. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }
    
    reconnectAttemptsRef.current += 1;
    const delay = Math.min(baseDelay * Math.pow(2, reconnectAttemptsRef.current - 1), maxDelay);
    
    setIsReconnecting(true);
    
    console.log(`Reconnect attempt ${reconnectAttemptsRef.current}/${maxAttempts} in ${delay}ms`);
    
    reconnectTimeoutRef.current = window.setTimeout(() => {
      console.log("Attempting to reconnect...");
      connectWebSocket();
    }, delay);
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
        // Initiate WebRTC connections to other approved participants
        const approvedParticipants = message.participants.filter(
          (p: Participant) => p.id !== participantId && p.approvalStatus === "approved"
        );
        if (approvedParticipants.length > 0) {
          setTimeout(() => initiateConnections(approvedParticipants), 500);
        }
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
        setParticipants(prev => {
          const updated = prev.map(p =>
            p.id === message.participantId ? { ...p, approvalStatus: "approved" as const } : p
          );
          
          // If I was just approved, I need to connect to all OTHER approved participants
          if (message.participantId === participantId) {
            console.log(`✅ I was approved! Connecting to existing participants...`);
            setIsWaitingApproval(false);
            
            const otherApproved = updated.filter(p => 
              p.id !== participantId && p.approvalStatus === "approved"
            );
            
            if (otherApproved.length > 0 && streamReadyRef.current) {
              const stream = getOutboundStream();
              if (stream) {
                console.log(`🔗 Initiating connections to ${otherApproved.length} existing participants`);
                setTimeout(() => {
                  otherApproved.forEach(p => {
                    console.log(`🔗 Connecting to existing participant: ${p.name} (${p.id})`);
                    createPeerConnectionWithStream(p.id, true, stream);
                  });
                }, 500);
              }
            }
          } else {
            // Another participant was approved, I should connect to them
            if (streamReadyRef.current) {
              const stream = getOutboundStream();
              if (stream) {
                console.log(`🔗 Initiating connection to newly approved participant: ${message.participantId}`);
                setTimeout(() => createPeerConnectionWithStream(message.participantId, true, stream), 500);
              } else {
                console.log("⏳ No outbound stream, queueing connection for newly approved participant");
                pendingConnectionsRef.current.push({
                  id: message.participantId,
                  name: "Pending",
                  roomId: roomId,
                  isAudioEnabled: true,
                  isVideoEnabled: true,
                  isScreenSharing: false,
                  isHost: false,
                  approvalStatus: "approved",
                  handRaised: false,
                  canRecord: false,
                  joinedAt: Date.now(),
                });
              }
            } else {
              console.log("⏳ Stream not ready, queueing connection for newly approved participant");
              pendingConnectionsRef.current.push({
                id: message.participantId,
                name: "Pending",
                roomId: roomId,
                isAudioEnabled: true,
                isVideoEnabled: true,
                isScreenSharing: false,
                isHost: false,
                approvalStatus: "approved",
                handRaised: false,
                canRecord: false,
                joinedAt: Date.now(),
              });
            }
          }
          
          return updated;
        });
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
        // Set canRecord from participant data (host gets it automatically)
        const self = message.participants.find((p: any) => p.id === participantId);
        if (self) setCanRecord(self.canRecord || false);
        // Initiate WebRTC connections to other approved participants
        const otherParticipants = message.participants.filter(
          (p: Participant) => p.id !== participantId && p.approvalStatus === "approved"
        );
        if (otherParticipants.length > 0) {
          // Small delay to ensure local stream is ready
          setTimeout(() => initiateConnections(otherParticipants), 500);
        }
        break;

      case "signal":
        // Handle incoming WebRTC signaling data
        handleSignal(message.participantId, message.signal);
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
      
      case "screen-share":
        setParticipants(prev => prev.map(p => 
          p.id === message.participantId ? { ...p, isScreenSharing: message.isSharing } : p
        ));
        if (message.isSharing) {
          const participant = participants.find(p => p.id === message.participantId);
          if (participant && participant.id !== participantId) {
            toast({
              title: "Screen Sharing Started",
              description: `${participant.name} is now sharing their screen`,
            });
          }
        }
        break;
      
      case "hand-raised":
        setParticipants(prev => prev.map(p => 
          p.id === message.participantId ? { ...p, handRaised: message.isRaised } : p
        ));
        if (message.isRaised) {
          const participant = participants.find(p => p.id === message.participantId);
          if (participant && participant.id !== participantId) {
            toast({
              title: "Hand Raised",
              description: `${participant.name} raised their hand`,
            });
          }
        }
        break;
      
      case "emoji-reaction":
        const reactionId = `${message.participantId}-${Date.now()}`;
        setReactions(prev => [...prev, { id: reactionId, emoji: message.emoji }]);
        break;
      
      case "file-share":
        setSharedFiles(prev => [...prev, message.file]);
        break;
      
      case "mute-all-command":
        if (!isHost && isAudioEnabled) {
          localStream?.getAudioTracks().forEach(track => {
            track.enabled = false;
          });
          processedStream?.getAudioTracks().forEach(track => {
            track.enabled = false;
          });
          setIsAudioEnabled(false);
          
          wsRef.current?.send(JSON.stringify({
            type: "toggle-audio",
            roomId,
            participantId,
            isEnabled: false,
          }));
          
          toast({
            title: "Muted by Host",
            description: "The host has muted all participants. You can unmute yourself.",
          });
        }
        break;

      case "room-locked":
        setIsRoomLocked(message.isLocked);
        toast({
          title: message.isLocked ? "Room Locked" : "Room Unlocked",
          description: message.isLocked 
            ? "The room is now locked. New participants cannot join."
            : "The room is now unlocked. New participants can join.",
        });
        break;

      case "room-locked-error":
        toast({
          title: "Room is Locked",
          description: message.message,
          variant: "destructive",
        });
        setTimeout(() => setLocation("/"), 2000);
        break;

      case "host-transferred":
        setParticipants(prev => prev.map(p => ({
          ...p,
          isHost: p.id === message.newHostId,
        })));
        setIsHost(participantId === message.newHostId);
        toast({
          title: "Host Transferred",
          description: `${message.newHostName} is now the host`,
        });
        break;

      case "participant-spotlighted":
        setSpotlightedParticipantId(message.spotlightedParticipantId);
        if (message.spotlightedParticipantId) {
          toast({
            title: "Participant Spotlighted",
            description: `${message.spotlightedParticipantName} is now in the spotlight`,
          });
        } else {
          toast({
            title: "Spotlight Cleared",
            description: "No participant is spotlighted",
          });
        }
        break;

      case "audio-force-disabled":
        if (message.targetParticipantId === participantId) {
          setIsAudioEnabled(false);
          localStream?.getAudioTracks().forEach(track => track.enabled = false);
          toast({
            title: "Audio Disabled by Host",
            description: "The host has disabled your audio",
            variant: "destructive",
          });
        }
        break;

      case "video-force-disabled":
        if (message.targetParticipantId === participantId) {
          setIsVideoEnabled(false);
          localStream?.getVideoTracks().forEach(track => track.enabled = false);
          toast({
            title: "Video Disabled by Host",
            description: "The host has disabled your video",
            variant: "destructive",
          });
        }
        break;

      case "recording-permission-updated":
        if (message.targetParticipantId === participantId) {
          setCanRecord(message.canRecord);
          toast({
            title: message.canRecord ? "Recording Enabled" : "Recording Disabled",
            description: message.canRecord 
              ? "You can now start recording" 
              : "Your recording permission has been revoked",
          });
        }
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
    const turningOff = isAudioEnabled;
    console.log(`🎤 Microphone: ${turningOff ? 'OFF' : 'ON'}`);
    
    if (turningOff) {
      // === TURN OFF ===
      // 1. Stop peer connection tracks
      peersRef.current.forEach((peer) => {
        peer._pc?.getSenders().forEach((sender: RTCRtpSender) => {
          if (sender.track?.kind === 'audio') {
            sender.track.stop();
            sender.replaceTrack(null);
          }
        });
      });
      
      // 2. Stop local audio tracks
      localStream?.getAudioTracks().forEach(t => t.stop());
      processedStream?.getAudioTracks().forEach(t => t.stop());
      
      // 3. Update state
      setIsAudioEnabled(false);
      setParticipants(prev => prev.map(p => 
        p.id === participantId ? { ...p, isAudioEnabled: false } : p
      ));
      
      wsRef.current?.send(JSON.stringify({
        type: "toggle-audio", roomId, participantId, isEnabled: false,
      }));
      
      console.log(`✅ Microphone OFF`);
    } else {
      // === TURN ON ===
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
        });
        const newAudioTrack = stream.getAudioTracks()[0];
        
        // Get ONLY live video tracks (not stopped ones)
        const liveVideoTracks = (localStream?.getVideoTracks() || [])
          .filter(t => t.readyState === 'live');
        
        // Create fresh streams with any live video + new audio
        const newLocalStream = new MediaStream([...liveVideoTracks, newAudioTrack]);
        const newProcessedStream = new MediaStream([
          ...liveVideoTracks.map(t => t.clone()), 
          newAudioTrack.clone()
        ]);
        
        // Update peer connections
        peersRef.current.forEach((peer) => {
          peer._pc?.getSenders().forEach((sender: RTCRtpSender) => {
            if (!sender.track || sender.track.kind === 'audio') {
              sender.replaceTrack(newAudioTrack.clone());
            }
          });
        });
        
        // Update state and refs
        setLocalStream(newLocalStream);
        setProcessedStream(newProcessedStream);
        localStreamRef.current = newLocalStream;
        processedStreamRef.current = newProcessedStream;
        setIsAudioEnabled(true);
        setParticipants(prev => prev.map(p => 
          p.id === participantId ? { ...p, isAudioEnabled: true } : p
        ));
        
        wsRef.current?.send(JSON.stringify({
          type: "toggle-audio", roomId, participantId, isEnabled: true,
        }));
        
        console.log(`✅ Microphone ON`);
      } catch (err) {
        console.error("Microphone error:", err);
        toast({ title: "Microphone Error", description: "Cannot access microphone.", variant: "destructive" });
      }
    }
  };

  const toggleVideo = async () => {
    const turningOff = isVideoEnabled;
    console.log(`📷 Camera: ${turningOff ? 'OFF' : 'ON'}`);
    
    if (turningOff) {
      // === TURN OFF - Release camera hardware completely ===
      
      // 1. First, stop ALL video tracks on backgroundProcessedStream BEFORE clearing it
      if (backgroundProcessedStream) {
        backgroundProcessedStream.getVideoTracks().forEach(track => {
          console.log(`🛑 Stopping background video track: ${track.id}`);
          track.stop();
        });
      }
      
      // 2. Stop background processor (clears internal video element srcObject)
      backgroundProcessorRef.current?.stopProcessing();
      setBackgroundProcessedStream(null);
      backgroundProcessedStreamRef.current = null;
      
      // 3. Stop media processor video tracks
      mediaProcessorRef.current?.stopVideoTracks();
      
      // 4. Stop peer connection tracks (clones that keep hardware alive)
      peersRef.current.forEach((peer, peerId) => {
        peer._pc?.getSenders().forEach((sender: RTCRtpSender) => {
          if (sender.track?.kind === 'video') {
            console.log(`🛑 Stopping peer ${peerId} video track: ${sender.track.id}`);
            sender.track.stop();
            sender.replaceTrack(null);
          }
        });
      });
      
      // 5. Stop AND remove all video tracks from localStream
      if (localStream) {
        const videoTracks = localStream.getVideoTracks();
        videoTracks.forEach(t => {
          console.log(`🛑 Stopping local video track: ${t.id}, readyState: ${t.readyState}`);
          t.stop();
          localStream.removeTrack(t);
        });
        // Create new stream with only audio to help garbage collection
        const audioOnly = new MediaStream(localStream.getAudioTracks().filter(t => t.readyState === 'live'));
        setLocalStream(audioOnly);
        localStreamRef.current = audioOnly;
      }
      
      // 6. Stop AND remove all video tracks from processedStream
      if (processedStream) {
        const videoTracks = processedStream.getVideoTracks();
        videoTracks.forEach(t => {
          console.log(`🛑 Stopping processed video track: ${t.id}, readyState: ${t.readyState}`);
          t.stop();
          processedStream.removeTrack(t);
        });
        const audioOnly = new MediaStream(processedStream.getAudioTracks().filter(t => t.readyState === 'live'));
        setProcessedStream(audioOnly);
        processedStreamRef.current = audioOnly;
      }
      
      // 7. Update state
      setIsVideoEnabled(false);
      setParticipants(prev => prev.map(p => 
        p.id === participantId ? { ...p, isVideoEnabled: false } : p
      ));
      
      wsRef.current?.send(JSON.stringify({
        type: "toggle-video", roomId, participantId, isEnabled: false,
      }));
      
      console.log(`✅ Camera OFF - All video tracks stopped, hardware should be released`);
    } else {
      // === TURN ON - Request fresh camera access ===
      try {
        console.log(`📷 Requesting camera access...`);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1920, height: 1080 },
        });
        const newVideoTrack = stream.getVideoTracks()[0];
        console.log(`📷 Got new video track: ${newVideoTrack.id}`);
        
        // Get ONLY live audio tracks (not stopped ones)
        const liveAudioTracks = (localStream?.getAudioTracks() || [])
          .filter(t => t.readyState === 'live');
        
        // Also check processedStream for audio tracks
        const processedAudioTracks = (processedStream?.getAudioTracks() || [])
          .filter(t => t.readyState === 'live');
        
        // Use whichever has live audio tracks
        const audioTracks = processedAudioTracks.length > 0 ? processedAudioTracks : liveAudioTracks;
        
        // Create fresh streams with new video + any live audio
        const newLocalStream = new MediaStream([newVideoTrack, ...liveAudioTracks]);
        const newProcessedStream = new MediaStream([
          newVideoTrack.clone(), 
          ...audioTracks.map(t => t.clone())
        ]);
        
        // Add video track to media processor output stream
        mediaProcessorRef.current?.addVideoTrack(newVideoTrack.clone());
        
        // Update all native RTCPeerConnections with new video track
        peersRef.current.forEach((peer, peerId) => {
          peer._pc?.getSenders().forEach((sender: RTCRtpSender) => {
            if (!sender.track || sender.track.kind === 'video') {
              console.log(`📷 Replacing video track for peer ${peerId}`);
              sender.replaceTrack(newVideoTrack.clone());
            }
          });
        });
        
        // Update state and refs (refs for callbacks, state for React re-render)
        setLocalStream(newLocalStream);
        setProcessedStream(newProcessedStream);
        localStreamRef.current = newLocalStream;
        processedStreamRef.current = newProcessedStream;
        setIsVideoEnabled(true);
        setParticipants(prev => prev.map(p => 
          p.id === participantId ? { ...p, isVideoEnabled: true } : p
        ));
        
        wsRef.current?.send(JSON.stringify({
          type: "toggle-video", roomId, participantId, isEnabled: true,
        }));
        
        console.log(`✅ Camera ON - Hardware activated`);
      } catch (err) {
        console.error("Camera error:", err);
        toast({ title: "Camera Error", description: "Cannot access camera.", variant: "destructive" });
      }
    }
  };

  const stopScreenShare = (source: 'manual' | 'browser') => {
    if (!isScreenSharingRef.current) return;
    
    isScreenSharingRef.current = false;
    setIsScreenSharing(false);
    screenStream?.getTracks().forEach(track => track.stop());
    setScreenStream(null);
    
    wsRef.current?.send(JSON.stringify({
      type: "screen-share",
      roomId,
      participantId,
      isSharing: false,
    }));
    
    toast({
      title: "Screen Sharing Stopped",
      description: source === 'manual' 
        ? "You stopped sharing your screen"
        : "Screen sharing ended",
    });
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare('manual');
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { 
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          },
          audio: true,
        });
        
        setScreenStream(stream);
        setIsScreenSharing(true);
        isScreenSharingRef.current = true;
        
        wsRef.current?.send(JSON.stringify({
          type: "screen-share",
          roomId,
          participantId,
          isSharing: true,
        }));
        
        stream.getVideoTracks()[0].onended = () => {
          if (isScreenSharingRef.current) {
            stopScreenShare('browser');
          }
        };
        
        toast({
          title: "Screen Sharing Started",
          description: "You are now sharing your screen",
        });
      } catch (error) {
        console.error("Error sharing screen:", error);
        if ((error as Error).name !== 'NotAllowedError') {
          toast({
            title: "Screen Share Failed",
            description: "Could not start screen sharing",
            variant: "destructive",
          });
        }
      }
    }
  };

  const toggleHandRaise = () => {
    const newHandRaisedState = !handRaised;
    setHandRaised(newHandRaisedState);
    
    wsRef.current?.send(JSON.stringify({
      type: "raise-hand",
      roomId,
      participantId,
      isRaised: newHandRaisedState,
    }));
    
    setParticipants(prev => prev.map(p => 
      p.id === participantId ? { ...p, handRaised: newHandRaisedState } : p
    ));
  };

  const sendReaction = (emoji: string) => {
    wsRef.current?.send(JSON.stringify({
      type: "emoji-reaction",
      roomId,
      participantId,
      participantName,
      emoji,
    }));
  };

  const removeReaction = (id: string) => {
    setReactions(prev => prev.filter(r => r.id !== id));
  };

  const muteAllParticipants = () => {
    if (!isHost) return;
    
    wsRef.current?.send(JSON.stringify({
      type: "mute-all",
      roomId,
      participantId,
    }));
    
    toast({
      title: "Mute All",
      description: "All participants have been muted",
    });
  };

  const toggleRoomLock = () => {
    if (!isHost) return;
    
    const newLockedState = !isRoomLocked;
    
    wsRef.current?.send(JSON.stringify({
      type: "lock-room",
      roomId,
      participantId,
      isLocked: newLockedState,
    }));
  };

  const transferHost = (newHostId: string) => {
    if (!isHost) return;
    
    wsRef.current?.send(JSON.stringify({
      type: "transfer-host",
      roomId,
      participantId,
      newHostId,
    }));
    
    setShowTransferHost(false);
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
    
    clearSavedRoomState();
    cleanup();
    setLocation("/");
  };

  const handlePresetChange = async (preset: QualityPreset) => {
    setCurrentPreset(preset);
    
    if (preset === "custom") {
      toast({
        title: "Custom Preset",
        description: "Use manual controls to adjust settings",
      });
      return;
    }
    
    const presetConfig = QUALITY_PRESETS[preset];
    if (!presetConfig) return;
    
    setVideoQuality(presetConfig.videoQuality);
    
    if (presetConfig.audioSettings && mediaProcessorRef.current) {
      const audioSettings = presetConfig.audioSettings;
      if (audioSettings.gainControl !== undefined) {
        mediaProcessorRef.current.setGain(audioSettings.gainControl);
      }
      if (audioSettings.noiseSuppression !== undefined) {
        mediaProcessorRef.current.setNoiseSuppressionIntensity(audioSettings.noiseSuppression * 100);
      }
    }
    
    if (presetConfig.videoSettings) {
      setVideoSettings({
        brightness: presetConfig.videoSettings.brightness ?? 100,
        contrast: presetConfig.videoSettings.contrast ?? 100,
        saturation: presetConfig.videoSettings.saturation ?? 100,
      });
    }
    
    if (localStream && presetConfig.videoConstraints) {
      try {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
          await videoTrack.applyConstraints(presetConfig.videoConstraints);
        }
      } catch (err) {
        console.error("Error applying preset video constraints:", err);
      }
    }
    
    toast({
      title: "Preset Applied",
      description: `${presetConfig.name} - ${presetConfig.description}`,
    });
  };

  const handleQualityChange = async (quality: VideoQualityLevel) => {
    setVideoQuality(quality);
    setCurrentPreset("custom");
    
    if (!localStream) return;
    
    const effectiveQuality = quality === "auto" ? bandwidthStats.recommendedQuality : quality;
    const constraints = effectiveQuality !== "auto" ? VIDEO_QUALITY_CONSTRAINTS[effectiveQuality] : VIDEO_QUALITY_CONSTRAINTS.medium;
    
    try {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        await videoTrack.applyConstraints(constraints);
        toast({
          title: "Video Quality Updated",
          description: `Quality set to ${quality}${quality === "auto" ? ` (${effectiveQuality})` : ""}`,
        });
      }
    } catch (err) {
      console.error("Error applying video constraints:", err);
      toast({
        title: "Quality Change Failed",
        description: "Could not update video quality",
        variant: "destructive",
      });
    }
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try {
        await roomContainerRef.current?.requestFullscreen();
      } catch (err) {
        console.error("Error attempting to enable fullscreen:", err);
        toast({
          title: "Fullscreen Error",
          description: "Could not enter fullscreen mode",
          variant: "destructive",
        });
      }
    } else {
      try {
        await document.exitFullscreen();
      } catch (err) {
        console.error("Error attempting to exit fullscreen:", err);
      }
    }
  };

  const togglePictureInPicture = async () => {
    const videoElements = document.querySelectorAll('video');
    const activeVideo = Array.from(videoElements).find(v => v.srcObject && v.readyState >= 2);
    
    if (!activeVideo) {
      toast({
        title: "Picture-in-Picture Unavailable",
        description: "No active video to display",
        variant: "destructive",
      });
      return;
    }

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await activeVideo.requestPictureInPicture();
      }
    } catch (error) {
      console.error("PiP error:", error);
      toast({
        title: "Picture-in-Picture Error",
        description: "Could not activate Picture-in-Picture mode",
        variant: "destructive",
      });
    }
  };

  const recordingStartTimeRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (isRecording && !recordingStartTimeRef.current) {
      recordingStartTimeRef.current = Date.now();
    } else if (!isRecording) {
      recordingStartTimeRef.current = null;
    }
  }, [isRecording]);

  const addChapterMarker = () => {
    if (!isRecording) {
      toast({
        title: "Not Recording",
        description: "Chapter markers can only be added during recording",
        variant: "destructive",
      });
      return;
    }

    const elapsedMs = recordingStartTimeRef.current 
      ? Date.now() - recordingStartTimeRef.current 
      : 0;
    
    const marker = {
      timestamp: elapsedMs,
      label: `Chapter ${chapterMarkers.length + 1}`,
    };
    
    setChapterMarkers(prev => [...prev, marker]);
    
    toast({
      title: "Chapter Marker Added",
      description: `Marker at ${(elapsedMs / 1000).toFixed(1)}s`,
    });
  };

  const addShowNote = (noteText: string) => {
    const elapsedMs = recordingStartTimeRef.current 
      ? Date.now() - recordingStartTimeRef.current 
      : 0;
    
    const note = {
      timestamp: elapsedMs,
      note: noteText,
    };
    
    setShowNotes(prev => [...prev, note]);
  };

  const cleanup = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    localStream?.getTracks().forEach(track => track.stop());
    screenStream?.getTracks().forEach(track => track.stop());
    processedStream?.getTracks().forEach(track => track.stop());
    backgroundProcessedStream?.getTracks().forEach(track => track.stop());
    
    peersRef.current.forEach(peer => {
      peer.destroy();
    });
    peersRef.current.clear();
    
    mediaProcessorRef.current?.cleanup();
    backgroundProcessorRef.current?.cleanup();
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

  // Filter out current user from pending list - you should never need to approve yourself!
  const pendingParticipants = participants.filter(p => p.approvalStatus === "pending" && p.id !== participantId);
  const approvedParticipants = participants.filter(p => p.approvalStatus === "approved");

  return (
    <div ref={roomContainerRef} className="h-screen flex flex-col bg-background">
      <header className="h-16 border-b flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold" data-testid="text-room-name">Room: {roomId}</h1>
          <span className="text-sm text-muted-foreground font-mono" data-testid="text-duration">
            {formatDuration(duration)}
          </span>
          {isRecording && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-destructive/10 border border-destructive">
              <Radio className="h-3 w-3 text-destructive animate-pulse" />
              <span className="text-xs font-medium text-destructive" data-testid="text-recording-indicator">REC</span>
            </div>
          )}
          {isReconnecting && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500">
              <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
              <span className="text-xs font-medium text-yellow-600 dark:text-yellow-500" data-testid="text-reconnecting-indicator">Reconnecting...</span>
            </div>
          )}
          {!isReconnecting && participants.length > 1 && (
            <NetworkQualityIndicator
              quality={networkStats.quality}
              packetLoss={networkStats.packetLoss}
              latency={networkStats.latency}
              showDetails={false}
            />
          )}
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

      <div className="flex-1 flex overflow-hidden min-h-0">
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="flex-1 min-h-0 overflow-hidden">
            <VideoGrid
              participants={approvedParticipants}
              localStream={backgroundProcessedStream || processedStream || localStream}
              screenStream={screenStream}
              currentParticipantId={participantId}
              videoSettings={videoSettings}
              remoteStreams={remoteStreams}
              hideSelfView={hideSelfView}
              peers={peersRef.current}
              viewMode={viewMode}
              pinnedParticipantId={pinnedParticipantId}
              onTogglePin={(id) => setPinnedParticipantId(prev => prev === id ? null : id)}
              spotlightedParticipantId={spotlightedParticipantId}
              gridColumns={gridColumns}
              onToggleSpotlight={(id) => {
                if (!isHost) return;
                wsRef.current?.send(JSON.stringify({
                  type: "spotlight-participant",
                  roomId,
                  participantId,
                  targetParticipantId: spotlightedParticipantId === id ? null : id,
                }));
              }}
              isHost={isHost}
            />
          </div>

          <div className="h-16 border-t bg-card/50 backdrop-blur-sm flex items-center justify-center px-4">
            <div className="flex items-center gap-1 flex-wrap justify-center">
              <Button
                size="icon"
                variant={isAudioEnabled ? "default" : "destructive"}
                onClick={toggleAudio}
                className="rounded-full w-10 h-10"
                data-testid="button-toggle-audio"
              >
                {isAudioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </Button>

              <Button
                size="icon"
                variant={isVideoEnabled ? "default" : "destructive"}
                onClick={toggleVideo}
                className="rounded-full w-10 h-10"
                data-testid="button-toggle-video"
              >
                {isVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              </Button>

              <Button
                size="icon"
                variant={isScreenSharing ? "default" : "secondary"}
                onClick={toggleScreenShare}
                className="rounded-full w-10 h-10"
                data-testid="button-toggle-screen"
              >
                {isScreenSharing ? <MonitorOff className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
              </Button>

              <Button
                size="icon"
                variant={handRaised ? "default" : "secondary"}
                onClick={toggleHandRaise}
                className="rounded-full w-10 h-10"
                data-testid="button-raise-hand"
              >
                <Hand className="w-4 h-4" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="rounded-full w-10 h-10"
                    data-testid="button-reactions"
                  >
                    <Smile className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => sendReaction("👍")} data-testid="reaction-thumbs-up">
                    <span className="text-2xl">👍</span>
                    <span className="ml-2">Thumbs Up</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => sendReaction("❤️")} data-testid="reaction-heart">
                    <span className="text-2xl">❤️</span>
                    <span className="ml-2">Heart</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => sendReaction("👏")} data-testid="reaction-clap">
                    <span className="text-2xl">👏</span>
                    <span className="ml-2">Clap</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => sendReaction("😂")} data-testid="reaction-laugh">
                    <span className="text-2xl">😂</span>
                    <span className="ml-2">Laugh</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <RecordingControls
                ref={recordingControlsRef}
                isRecording={isRecording}
                canRecord={canRecord}
                onToggleRecording={() => {
                  if (!isRecording && !canRecord) {
                    toast({
                      title: "Recording Permission Required",
                      description: "You don't have permission to record. Ask the host to grant permission.",
                      variant: "destructive",
                    });
                    return;
                  }
                  setIsRecording(!isRecording);
                }}
                localStream={processedStream || localStream}
                onCountdownChange={setRecordingCountdown}
                remoteStreams={remoteStreams}
                participants={participants}
                participantName={participantName}
              />

              {isRecording && (
                <AudioWaveform
                  stream={processedStream || localStream}
                  width={200}
                  height={40}
                  className="mx-2"
                />
              )}

              <div className="w-px h-8 bg-border mx-2" />

              <Button
                size="icon"
                variant={showChat ? "default" : "secondary"}
                onClick={() => setShowChat(!showChat)}
                className="rounded-full w-10 h-10"
                data-testid="button-toggle-chat"
              >
                <MessageSquare className="w-4 h-4" />
              </Button>

              <Button
                size="icon"
                variant={showParticipants ? "default" : "secondary"}
                onClick={() => setShowParticipants(!showParticipants)}
                className="rounded-full w-10 h-10"
                data-testid="button-toggle-participants"
              >
                <Users className="w-4 h-4" />
              </Button>

              {/* View Mode Toggle - cycles through grid -> speaker -> self */}
              <div className="flex gap-0.5 bg-muted rounded-full p-0.5">
                <Button
                  size="icon"
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  onClick={() => setViewMode("grid")}
                  className="rounded-full w-8 h-8"
                  data-testid="button-view-grid"
                  title="Equal Grid View (G)"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant={viewMode === "speaker" ? "default" : "ghost"}
                  onClick={() => setViewMode("speaker")}
                  className="rounded-full w-8 h-8"
                  data-testid="button-view-speaker"
                  title="Speaker View (B)"
                >
                  <UserCircle className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant={viewMode === "self" ? "default" : "ghost"}
                  onClick={() => setViewMode("self")}
                  className="rounded-full w-8 h-8"
                  data-testid="button-view-self"
                  title="Self View Only (L)"
                >
                  <User className="w-3.5 h-3.5" />
                </Button>
              </div>

              <Button
                size="icon"
                variant={isFullscreen ? "default" : "secondary"}
                onClick={toggleFullscreen}
                className="rounded-full w-10 h-10"
                data-testid="button-toggle-fullscreen"
                title={isFullscreen ? "Exit Fullscreen (F)" : "Enter Fullscreen (F)"}
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </Button>

              <Button
                size="icon"
                variant={showSettings ? "default" : "secondary"}
                onClick={() => setShowSettings(!showSettings)}
                className="rounded-full w-10 h-10"
                data-testid="button-toggle-settings"
              >
                <Settings className="w-4 h-4" />
              </Button>

              <Button
                size="icon"
                variant={showBackgroundControls ? "default" : "secondary"}
                onClick={() => setShowBackgroundControls(!showBackgroundControls)}
                className="rounded-full w-10 h-10"
                data-testid="button-toggle-background"
                title="Background Effects"
              >
                <Wand2 className="w-4 h-4" />
              </Button>

              <Button
                size="icon"
                variant={showFileSharing ? "default" : "secondary"}
                onClick={() => setShowFileSharing(!showFileSharing)}
                className="rounded-full w-10 h-10"
                data-testid="button-toggle-files"
                title="File Sharing"
              >
                <FileUp className="w-4 h-4" />
              </Button>

              <div className="rounded-full overflow-hidden">
                <QualitySelector
                  currentQuality={videoQuality}
                  recommendedQuality={bandwidthStats.recommendedQuality}
                  onQualityChange={handleQualityChange}
                  availableBandwidth={bandwidthStats.availableBandwidth}
                />
              </div>

              <PresetSelector
                currentPreset={currentPreset}
                onPresetChange={handlePresetChange}
              />

              {isHost && (
                <div className="relative">
                  <Button
                    size="icon"
                    variant={showJoinRequests ? "default" : "secondary"}
                    onClick={() => setShowJoinRequests(!showJoinRequests)}
                    className="rounded-full w-10 h-10"
                    data-testid="button-toggle-requests"
                  >
                    <UserPlus className="w-4 h-4" />
                  </Button>
                  {pendingParticipants.length > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 text-xs"
                      data-testid="badge-pending-count"
                    >
                      {pendingParticipants.length}
                    </Badge>
                  )}
                </div>
              )}

              {isHost && (
                <Button
                  size="icon"
                  variant={isRoomLocked ? "default" : "secondary"}
                  onClick={toggleRoomLock}
                  className="rounded-full w-10 h-10"
                  data-testid="button-toggle-lock"
                  title={isRoomLocked ? "Unlock Room" : "Lock Room"}
                >
                  {isRoomLocked ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
                </Button>
              )}

              {isHost && approvedParticipants.filter(p => p.id !== participantId).length > 0 && (
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() => setShowTransferHost(true)}
                  className="rounded-full w-10 h-10"
                  data-testid="button-transfer-host"
                  title="Transfer Host"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                </Button>
              )}

              <div className="w-px h-6 bg-border mx-1" />

              <Button
                size="icon"
                variant="destructive"
                onClick={leaveRoom}
                className="rounded-full w-10 h-10"
                data-testid="button-leave-room"
              >
                <Phone className="w-4 h-4" />
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

        <BackgroundControls
          open={showBackgroundControls}
          onOpenChange={setShowBackgroundControls}
          settings={backgroundSettings}
          onSettingsChange={(settings) => setBackgroundSettings(prev => ({ ...prev, ...settings }))}
          isProcessing={isBackgroundProcessing}
        />

        {showFileSharing && (
          <FileSharing
            onClose={() => setShowFileSharing(false)}
            participantName={participantName}
            onFileShare={(file) => {
              setSharedFiles(prev => [...prev, file]);
              wsRef.current?.send(JSON.stringify({
                type: "file-share",
                roomId,
                file,
              }));
            }}
            sharedFiles={sharedFiles}
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

        <EmojiReactionsContainer
          reactions={reactions}
          onReactionComplete={removeReaction}
        />

        {recordingCountdown !== null && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 pointer-events-none">
            <div className="text-9xl font-bold text-white animate-pulse" data-testid="countdown-overlay">
              {recordingCountdown}
            </div>
          </div>
        )}

        <Dialog open={showTransferHost} onOpenChange={setShowTransferHost}>
          <DialogContent data-testid="transfer-host-dialog">
            <DialogHeader>
              <DialogTitle>Transfer Host</DialogTitle>
              <DialogDescription>
                Select a participant to transfer host role to. This will grant them full control of the room.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {approvedParticipants
                .filter(p => p.id !== participantId)
                .map(participant => (
                  <Button
                    key={participant.id}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => transferHost(participant.id)}
                    data-testid={`transfer-to-${participant.id}`}
                  >
                    <UserCircle className="w-4 h-4 mr-2" />
                    {participant.name}
                  </Button>
                ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
