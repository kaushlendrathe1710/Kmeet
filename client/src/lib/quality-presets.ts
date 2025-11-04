import type { AudioSettings, VideoSettings } from "@/components/settings-panel";

export type QualityPreset = "podcast" | "interview" | "quick-call" | "custom";

export interface PresetConfig {
  name: string;
  description: string;
  videoQuality: "high" | "medium" | "low";
  audioSettings: Partial<AudioSettings>;
  videoSettings: Partial<VideoSettings>;
  videoConstraints: MediaTrackConstraints;
  audioConstraints: MediaTrackConstraints;
}

export const QUALITY_PRESETS: Record<QualityPreset, PresetConfig | null> = {
  podcast: {
    name: "Podcast",
    description: "Optimized for voice - high audio quality, lower video",
    videoQuality: "low",
    audioSettings: {
      noiseSuppressionEnabled: true,
      noiseSuppression: 0.8,
      gainControl: 1.2,
      normalization: true,
    },
    videoSettings: {
      brightness: 105,
      contrast: 100,
      saturation: 95,
    },
    videoConstraints: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 15 },
    },
    audioConstraints: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 48000,
      channelCount: 1,
    },
  },
  interview: {
    name: "Interview",
    description: "Balanced quality for professional interviews",
    videoQuality: "medium",
    audioSettings: {
      noiseSuppressionEnabled: true,
      noiseSuppression: 0.6,
      gainControl: 1.0,
      normalization: true,
    },
    videoSettings: {
      brightness: 100,
      contrast: 100,
      saturation: 100,
    },
    videoConstraints: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 24 },
    },
    audioConstraints: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 48000,
      channelCount: 1,
    },
  },
  "quick-call": {
    name: "Quick Call",
    description: "Lower quality for faster performance and lower bandwidth",
    videoQuality: "low",
    audioSettings: {
      noiseSuppressionEnabled: true,
      noiseSuppression: 0.5,
      gainControl: 1.0,
      normalization: false,
    },
    videoSettings: {
      brightness: 100,
      contrast: 100,
      saturation: 100,
    },
    videoConstraints: {
      width: { ideal: 640 },
      height: { ideal: 360 },
      frameRate: { ideal: 15 },
    },
    audioConstraints: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 16000,
      channelCount: 1,
    },
  },
  custom: null,
};
