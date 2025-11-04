import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

interface WaitingRoomProps {
  roomId: string;
  participantName: string;
}

export function WaitingRoom({ roomId, participantName }: WaitingRoomProps) {
  return (
    <div className="h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Clock className="w-8 h-8 text-primary animate-pulse" />
            </div>
          </div>
          <CardTitle className="text-2xl">Waiting for Host Approval</CardTitle>
          <CardDescription>
            You're waiting to join room: <span className="font-mono font-semibold">{roomId}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Hello, <span className="font-semibold">{participantName}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              The host will be notified of your join request. Please wait while they review and approve your entry.
            </p>
          </div>
          
          <div className="bg-muted p-4 rounded-md text-center">
            <p className="text-xs text-muted-foreground">
              This may take a few moments...
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
