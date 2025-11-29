export type BackgroundMode = 'none' | 'blur' | 'image';

export interface BackgroundSettings {
  mode: BackgroundMode;
  blurAmount: number;
  backgroundImage: string | null;
}

export class BackgroundProcessor {
  private model: any = null;
  private bodyPix: any = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private personCanvas: HTMLCanvasElement;
  private personCtx: CanvasRenderingContext2D;
  private videoElement: HTMLVideoElement;
  private animationFrameId: number | null = null;
  private settings: BackgroundSettings = {
    mode: 'none',
    blurAmount: 15,
    backgroundImage: null,
  };
  private backgroundImageElement: HTMLImageElement | null = null;
  private isProcessing = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    this.personCanvas = document.createElement('canvas');
    this.personCtx = this.personCanvas.getContext('2d', { willReadFrequently: true })!;
    this.videoElement = document.createElement('video');
    this.videoElement.autoplay = true;
    this.videoElement.playsInline = true;
  }

  async initialize() {
    try {
      const [bodyPixModule] = await Promise.all([
        import('@tensorflow-models/body-pix'),
        import('@tensorflow/tfjs')
      ]);
      
      this.bodyPix = bodyPixModule;
      this.model = await bodyPixModule.load({
        architecture: 'MobileNetV1',
        outputStride: 16,
        multiplier: 0.75,
        quantBytes: 2,
      });
      return true;
    } catch (error) {
      console.error('Failed to load BodyPix model:', error);
      return false;
    }
  }

  async startProcessing(inputStream: MediaStream): Promise<MediaStream | null> {
    if (!this.model) {
      console.warn('BodyPix model not loaded');
      return null;
    }

    const videoTrack = inputStream.getVideoTracks()[0];
    if (!videoTrack) {
      return null;
    }

    const settings = videoTrack.getSettings();
    this.canvas.width = settings.width || 640;
    this.canvas.height = settings.height || 480;

    this.videoElement.srcObject = inputStream;
    await this.videoElement.play();

    this.isProcessing = true;
    this.processFrame();

    const outputStream = this.canvas.captureStream(30);
    
    const audioTracks = inputStream.getAudioTracks();
    audioTracks.forEach(track => outputStream.addTrack(track));

    return outputStream;
  }

  private async processFrame() {
    if (!this.isProcessing || !this.model) {
      return;
    }

    try {
      if (this.settings.mode === 'none') {
        this.ctx.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);
      } else {
        const segmentation = await this.model.segmentPerson(this.videoElement, {
          flipHorizontal: false,
          internalResolution: 'medium',
          segmentationThreshold: 0.7,
        });

        if (this.settings.mode === 'blur') {
          await this.applyBlur(segmentation);
        } else if (this.settings.mode === 'image') {
          await this.applyVirtualBackground(segmentation);
        }
      }
    } catch (error) {
      console.error('Error processing frame:', error);
      this.ctx.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);
    }

    this.animationFrameId = requestAnimationFrame(() => this.processFrame());
  }

  private async applyBlur(segmentation: any) {
    const backgroundBlurAmount = this.settings.blurAmount;
    const edgeBlurAmount = 3;
    const flipHorizontal = false;

    await this.bodyPix.drawBokehEffect(
      this.canvas,
      this.videoElement,
      segmentation,
      backgroundBlurAmount,
      edgeBlurAmount,
      flipHorizontal
    );
  }

  private async applyVirtualBackground(segmentation: any) {
    const { data: mask } = segmentation;
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.backgroundImageElement && this.backgroundImageElement.complete) {
      this.ctx.drawImage(this.backgroundImageElement, 0, 0, this.canvas.width, this.canvas.height);
    } else {
      this.ctx.fillStyle = '#1a1a1a';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    
    this.personCanvas.width = this.canvas.width;
    this.personCanvas.height = this.canvas.height;
    this.personCtx.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);
    const personData = this.personCtx.getImageData(0, 0, this.canvas.width, this.canvas.height);

    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === 1) {
        const offset = i * 4;
        imageData.data[offset] = personData.data[offset];
        imageData.data[offset + 1] = personData.data[offset + 1];
        imageData.data[offset + 2] = personData.data[offset + 2];
        imageData.data[offset + 3] = personData.data[offset + 3];
      }
    }

    this.ctx.putImageData(imageData, 0, 0);
  }

  updateSettings(settings: Partial<BackgroundSettings>) {
    this.settings = { ...this.settings, ...settings };
    
    if (settings.backgroundImage !== undefined) {
      if (settings.backgroundImage) {
        this.backgroundImageElement = new Image();
        this.backgroundImageElement.crossOrigin = 'anonymous';
        this.backgroundImageElement.src = settings.backgroundImage;
      } else {
        this.backgroundImageElement = null;
      }
    }
  }

  stopProcessing() {
    this.isProcessing = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    // Clear srcObject to release camera hardware
    if (this.videoElement.srcObject) {
      this.videoElement.srcObject = null;
    }
  }

  cleanup() {
    this.stopProcessing();
    this.model = null;
    this.backgroundImageElement = null;
    // Ensure video element is fully cleared
    this.videoElement.srcObject = null;
  }
}
