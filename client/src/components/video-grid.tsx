import { useRef, useEffect, useState, useCallback } from "react";
import { VideoOff, Mic, MicOff, Pin, PinOff, AlertTriangle, Zap } from "lucide-react";
import { applyVideoFilters } from "@/lib/media-processor";
import type { Participant } from "@shared/schema";
import type { VideoSettings } from "./settings-panel";
import { useAudioLevel } from "@/hooks/use-audio-level";
import { AudioLevelMeter } from "@/components/audio-level-meter";
import { useActiveSpeaker, type ParticipantAudioLevel } from "@/hooks/use-active-speaker";
import { useConnectionQuality } from "@/hooks/use-connection-quality";
import { NetworkIndicator } from "@/components/network-indicator";
import { Button } from "@/components/ui/button";

export type ViewMode = "grid" | "speaker" | "self";

interface VideoGridProps {
  participants: Participant[];
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  currentParticipantId: string;
  videoSettings?: VideoSettings;
  remoteStreams?: Map<string, MediaStream>;
  hideSelfView?: boolean;
  peers?: Map<string, any>;
  viewMode?: ViewMode;
  pinnedParticipantId?: string | null;
  onTogglePin?: (participantId: string) => void;
  spotlightedParticipantId?: string | null;
  onToggleSpotlight?: (participantId: string) => void;
  isHost?: boolean;
  gridColumns?: 2 | 3 | 4;
}

export function VideoGrid({ participants, localStream, screenStream, currentParticipantId, videoSettings, remoteStreams, hideSelfView = false, peers, viewMode = "grid", pinnedParticipantId, onTogglePin, spotlightedParticipantId, onToggleSpotlight, isHost = false, gridColumns = 3 }: VideoGridProps) {
  const [participantLevels, setParticipantLevels] = useState<ParticipantAudioLevel[]>([]);
  const activeSpeakerId = useActiveSpeaker(participantLevels);

  const visibleParticipants = hideSelfView 
    ? participants.filter(p => p.id !== currentParticipantId)
    : participants;
  
  // In speaker view, determine who to show in main area: pinned > screen share (handled separately) > active speaker
  const speakerParticipant = viewMode === "speaker"
    ? (pinnedParticipantId 
        ? visibleParticipants.find(p => p.id === pinnedParticipantId)
        : activeSpeakerId ? visibleParticipants.find(p => p.id === activeSpeakerId) : null)
    : null;
  
  const otherParticipants = viewMode === "speaker" && speakerParticipant
    ? visibleParticipants.filter(p => p.id !== speakerParticipant.id)
    : visibleParticipants;

  const getGridClass = () => {
    const count = visibleParticipants.length + (screenStream ? 1 : 0);
    
    // Equal division podcast-style layout - use auto-rows-fr to fill full height
    if (count === 1) return "grid-cols-1 auto-rows-fr";
    if (count === 2) return "grid-cols-2 auto-rows-fr";
    if (count === 3) return "grid-cols-3 auto-rows-fr";
    if (count === 4) return "grid-cols-2 auto-rows-fr";
    if (count <= 6) return "grid-cols-3 auto-rows-fr";
    if (count <= 9) return "grid-cols-3 auto-rows-fr";
    return "grid-cols-4 auto-rows-fr";
  };

  const handleAudioLevelChange = useCallback((participantId: string, level: number) => {
    setParticipantLevels(prev => {
      const existing = prev.find(p => p.participantId === participantId);
      // Only update if level actually changed
      if (existing && existing.level === level) {
        return prev;
      }
      if (existing) {
        return prev.map(p => p.participantId === participantId ? { participantId, level } : p);
      }
      return [...prev, { participantId, level }];
    });
  }, []);

  const renderVideoTile = (participant: Participant, size?: "large" | "small") => {
    const stream = participant.id === currentParticipantId 
      ? localStream 
      : remoteStreams?.get(participant.id) || null;
    const peer = participant.id !== currentParticipantId 
      ? peers?.get(participant.id) 
      : null;
    const peerConnection = peer?._pc || null;
    
    return (
      <VideoTile
        key={participant.id}
        participant={participant}
        stream={stream}
        isSelf={participant.id === currentParticipantId}
        videoSettings={participant.id === currentParticipantId ? videoSettings : undefined}
        isActiveSpeaker={participant.id === activeSpeakerId}
        onAudioLevelChange={handleAudioLevelChange}
        peerConnection={peerConnection}
        size={size}
        isPinned={participant.id === pinnedParticipantId}
        onTogglePin={onTogglePin}
        isSpotlighted={participant.id === spotlightedParticipantId}
        onToggleSpotlight={onToggleSpotlight}
        isHost={isHost}
      />
    );
  };

  // Find self participant for self-view mode
  const selfParticipant = participants.find(p => p.id === currentParticipantId);

  // Render self-view only mode - fullscreen view of just yourself
  if (viewMode === "self" && selfParticipant) {
    return (
      <div className="h-full w-full" data-testid="video-grid-self">
        <VideoTile
          participant={selfParticipant}
          stream={localStream}
          isSelf={true}
          videoSettings={videoSettings}
          isActiveSpeaker={false}
          onAudioLevelChange={handleAudioLevelChange}
          size="large"
        />
      </div>
    );
  }

  // Render grid view - equal division podcast layout
  if (viewMode === "grid") {
    return (
      <div className={`grid ${getGridClass()} gap-1 h-full w-full`} data-testid="video-grid">
        {screenStream && (
          <VideoTile
            participant={{ id: "screen", name: "Screen Share", roomId: "", isAudioEnabled: false, isVideoEnabled: true, isScreenSharing: true, isHost: false, approvalStatus: "approved", handRaised: false, canRecord: false, joinedAt: Date.now() }}
            stream={screenStream}
            isSelf={false}
            isActiveSpeaker={false}
            onAudioLevelChange={handleAudioLevelChange}
          />
        )}
        
        {visibleParticipants.map((participant) => renderVideoTile(participant))}
      </div>
    );
  }

  // Render speaker view
  return (
    <div className="flex flex-col h-full w-full gap-1" data-testid="video-grid-speaker">
      {/* Main speaker area - prioritize screen share if active */}
      <div className="flex-1 min-h-0">
        {screenStream ? (
          <VideoTile
            participant={{ id: "screen", name: "Screen Share", roomId: "", isAudioEnabled: false, isVideoEnabled: true, isScreenSharing: true, isHost: false, approvalStatus: "approved", handRaised: false, canRecord: false, joinedAt: Date.now() }}
            stream={screenStream}
            isSelf={false}
            isActiveSpeaker={false}
            onAudioLevelChange={handleAudioLevelChange}
            size="large"
          />
        ) : speakerParticipant ? (
          renderVideoTile(speakerParticipant, "large")
        ) : (
          <div className="h-full flex items-center justify-center bg-muted rounded-lg">
            <p className="text-muted-foreground">Waiting for someone to speak...</p>
          </div>
        )}
      </div>

      {/* Other participants strip - when screen sharing, show active speaker + others */}
      {(screenStream ? visibleParticipants : otherParticipants).length > 0 && (
        <div className="h-32 flex gap-2 overflow-x-auto">
          {(screenStream ? visibleParticipants : otherParticipants).map((participant) => (
            <div key={participant.id} className="h-full aspect-video flex-shrink-0">
              {renderVideoTile(participant, "small")}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface VideoTileProps {
  participant: Participant;
  stream: MediaStream | null;
  isSelf: boolean;
  videoSettings?: VideoSettings;
  isActiveSpeaker: boolean;
  onAudioLevelChange: (participantId: string, level: number) => void;
  peerConnection?: any;
  size?: "large" | "small";
  isPinned?: boolean;
  onTogglePin?: (participantId: string) => void;
  isSpotlighted?: boolean;
  onToggleSpotlight?: (participantId: string) => void;
  isHost?: boolean;
}

function VideoTile({ participant, stream, isSelf, videoSettings, isActiveSpeaker, onAudioLevelChange, peerConnection, size, isPinned = false, onTogglePin, isSpotlighted = false, onToggleSpotlight, isHost = false }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { level: audioLevel, isClipping } = useAudioLevel(stream, participant.isAudioEnabled);
  const connectionStats = useConnectionQuality(peerConnection);

  // Report audio level changes to parent
  useEffect(() => {
    onAudioLevelChange(participant.id, audioLevel);
  }, [audioLevel, participant.id, onAudioLevelChange]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
    // Cleanup: clear srcObject when unmounting or stream changes
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]);

  useEffect(() => {
    if (videoRef.current && videoSettings && isSelf) {
      applyVideoFilters(
        videoRef.current,
        videoSettings.brightness,
        videoSettings.contrast,
        videoSettings.saturation,
        videoSettings.smoothing || 0,
        videoSettings.sharpness || 100
      );
    }
  }, [videoSettings, isSelf]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getGradient = (name: string) => {
    const hue = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;
    return `linear-gradient(135deg, hsl(${hue}, 70%, 60%), hsl(${(hue + 60) % 360}, 70%, 60%))`;
  };

  return (
    <div 
      className={`relative h-full w-full bg-muted rounded-lg overflow-hidden border ${
        isSpotlighted
          ? "border-4 border-yellow-500 shadow-2xl shadow-yellow-500/70 ring-2 ring-yellow-400" 
          : isActiveSpeaker 
          ? "border-2 border-primary shadow-lg shadow-primary/50" 
          : "border border-border"
      } hover-elevate transition-all`}
      data-testid={`video-tile-${participant.id}`}
    >
      {participant.isVideoEnabled && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf}
          className={`w-full h-full object-cover ${isSelf ? 'scale-x-[-1]' : ''}`}
          data-testid={`video-stream-${participant.id}`}
        />
      ) : (
        <div 
          className="w-full h-full flex items-center justify-center"
          style={{ background: getGradient(participant.name) }}
          data-testid={`video-off-${participant.id}`}
        >
          <div className="text-6xl font-bold text-white/90">
            {getInitials(participant.name)}
          </div>
        </div>
      )}

      {/* Pin and Spotlight buttons - top right corner */}
      {(onTogglePin || (onToggleSpotlight && isHost)) && !isSelf && (
        <div className="absolute top-2 right-2 flex gap-2">
          {onTogglePin && (
            <Button
              size="icon"
              variant={isPinned ? "default" : "secondary"}
              className="h-8 w-8 rounded-full bg-black/60 backdrop-blur-sm hover:bg-black/80"
              onClick={() => onTogglePin(participant.id)}
              data-testid={`button-pin-${participant.id}`}
              title={isPinned ? "Unpin participant" : "Pin participant"}
            >
              {isPinned ? (
                <PinOff className="w-4 h-4" />
              ) : (
                <Pin className="w-4 h-4" />
              )}
            </Button>
          )}
          {onToggleSpotlight && isHost && (
            <Button
              size="icon"
              variant={isSpotlighted ? "default" : "secondary"}
              className={`h-8 w-8 rounded-full bg-black/60 backdrop-blur-sm hover:bg-black/80 ${isSpotlighted ? 'ring-2 ring-yellow-500' : ''}`}
              onClick={() => onToggleSpotlight(participant.id)}
              data-testid={`button-spotlight-${participant.id}`}
              title={isSpotlighted ? "Remove spotlight" : "Spotlight this participant"}
            >
              <Zap className={`w-4 h-4 ${isSpotlighted ? 'text-yellow-500' : ''}`} />
            </Button>
          )}
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-medium" data-testid={`participant-name-${participant.id}`}>
              {participant.name} {isSelf && "(You)"}
            </span>
            {!isSelf && <NetworkIndicator quality={connectionStats.quality} />}
            {isClipping && participant.isAudioEnabled && (
              <div 
                className="bg-destructive rounded-full p-1 animate-pulse" 
                data-testid={`audio-clipping-${participant.id}`}
                title="Audio clipping detected - reduce volume"
              >
                <AlertTriangle className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
          
          {!participant.isAudioEnabled && (
            <div className="bg-destructive rounded-full p-1" data-testid={`audio-muted-${participant.id}`}>
              <MicOff className="w-4 h-4 text-white" />
            </div>
          )}
        </div>
        
        {participant.isAudioEnabled && (
          <AudioLevelMeter level={audioLevel} />
        )}
      </div>
    </div>
  );
}
