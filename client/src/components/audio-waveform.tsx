import { useEffect, useRef } from "react";

interface AudioWaveformProps {
  stream: MediaStream | null;
  width?: number;
  height?: number;
  className?: string;
}

export function AudioWaveform({ stream, width = 300, height = 60, className = "" }: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      analyserRef.current = null;
      return;
    }

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const draw = () => {
        if (!analyserRef.current || !ctx) return;

        animationRef.current = requestAnimationFrame(draw);

        analyserRef.current.getByteTimeDomainData(dataArray);

        ctx.fillStyle = "hsl(var(--background))";
        ctx.fillRect(0, 0, width, height);

        ctx.lineWidth = 2;
        ctx.strokeStyle = "hsl(var(--primary))";
        ctx.beginPath();

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
      };

      draw();

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
      };
    } catch (error) {
      console.error("Error initializing waveform visualization:", error);
    }
  }, [stream, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`rounded-md border ${className}`}
      data-testid="audio-waveform-canvas"
    />
  );
}
