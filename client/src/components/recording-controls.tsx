import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Radio, Square, Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import RecordRTC, { RecordRTCPromisesHandler } from "recordrtc";

interface RecordingControlsProps {
  isRecording: boolean;
  onToggleRecording: () => void;
  localStream: MediaStream | null;
}

export function RecordingControls({ isRecording, onToggleRecording, localStream }: RecordingControlsProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const recorderRef = useRef<RecordRTCPromisesHandler | null>(null);

  const startRecording = async () => {
    if (!localStream) {
      toast({
        title: "Recording Error",
        description: "No media stream available to record.",
        variant: "destructive",
      });
      return;
    }

    try {
      const recorder = new RecordRTCPromisesHandler(localStream, {
        type: "video",
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: 128000,
        frameRate: 30,
      });

      await recorder.startRecording();
      recorderRef.current = recorder;
      onToggleRecording();
      
      toast({
        title: "Recording Started",
        description: "Your podcast session is now being recorded.",
      });
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        title: "Recording Error",
        description: "Failed to start recording. Please try again.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = async () => {
    if (!recorderRef.current) return;

    try {
      setIsProcessing(true);
      await recorderRef.current.stopRecording();
      const blob = await recorderRef.current.getBlob();
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `podcast-recording-${Date.now()}.webm`;
      a.click();
      
      URL.revokeObjectURL(url);
      recorderRef.current = null;
      onToggleRecording();
      setIsProcessing(false);
      
      toast({
        title: "Recording Saved",
        description: "Your recording has been downloaded successfully.",
      });
    } catch (error) {
      console.error("Error stopping recording:", error);
      setIsProcessing(false);
      toast({
        title: "Recording Error",
        description: "Failed to save recording. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleToggle = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <Button
      size="icon"
      variant={isRecording ? "destructive" : "secondary"}
      onClick={handleToggle}
      disabled={isProcessing}
      className="rounded-full w-12 h-12"
      data-testid="button-toggle-recording"
    >
      {isProcessing ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : isRecording ? (
        <Square className="w-5 h-5" />
      ) : (
        <Radio className="w-5 h-5" />
      )}
    </Button>
  );
}
