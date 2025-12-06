import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Send } from "lucide-react";
import type { ChatMessage } from "@shared/schema";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  onClose: () => void;
  currentParticipantId: string;
}

export function ChatPanel({
  messages,
  onSendMessage,
  onClose,
  currentParticipantId,
}: ChatPanelProps) {
  const [inputMessage, setInputMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (inputMessage.trim()) {
      onSendMessage(inputMessage);
      setInputMessage("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className="fixed md:relative inset-0 md:inset-auto w-full md:w-80 border-l bg-card flex flex-col z-50 md:z-auto"
      data-testid="chat-panel"
    >
      <div className="h-12 sm:h-14 md:h-16 border-b flex items-center justify-between px-3 sm:px-4 flex-shrink-0 bg-card">
        <h2 className="font-semibold text-sm sm:text-base">Chat</h2>
        <Button
          size="icon"
          variant="ghost"
          onClick={onClose}
          data-testid="button-close-chat"
          className="h-8 w-8"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-3 sm:p-4" ref={scrollRef}>
        <div className="space-y-3 sm:space-y-4">
          {messages.length === 0 ? (
            <div
              className="text-center text-muted-foreground text-xs sm:text-sm py-8"
              data-testid="empty-chat"
            >
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex flex-col gap-1 ${
                  message.participantId === currentParticipantId
                    ? "items-end"
                    : "items-start"
                }`}
                data-testid={`message-${message.id}`}
              >
                <div className="flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground">
                  <span className="font-medium">{message.participantName}</span>
                  <span>{formatTime(message.timestamp)}</span>
                </div>
                <div
                  className={`rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 max-w-[85%] sm:max-w-[80%] break-words text-xs sm:text-sm ${
                    message.participantId === currentParticipantId
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {message.message}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="border-t p-3 sm:p-4 flex-shrink-0 bg-card">
        <div className="flex gap-2">
          <Input
            placeholder="Type a message..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            data-testid="input-chat-message"
            className="text-sm"
          />
          <Button
            onClick={handleSend}
            size="icon"
            data-testid="button-send-message"
            className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"
          >
            <Send className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
