import { useState, useEffect, useRef } from "react";

export interface ParticipantAudioLevel {
  participantId: string;
  level: number;
}

/**
 * Hook to detect the active speaker from a list of participant audio levels
 * Returns the ID of the participant currently speaking (or null if no one is speaking)
 */
export function useActiveSpeaker(
  participantLevels: ParticipantAudioLevel[],
  threshold: number = 20, // Minimum level to be considered "speaking"
  debounceMs: number = 300 // How long someone must be quiet before switching active speaker
): string | null {
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const lastSpeakerChangeRef = useRef<number>(Date.now());
  const currentLeaderRef = useRef<string | null>(null);

  useEffect(() => {
    // Find participant with highest audio level above threshold
    let maxLevel = threshold;
    let loudestParticipant: string | null = null;

    for (const { participantId, level } of participantLevels) {
      if (level > maxLevel) {
        maxLevel = level;
        loudestParticipant = participantId;
      }
    }

    const now = Date.now();
    const timeSinceLastChange = now - lastSpeakerChangeRef.current;

    // If we have a new leader and enough time has passed, update active speaker
    if (loudestParticipant !== currentLeaderRef.current) {
      currentLeaderRef.current = loudestParticipant;
      
      // Immediate switch if someone starts speaking when no one was active
      if (activeSpeakerId === null && loudestParticipant !== null) {
        setActiveSpeakerId(loudestParticipant);
        lastSpeakerChangeRef.current = now;
      }
      // Otherwise apply debounce to prevent rapid switching
      else if (timeSinceLastChange >= debounceMs) {
        setActiveSpeakerId(loudestParticipant);
        lastSpeakerChangeRef.current = now;
      }
    }
  }, [participantLevels, threshold, debounceMs, activeSpeakerId]);

  return activeSpeakerId;
}
