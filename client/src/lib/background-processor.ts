export type BackgroundMode = 'none' | 'blur' | 'image' | 'video';

export interface BackgroundSettings {
  mode: BackgroundMode;
  blurAmount: number;
  backgroundImage: string | null;
  backgroundVideo: string | null;
}

export class BackgroundProcessor {
  private model: any = null;
  private bodyPix: any = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private personCanvas: HTMLCanvasElement;
  private personCtx: CanvasRenderingContext2D;
  private videoElement: HTMLVideoElement;
  private backgroundVideoElement: HTMLVideoElement | null = null;
  private backgroundVideoReady = false;
  private animationFrameId: number | null = null;
  private settings: BackgroundSettings = {
    mode: 'none',
    blurAmount: 15,
    backgroundImage: null,
    backgroundVideo: null,
  };
  private backgroundImageElement: HTMLImageElement | null = null;
  private isProcessing = false;
  private maskThreshold = 0.5;

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
        } else if (this.settings.mode === 'video') {
          await this.applyVideoBackground(segmentation);
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
    this.personCanvas.width = this.canvas.width;
    this.personCanvas.height = this.canvas.height;
    
    if (this.backgroundImageElement && this.backgroundImageElement.complete) {
      this.ctx.drawImage(this.backgroundImageElement, 0, 0, this.canvas.width, this.canvas.height);
    } else {
      this.ctx.fillStyle = '#1a1a1a';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    const foregroundColor = { r: 0, g: 0, b: 0, a: 0 };
    const backgroundColor = { r: 0, g: 0, b: 0, a: 255 };
    const maskImage = this.bodyPix.toMask(segmentation, foregroundColor, backgroundColor, true);
    
    this.personCtx.putImageData(maskImage, 0, 0);
    
    this.ctx.save();
    this.ctx.filter = 'blur(4px)';
    this.ctx.globalCompositeOperation = 'destination-out';
    this.ctx.drawImage(this.personCanvas, 0, 0);
    this.ctx.restore();
    
    this.ctx.globalCompositeOperation = 'destination-over';
    this.ctx.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.globalCompositeOperation = 'source-over';
  }

  private async applyVideoBackground(segmentation: any) {
    this.personCanvas.width = this.canvas.width;
    this.personCanvas.height = this.canvas.height;
    
    if (this.backgroundVideoElement && this.backgroundVideoReady && !this.backgroundVideoElement.paused) {
      this.ctx.drawImage(this.backgroundVideoElement, 0, 0, this.canvas.width, this.canvas.height);
    } else {
      this.ctx.fillStyle = '#1a1a1a';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    const foregroundColor = { r: 0, g: 0, b: 0, a: 0 };
    const backgroundColor = { r: 0, g: 0, b: 0, a: 255 };
    const maskImage = this.bodyPix.toMask(segmentation, foregroundColor, backgroundColor, true);
    
    this.personCtx.putImageData(maskImage, 0, 0);
    
    this.ctx.save();
    this.ctx.filter = 'blur(4px)';
    this.ctx.globalCompositeOperation = 'destination-out';
    this.ctx.drawImage(this.personCanvas, 0, 0);
    this.ctx.restore();
    
    this.ctx.globalCompositeOperation = 'destination-over';
    this.ctx.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.globalCompositeOperation = 'source-over';
  }

  private cleanupBackgroundVideo() {
    if (this.backgroundVideoElement) {
      this.backgroundVideoElement.pause();
      this.backgroundVideoElement.removeAttribute('src');
      this.backgroundVideoElement.load();
      this.backgroundVideoElement = null;
      this.backgroundVideoReady = false;
    }
  }

  updateSettings(settings: Partial<BackgroundSettings>) {
    const prevMode = this.settings.mode;
    this.settings = { ...this.settings, ...settings };
    
    if (settings.mode !== undefined && settings.mode !== 'video' && prevMode === 'video') {
      this.cleanupBackgroundVideo();
    }
    
    if (settings.backgroundImage !== undefined) {
      if (settings.backgroundImage) {
        this.backgroundImageElement = new Image();
        this.backgroundImageElement.crossOrigin = 'anonymous';
        this.backgroundImageElement.src = settings.backgroundImage;
      } else {
        this.backgroundImageElement = null;
      }
    }

    if (settings.backgroundVideo !== undefined) {
      this.cleanupBackgroundVideo();
      
      if (settings.backgroundVideo) {
        this.backgroundVideoElement = document.createElement('video');
        this.backgroundVideoElement.crossOrigin = 'anonymous';
        this.backgroundVideoElement.loop = true;
        this.backgroundVideoElement.muted = true;
        this.backgroundVideoElement.playsInline = true;
        this.backgroundVideoElement.preload = 'auto';
        
        this.backgroundVideoElement.addEventListener('loadeddata', () => {
          this.backgroundVideoReady = true;
        });
        
        this.backgroundVideoElement.addEventListener('error', (e) => {
          console.error('Failed to load background video:', e);
          this.backgroundVideoReady = false;
        });
        
        this.backgroundVideoElement.src = settings.backgroundVideo;
        
        this.backgroundVideoElement.play().catch(err => {
          console.error('Failed to play background video:', err);
          this.backgroundVideoReady = false;
        });
      }
    }
  }

  stopProcessing() {
    this.isProcessing = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.videoElement.srcObject) {
      this.videoElement.srcObject = null;
    }
  }

  cleanup() {
    this.stopProcessing();
    this.model = null;
    this.backgroundImageElement = null;
    this.cleanupBackgroundVideo();
    this.videoElement.srcObject = null;
  }
}
