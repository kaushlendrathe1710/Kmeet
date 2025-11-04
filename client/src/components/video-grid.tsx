import { useRef, useEffect } from "react";
import { VideoOff, Mic, MicOff } from "lucide-react";
import { applyVideoFilters } from "@/lib/media-processor";
import type { Participant } from "@shared/schema";
import type { VideoSettings } from "./settings-panel";

interface VideoGridProps {
  participants: Participant[];
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  currentParticipantId: string;
  videoSettings?: VideoSettings;
  remoteStreams?: Map<string, MediaStream>;
}

export function VideoGrid({ participants, localStream, screenStream, currentParticipantId, videoSettings, remoteStreams }: VideoGridProps) {
  const getGridClass = () => {
    const count = participants.length + (screenStream ? 1 : 0);
    
    if (count === 1) return "grid-cols-1";
    if (count === 2) return "grid-cols-2";
    if (count <= 4) return "grid-cols-2";
    if (count <= 6) return "grid-cols-3";
    if (count <= 9) return "grid-cols-3";
    return "grid-cols-4";
  };

  return (
    <div className={`grid ${getGridClass()} gap-4 h-full w-full`} data-testid="video-grid">
      {screenStream && (
        <VideoTile
          participant={{ id: "screen", name: "Screen Share", roomId: "", isAudioEnabled: false, isVideoEnabled: true, isScreenSharing: true, joinedAt: Date.now() }}
          stream={screenStream}
          isSelf={false}
        />
      )}
      
      {participants.map((participant) => {
        const stream = participant.id === currentParticipantId 
          ? localStream 
          : remoteStreams?.get(participant.id) || null;
        
        return (
          <VideoTile
            key={participant.id}
            participant={participant}
            stream={stream}
            isSelf={participant.id === currentParticipantId}
            videoSettings={participant.id === currentParticipantId ? videoSettings : undefined}
          />
        );
      })}
    </div>
  );
}

interface VideoTileProps {
  participant: Participant;
  stream: MediaStream | null;
  isSelf: boolean;
  videoSettings?: VideoSettings;
}

function VideoTile({ participant, stream, isSelf, videoSettings }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (videoRef.current && videoSettings && isSelf) {
      applyVideoFilters(
        videoRef.current,
        videoSettings.brightness,
        videoSettings.contrast,
        videoSettings.saturation
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
      className="relative aspect-video bg-muted rounded-lg overflow-hidden border border-border hover-elevate transition-all"
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

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
        <div className="flex items-center justify-between">
          <span className="text-white text-sm font-medium" data-testid={`participant-name-${participant.id}`}>
            {participant.name} {isSelf && "(You)"}
          </span>
          
          {!participant.isAudioEnabled && (
            <div className="bg-destructive rounded-full p-1" data-testid={`audio-muted-${participant.id}`}>
              <MicOff className="w-4 h-4 text-white" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
