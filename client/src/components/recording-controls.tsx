import * as React from "react";
import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { Radio, Square, Download, Loader2, Music, Play, Pause } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import RecordRTC, { RecordRTCPromisesHandler } from "recordrtc";
import type { Participant } from "@shared/schema";

interface RecordingControlsProps {
  isRecording: boolean;
  canRecord?: boolean;
  onToggleRecording: () => void;
  localStream: MediaStream | null;
  onCountdownChange?: (countdown: number | null) => void;
  remoteStreams?: Map<string, MediaStream>;
  participants?: Participant[];
  participantName?: string;
}

export interface RecordingControlsHandle {
  toggleRecording: () => void;
  cancelCountdown: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
}

interface TrackRecording {
  recorder: RecordRTCPromisesHandler;
  participantId: string;
  participantName: string;
}

interface CompletedTrack {
  blob: Blob;
  participantName: string;
  participantId: string;
}

const RecordingControls = forwardRef(
  ({ isRecording, onToggleRecording, localStream, onCountdownChange, remoteStreams, participants, participantName }: RecordingControlsProps, ref: React.ForwardedRef<RecordingControlsHandle>) => {
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [trackCount, setTrackCount] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const trackRecordingsRef = useRef<Map<string, TrackRecording>>(new Map());
    const completedTracksRef = useRef<CompletedTrack[]>([]);
    const countdownCancelledRef = useRef(false);
    const isRecordingRef = useRef(false);
    const isPausedRef = useRef(false);

    useEffect(() => {
      isRecordingRef.current = isRecording;
    }, [isRecording]);

    useEffect(() => {
      isPausedRef.current = isPaused;
    }, [isPaused]);

    useEffect(() => {
      if (countdown !== null && onCountdownChange) {
        onCountdownChange(countdown);
      }
    }, [countdown, onCountdownChange]);

    // Dynamically add/remove recorders when participants join/leave during recording
    useEffect(() => {
      if (!isRecordingRef.current || !remoteStreams || !participants) return;

      (async () => {
        const addParticipantRecording = async (participantId: string, stream: MediaStream) => {
        if (trackRecordingsRef.current.has(participantId)) return;

        const audioTrack = stream.getAudioTracks()[0];
        if (!audioTrack) return;

        try {
          const audioStream = new MediaStream([audioTrack]);
          const participant = participants.find(p => p.id === participantId);
          
          const remoteRecorder = new RecordRTCPromisesHandler(audioStream, {
            type: "audio",
            mimeType: "audio/webm",
            audioBitsPerSecond: 128000,
            numberOfAudioChannels: 1,
          });

          await remoteRecorder.startRecording();
          
          // If recording is paused, immediately pause this new recorder to match global state
          if (isPausedRef.current) {
            await remoteRecorder.pauseRecording();
            console.log(`New participant ${participant?.name} recorder started in paused state (matching global pause)`);
          }
          
          trackRecordingsRef.current.set(participantId, {
            recorder: remoteRecorder,
            participantId,
            participantName: participant?.name || "Unknown",
          });
          setTrackCount(trackRecordingsRef.current.size);

          console.log(`Added recording for participant ${participant?.name} who joined mid-session`);
        } catch (error) {
          console.error(`Failed to add recording for participant ${participantId}:`, error);
        }
      };

        // Add recorders for new participants
        const streamEntries = Array.from(remoteStreams.entries());
        for (const [participantId, stream] of streamEntries) {
          await addParticipantRecording(participantId, stream);
        }

        // Save and remove recorders for participants who left
        const currentParticipantIds = new Set(Array.from(remoteStreams.keys()));
        const trackEntries = Array.from(trackRecordingsRef.current.entries());
        for (const [participantId] of trackEntries) {
          if (participantId !== "local" && !currentParticipantIds.has(participantId)) {
            const recording = trackRecordingsRef.current.get(participantId);
            if (recording) {
              try {
                // Save the audio before removing the recorder
                await recording.recorder.stopRecording();
                const blob = await recording.recorder.getBlob();
                
                // Store the completed track for later download
                completedTracksRef.current.push({
                  blob,
                  participantName: recording.participantName,
                  participantId: recording.participantId,
                });
                
                console.log(`Saved audio for participant ${recording.participantName} who left mid-session`);
              } catch (error) {
                console.error(`Failed to save recording for departed participant ${recording.participantName}:`, error);
              }
              
              trackRecordingsRef.current.delete(participantId);
              setTrackCount(trackRecordingsRef.current.size);
            }
          }
        }
      })();
    }, [remoteStreams, participants, isRecording]);

  const startRecording = async () => {
    if (!localStream) {
      toast({
        title: "Recording Error",
        description: "No media stream available to record.",
        variant: "destructive",
      });
      return;
    }

    countdownCancelledRef.current = false;
    
    setCountdown(3);
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (countdownCancelledRef.current) return;
    
    setCountdown(2);
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (countdownCancelledRef.current) return;
    
    setCountdown(1);
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (countdownCancelledRef.current) return;
    
    setCountdown(null);
    if (onCountdownChange) {
      onCountdownChange(null);
    }

    try {
      const trackRecordings = new Map<string, TrackRecording>();
      let recordedTracks = 0;

      // Record local participant's audio as a separate track
      const localAudioTrack = localStream.getAudioTracks()[0];
      if (localAudioTrack) {
        const localAudioStream = new MediaStream([localAudioTrack]);
        const localRecorder = new RecordRTCPromisesHandler(localAudioStream, {
          type: "audio",
          mimeType: "audio/webm",
          audioBitsPerSecond: 128000,
          numberOfAudioChannels: 1,
        });

        await localRecorder.startRecording();
        trackRecordings.set("local", {
          recorder: localRecorder,
          participantId: "local",
          participantName: participantName || "You",
        });
        recordedTracks++;
      }

      // Record each remote participant's audio as a separate track
      if (remoteStreams && participants) {
        const streamEntries = Array.from(remoteStreams.entries());
        for (const [participantId, stream] of streamEntries) {
          const audioTrack = stream.getAudioTracks()[0];
          if (audioTrack) {
            const audioStream = new MediaStream([audioTrack]);
            const participant = participants.find(p => p.id === participantId);
            
            const remoteRecorder = new RecordRTCPromisesHandler(audioStream, {
              type: "audio",
              mimeType: "audio/webm",
              audioBitsPerSecond: 128000,
              numberOfAudioChannels: 1,
            });

            await remoteRecorder.startRecording();
            trackRecordings.set(participantId, {
              recorder: remoteRecorder,
              participantId,
              participantName: participant?.name || "Unknown",
            });
            recordedTracks++;
          }
        }
      }

      // Only start recording if we have at least one track
      if (recordedTracks === 0) {
        toast({
          title: "No Audio Tracks",
          description: "No audio available to record. Please enable your microphone or wait for participants to join.",
          variant: "destructive",
        });
        return;
      }

      trackRecordingsRef.current = trackRecordings;
      setTrackCount(recordedTracks);
      onToggleRecording();
      
      toast({
        title: "Multi-Track Recording Started",
        description: `Recording ${recordedTracks} separate audio track${recordedTracks > 1 ? 's' : ''} for professional editing.`,
      });
    } catch (error) {
      console.error("Error starting recording:", error);
      setCountdown(null);
      if (onCountdownChange) {
        onCountdownChange(null);
      }
      toast({
        title: "Recording Error",
        description: "Failed to start recording. Please try again.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = async () => {
    setIsProcessing(true);
    
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      let downloadedTracks = 0;

      // Download tracks from participants who left early
      for (const completedTrack of completedTracksRef.current) {
        try {
          const url = URL.createObjectURL(completedTrack.blob);
          const a = document.createElement("a");
          a.style.display = "none";
          a.href = url;
          
          const cleanName = completedTrack.participantName.replace(/[^a-zA-Z0-9]/g, '-');
          a.download = `${timestamp}_${cleanName}_audio.webm`;
          
          document.body.appendChild(a);
          a.click();
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
          URL.revokeObjectURL(url);
          document.body.removeChild(a);
          downloadedTracks++;
        } catch (error) {
          console.error(`Error downloading completed track for ${completedTrack.participantName}:`, error);
        }
      }

      // Stop and download currently active tracks
      const trackEntries = Array.from(trackRecordingsRef.current.entries());
      for (const [participantId, trackRecording] of trackEntries) {
        try {
          await trackRecording.recorder.stopRecording();
          const blob = await trackRecording.recorder.getBlob();
          
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.style.display = "none";
          a.href = url;
          
          // Clean filename: remove special characters
          const cleanName = trackRecording.participantName.replace(/[^a-zA-Z0-9]/g, '-');
          a.download = `${timestamp}_${cleanName}_audio.webm`;
          
          document.body.appendChild(a);
          a.click();
          
          // Small delay between downloads to avoid browser blocking
          await new Promise(resolve => setTimeout(resolve, 100));
          
          URL.revokeObjectURL(url);
          document.body.removeChild(a);
          downloadedTracks++;
        } catch (error) {
          console.error(`Error saving track for ${trackRecording.participantName}:`, error);
        }
      }

      trackRecordingsRef.current.clear();
      completedTracksRef.current = [];
      setTrackCount(0);
      setIsPaused(false);
      onToggleRecording();
      
      if (downloadedTracks === 0) {
        toast({
          title: "Recording Stopped",
          description: "No audio tracks were recorded.",
        });
      } else {
        toast({
          title: "Multi-Track Recording Saved",
          description: `Successfully downloaded ${downloadedTracks} separate audio track${downloadedTracks > 1 ? 's' : ''}. Perfect for podcast editing!`,
        });
      }
    } catch (error) {
      console.error("Error stopping recording:", error);
      // Always clear state to prevent UI from getting stuck
      trackRecordingsRef.current.clear();
      completedTracksRef.current = [];
      setTrackCount(0);
      setIsPaused(false);
      onToggleRecording();
      toast({
        title: "Recording Error",
        description: "Failed to save some recordings, but recording has been stopped.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggle = () => {
    if (countdown !== null) return;
    
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const cancelCountdown = () => {
    countdownCancelledRef.current = true;
    setCountdown(null);
    if (onCountdownChange) {
      onCountdownChange(null);
    }
    toast({
      title: "Countdown Cancelled",
      description: "Recording has been cancelled",
    });
  };

  const pauseRecording = async () => {
    if (!isRecording || isPaused) return;

    try {
      // Update ref immediately to prevent race condition with participant joins
      isPausedRef.current = true;
      setIsPaused(true);
      
      const trackEntries = Array.from(trackRecordingsRef.current.values());
      for (const trackRecording of trackEntries) {
        await trackRecording.recorder.pauseRecording();
      }
      
      toast({
        title: "Recording Paused",
        description: "All tracks have been paused",
      });
    } catch (error) {
      console.error("Error pausing recording:", error);
      // Rollback on error
      isPausedRef.current = false;
      setIsPaused(false);
      toast({
        title: "Pause Error",
        description: "Failed to pause recording",
        variant: "destructive",
      });
    }
  };

  const resumeRecording = async () => {
    if (!isRecording || !isPaused) return;

    try {
      // Update ref immediately to prevent race condition with participant joins
      isPausedRef.current = false;
      setIsPaused(false);
      
      const trackEntries = Array.from(trackRecordingsRef.current.values());
      for (const trackRecording of trackEntries) {
        await trackRecording.recorder.resumeRecording();
      }
      
      toast({
        title: "Recording Resumed",
        description: "All tracks have been resumed",
      });
    } catch (error) {
      console.error("Error resuming recording:", error);
      // Rollback on error
      isPausedRef.current = true;
      setIsPaused(true);
      toast({
        title: "Resume Error",
        description: "Failed to resume recording",
        variant: "destructive",
      });
    }
  };

  useImperativeHandle(ref, () => ({
    toggleRecording: handleToggle,
    cancelCountdown,
    pauseRecording,
    resumeRecording
  }));

  return (
    <div className="flex items-center gap-2">
      <Button
        size="icon"
        variant={isRecording ? "destructive" : "secondary"}
        onClick={handleToggle}
        disabled={isProcessing || countdown !== null}
        className="rounded-full w-12 h-12"
        data-testid="button-toggle-recording"
      >
        {isProcessing ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : countdown !== null ? (
          <span className="text-lg font-bold">{countdown}</span>
        ) : isRecording ? (
          <Square className="w-5 h-5" />
        ) : (
          <Radio className="w-5 h-5" />
        )}
      </Button>
      {isRecording && trackCount > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 bg-destructive/10 rounded-md" data-testid="track-count-indicator">
          <Music className="w-4 h-4 text-destructive" />
          <span className="text-sm font-medium text-destructive">{trackCount} tracks</span>
        </div>
      )}
      {isRecording && (
        <Button
          size="icon"
          variant="secondary"
          onClick={isPaused ? resumeRecording : pauseRecording}
          disabled={isProcessing}
          className="rounded-full w-12 h-12"
          data-testid="button-pause-resume-recording"
          title={isPaused ? "Resume Recording" : "Pause Recording"}
        >
          {isPaused ? (
            <Play className="w-5 h-5" />
          ) : (
            <Pause className="w-5 h-5" />
          )}
        </Button>
      )}
    </div>
  );
});

RecordingControls.displayName = "RecordingControls";

export { RecordingControls };
