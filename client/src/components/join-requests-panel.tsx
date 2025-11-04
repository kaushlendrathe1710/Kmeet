import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { X, Check, UserPlus } from "lucide-react";
import type { Participant } from "@shared/schema";

interface JoinRequestsPanelProps {
  pendingParticipants: Participant[];
  onApprove: (participantId: string) => void;
  onDeny: (participantId: string) => void;
  onClose: () => void;
}

export function JoinRequestsPanel({
  pendingParticipants,
  onApprove,
  onDeny,
  onClose,
}: JoinRequestsPanelProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="w-96 border-l bg-card flex flex-col" data-testid="join-requests-panel">
      <div className="h-16 border-b flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          <h2 className="font-semibold">Join Requests</h2>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={onClose}
          data-testid="button-close-requests"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {pendingParticipants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserPlus className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No pending join requests</p>
            </div>
          ) : (
            pendingParticipants.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center gap-3 p-3 rounded-md border bg-card hover-elevate"
                data-testid={`request-${participant.id}`}
              >
                <Avatar>
                  <AvatarFallback>{getInitials(participant.name)}</AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{participant.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Waiting to join
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => onApprove(participant.id)}
                    className="gap-1"
                    data-testid={`button-approve-${participant.id}`}
                  >
                    <Check className="w-3 h-3" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onDeny(participant.id)}
                    data-testid={`button-deny-${participant.id}`}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
