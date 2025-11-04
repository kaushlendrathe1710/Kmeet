export class MediaProcessor {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private deEsserLowPass: BiquadFilterNode | null = null;
  private deEsserHighPass: BiquadFilterNode | null = null;
  private deEsserCompressor: DynamicsCompressorNode | null = null;
  private deEsserMerge: GainNode | null = null;
  private limiterNode: DynamicsCompressorNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;

  initializeAudioProcessing(stream: MediaStream): MediaStream {
    try {
      this.audioContext = new AudioContext();
      this.sourceNode = this.audioContext.createMediaStreamSource(stream);
      
      this.gainNode = this.audioContext.createGain();
      this.compressorNode = this.audioContext.createDynamicsCompressor();
      
      this.deEsserLowPass = this.audioContext.createBiquadFilter();
      this.deEsserLowPass.type = 'lowpass';
      this.deEsserLowPass.frequency.value = 5000;
      this.deEsserLowPass.Q.value = 0.7;
      
      this.deEsserHighPass = this.audioContext.createBiquadFilter();
      this.deEsserHighPass.type = 'highpass';
      this.deEsserHighPass.frequency.value = 5000;
      this.deEsserHighPass.Q.value = 0.7;
      
      this.deEsserCompressor = this.audioContext.createDynamicsCompressor();
      this.deEsserCompressor.threshold.value = -30;
      this.deEsserCompressor.knee.value = 5;
      this.deEsserCompressor.ratio.value = 6;
      this.deEsserCompressor.attack.value = 0.001;
      this.deEsserCompressor.release.value = 0.05;
      
      this.deEsserMerge = this.audioContext.createGain();
      this.deEsserMerge.gain.value = 1.0;
      
      this.limiterNode = this.audioContext.createDynamicsCompressor();
      this.destinationNode = this.audioContext.createMediaStreamDestination();

      this.compressorNode.threshold.value = -24;
      this.compressorNode.knee.value = 30;
      this.compressorNode.ratio.value = 12;
      this.compressorNode.attack.value = 0.003;
      this.compressorNode.release.value = 0.25;

      this.limiterNode.threshold.value = -1.0;
      this.limiterNode.knee.value = 0.0;
      this.limiterNode.ratio.value = 20.0;
      this.limiterNode.attack.value = 0.001;
      this.limiterNode.release.value = 0.01;

      this.compressorNode.connect(this.deEsserLowPass);
      this.compressorNode.connect(this.deEsserHighPass);
      
      this.deEsserLowPass.connect(this.deEsserMerge);
      this.deEsserHighPass.connect(this.deEsserCompressor);
      this.deEsserCompressor.connect(this.deEsserMerge);
      
      this.sourceNode
        .connect(this.gainNode)
        .connect(this.compressorNode);
      
      this.deEsserMerge
        .connect(this.limiterNode)
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
    if (this.deEsserLowPass) {
      this.deEsserLowPass.disconnect();
    }
    if (this.deEsserHighPass) {
      this.deEsserHighPass.disconnect();
    }
    if (this.deEsserCompressor) {
      this.deEsserCompressor.disconnect();
    }
    if (this.deEsserMerge) {
      this.deEsserMerge.disconnect();
    }
    if (this.limiterNode) {
      this.limiterNode.disconnect();
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
