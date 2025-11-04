import { useState, useEffect, useRef } from "react";

// Shared AudioContext instance to avoid hitting browser limits (Chrome allows ~6 contexts)
let sharedAudioContext: AudioContext | null = null;

function getSharedAudioContext(): AudioContext | null {
  // Feature detection for older browsers
  if (typeof AudioContext === "undefined" && typeof (window as any).webkitAudioContext === "undefined") {
    return null;
  }

  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    try {
      sharedAudioContext = new (AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.error("Failed to create AudioContext:", error);
      return null;
    }
  }

  // Resume context if suspended (Safari auto-suspends until user interaction)
  if (sharedAudioContext.state === "suspended") {
    sharedAudioContext.resume().catch((error) => {
      console.error("Failed to resume AudioContext:", error);
    });
  }

  return sharedAudioContext;
}

/**
 * Hook to analyze audio level from a MediaStream
 * Returns a value between 0-100 representing current volume
 * Uses a shared AudioContext to avoid browser limits
 */
export function useAudioLevel(stream: MediaStream | null, enabled: boolean = true): number {
  const [audioLevel, setAudioLevel] = useState(0);
  const [hasAudioTrack, setHasAudioTrack] = useState(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  // Watch for audio tracks being added/removed asynchronously
  useEffect(() => {
    if (!stream) {
      setHasAudioTrack(false);
      return;
    }

    const checkAudioTrack = () => {
      const audioTrack = stream.getAudioTracks()[0];
      setHasAudioTrack(!!audioTrack);
    };

    checkAudioTrack();

    // Listen for track changes
    const handleAddTrack = () => checkAudioTrack();
    const handleRemoveTrack = () => checkAudioTrack();

    stream.addEventListener("addtrack", handleAddTrack);
    stream.addEventListener("removetrack", handleRemoveTrack);

    return () => {
      stream.removeEventListener("addtrack", handleAddTrack);
      stream.removeEventListener("removetrack", handleRemoveTrack);
    };
  }, [stream]);

  // Setup audio analysis
  useEffect(() => {
    // Cleanup helper
    const cleanup = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
      }
      dataArrayRef.current = null;
      setAudioLevel(0);
    };

    if (!stream || !enabled || !hasAudioTrack) {
      cleanup();
      return;
    }

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack || !audioTrack.enabled) {
      cleanup();
      return;
    }

    // Get shared audio context
    const audioContext = getSharedAudioContext();
    if (!audioContext) {
      cleanup();
      return;
    }

    try {
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      sourceRef.current = source;
      analyserRef.current = analyser;
      dataArrayRef.current = dataArray;

      // Analyze audio levels continuously
      const updateLevel = () => {
        if (!analyserRef.current || !dataArrayRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArrayRef.current);

        // Calculate average volume (0-255 range)
        let sum = 0;
        for (let i = 0; i < dataArrayRef.current.length; i++) {
          sum += dataArrayRef.current[i];
        }
        const average = sum / dataArrayRef.current.length;

        // Convert to 0-100 scale and apply some boost for visibility
        const normalizedLevel = Math.min(100, (average / 255) * 100 * 1.5);
        
        setAudioLevel(normalizedLevel);
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (error) {
      console.error("Error setting up audio analysis:", error);
      cleanup();
    }

    // Cleanup
    return cleanup;
  }, [stream, enabled, hasAudioTrack]);

  return audioLevel;
}
