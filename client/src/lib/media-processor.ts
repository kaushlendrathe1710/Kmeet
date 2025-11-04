export class MediaProcessor {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;

  initializeAudioProcessing(stream: MediaStream): MediaStream {
    try {
      this.audioContext = new AudioContext();
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      
      this.gainNode = this.audioContext.createGain();
      this.compressorNode = this.audioContext.createDynamicsCompressor();
      this.destinationNode = this.audioContext.createMediaStreamDestination();

      this.compressorNode.threshold.value = -24;
      this.compressorNode.knee.value = 30;
      this.compressorNode.ratio.value = 12;
      this.compressorNode.attack.value = 0.003;
      this.compressorNode.release.value = 0.25;

      this.sourceNode
        .connect(this.gainNode)
        .connect(this.compressorNode)
        .connect(this.destinationNode);

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        this.destinationNode.stream.addTrack(videoTrack);
      }

      return this.destinationNode.stream;
    } catch (error) {
      console.error("Error initializing audio processing:", error);
      return stream;
    }
  }

  setGain(value: number) {
    if (this.gainNode) {
      this.gainNode.gain.value = value;
    }
  }

  setNoiseSuppressionIntensity(intensity: number) {
    if (this.compressorNode) {
      const normalizedIntensity = intensity / 100;
      this.compressorNode.threshold.value = -50 + (normalizedIntensity * 26);
      this.compressorNode.ratio.value = 1 + (normalizedIntensity * 19);
    }
  }

  cleanup() {
    if (this.sourceNode) {
      this.sourceNode.disconnect();
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
    }
    if (this.compressorNode) {
      this.compressorNode.disconnect();
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

export function applyVideoFilters(
  videoElement: HTMLVideoElement,
  brightness: number,
  contrast: number,
  saturation: number
): void {
  const filters = [
    `brightness(${brightness}%)`,
    `contrast(${contrast}%)`,
    `saturate(${saturation}%)`,
  ];
  
  videoElement.style.filter = filters.join(" ");
}
