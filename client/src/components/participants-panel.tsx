import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Mic, MicOff, Video, VideoOff, UserX, Hand } from "lucide-react";
import type { Participant } from "@shared/schema";

interface ParticipantsPanelProps {
  participants: Participant[];
  currentParticipantId: string;
  isHost: boolean;
  onClose: () => void;
  onRemoveParticipant?: (participantId: string) => void;
}

export function ParticipantsPanel({
  participants,
  currentParticipantId,
  isHost,
  onClose,
  onRemoveParticipant,
}: ParticipantsPanelProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getGradient = (name: string) => {
    const hue =
      name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;
    return `linear-gradient(135deg, hsl(${hue}, 70%, 60%), hsl(${
      (hue + 60) % 360
    }, 70%, 60%))`;
  };

  return (
    <div
      className="fixed md:relative inset-0 md:inset-auto w-full md:w-80 border-l bg-card flex flex-col z-50 md:z-auto"
      data-testid="participants-panel"
    >
      <div className="h-12 sm:h-14 md:h-16 border-b flex items-center justify-between px-3 sm:px-4 flex-shrink-0 bg-card">
        <h2 className="font-semibold text-sm sm:text-base">
          Participants ({participants.length})
        </h2>
        <Button
          size="icon"
          variant="ghost"
          onClick={onClose}
          data-testid="button-close-participants"
          className="h-8 w-8"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-3 sm:p-4">
        <div className="space-y-2">
          {participants.map((participant) => (
            <div
              key={participant.id}
              className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg hover-elevate border"
              data-testid={`participant-item-${participant.id}`}
            >
              <div
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-medium text-xs sm:text-sm flex-shrink-0"
                style={{ background: getGradient(participant.name) }}
              >
                {getInitials(participant.name)}
              </div>

              <div className="flex-1 min-w-0">
                <div
                  className="font-medium truncate flex items-center gap-1 sm:gap-2 text-sm sm:text-base"
                  data-testid={`participant-name-list-${participant.id}`}
                >
                  {participant.name}
                  {participant.isHost && (
                    <span className="text-[10px] sm:text-xs bg-primary/10 text-primary px-1 sm:px-1.5 py-0.5 rounded">
                      Host
                    </span>
                  )}
                  {participant.handRaised && (
                    <Hand
                      className="w-3 h-3 sm:w-4 sm:h-4 text-primary"
                      data-testid={`hand-raised-${participant.id}`}
                    />
                  )}
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1">
                  {participant.isAudioEnabled ? (
                    <Mic className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  ) : (
                    <MicOff className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-destructive" />
                  )}
                  {participant.isVideoEnabled ? (
                    <Video className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  ) : (
                    <VideoOff className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-destructive" />
                  )}
                </div>
              </div>

              {isHost &&
                participant.id !== currentParticipantId &&
                !participant.isHost && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRemoveParticipant?.(participant.id)}
                    className="gap-1 text-destructive hover:text-destructive text-xs flex-shrink-0"
                    data-testid={`button-remove-${participant.id}`}
                  >
                    <UserX className="w-3 h-3" />
                    <span className="hidden sm:inline">Remove</span>
                  </Button>
                )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
