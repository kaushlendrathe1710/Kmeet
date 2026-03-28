import { useCallback, useEffect, useRef, useState } from "react";

interface UseDevicePreviewOptions {
  active: boolean;
}

export function useDevicePreview({ active }: UseDevicePreviewOptions) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudio, setSelectedAudio] = useState("");
  const [selectedVideo, setSelectedVideo] = useState("");
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasInitializedRef = useRef(false);

  const stopPreview = useCallback(() => {
    setStream((current) => {
      current?.getTracks().forEach((track) => track.stop());
      return null;
    });
  }, []);

  const refreshDevices = useCallback(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audio = devices.filter((d) => d.kind === "audioinput");
    const video = devices.filter((d) => d.kind === "videoinput");

    setAudioDevices(audio);
    setVideoDevices(video);

    setSelectedAudio((prev) => prev || audio[0]?.deviceId || "");
    setSelectedVideo((prev) => prev || video[0]?.deviceId || "");
  }, []);

  const startPreview = useCallback(async () => {
    try {
      stopPreview();

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: selectedVideo ? { deviceId: { exact: selectedVideo } } : true,
        audio: selectedAudio ? { deviceId: { exact: selectedAudio } } : true,
      });

      setStream(mediaStream);
      setError(null);
    } catch (e) {
      setError("Please allow camera and microphone access to continue.");
    }
  }, [selectedAudio, selectedVideo, stopPreview]);

  const toggleVideo = useCallback(async () => {
    if (!stream) return;

    if (isVideoEnabled) {
      stream.getVideoTracks().forEach((track) => track.stop());
      setIsVideoEnabled(false);
      return;
    }

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: selectedVideo ? { deviceId: { exact: selectedVideo } } : true,
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      const combined = new MediaStream([...stream.getAudioTracks(), newVideoTrack]);
      setStream(combined);
      setIsVideoEnabled(true);
    } catch {
      setError("Cannot access camera.");
    }
  }, [isVideoEnabled, selectedVideo, stream]);

  const toggleAudio = useCallback(async () => {
    if (!stream) return;

    if (isAudioEnabled) {
      stream.getAudioTracks().forEach((track) => track.stop());
      setIsAudioEnabled(false);
      return;
    }

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: selectedAudio ? { deviceId: { exact: selectedAudio } } : true,
      });
      const newAudioTrack = newStream.getAudioTracks()[0];
      const combined = new MediaStream([...stream.getVideoTracks(), newAudioTrack]);
      setStream(combined);
      setIsAudioEnabled(true);
    } catch {
      setError("Cannot access microphone.");
    }
  }, [isAudioEnabled, selectedAudio, stream]);

  useEffect(() => {
    if (!active) {
      hasInitializedRef.current = false;
      stopPreview();
      return;
    }

    const initialize = async () => {
      await refreshDevices();
      hasInitializedRef.current = true;
      await startPreview();
    };

    void initialize();

    return () => {
      stopPreview();
    };
  }, [active, refreshDevices, startPreview, stopPreview]);

  useEffect(() => {
    if (!active || !hasInitializedRef.current) return;
    void startPreview();
  }, [active, selectedAudio, selectedVideo, startPreview]);

  return {
    stream,
    audioDevices,
    videoDevices,
    selectedAudio,
    setSelectedAudio,
    selectedVideo,
    setSelectedVideo,
    isAudioEnabled,
    isVideoEnabled,
    toggleAudio,
    toggleVideo,
    error,
    clearError: () => setError(null),
  };
}
