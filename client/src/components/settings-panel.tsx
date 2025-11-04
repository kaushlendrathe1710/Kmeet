import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X } from "lucide-react";

interface SettingsPanelProps {
  onClose: () => void;
  onAudioSettingsChange?: (settings: AudioSettings) => void;
  onVideoSettingsChange?: (settings: VideoSettings) => void;
}

export interface AudioSettings {
  noiseSuppressionEnabled: boolean;
  noiseSuppression: number;
  gainControl: number;
  normalization: boolean;
}

export interface VideoSettings {
  brightness: number;
  contrast: number;
  saturation: number;
}

export function SettingsPanel({ onClose, onAudioSettingsChange, onVideoSettingsChange }: SettingsPanelProps) {
  const [noiseSuppressionEnabled, setNoiseSuppressionEnabled] = useState(true);
  const [noiseSuppression, setNoiseSuppression] = useState(50);
  const [gainControl, setGainControl] = useState(100);
  const [normalization, setNormalization] = useState(true);
  
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);

  useEffect(() => {
    if (onAudioSettingsChange) {
      onAudioSettingsChange({
        noiseSuppressionEnabled,
        noiseSuppression,
        gainControl,
        normalization,
      });
    }
  }, [noiseSuppressionEnabled, noiseSuppression, gainControl, normalization, onAudioSettingsChange]);

  useEffect(() => {
    if (onVideoSettingsChange) {
      onVideoSettingsChange({
        brightness,
        contrast,
        saturation,
      });
    }
  }, [brightness, contrast, saturation, onVideoSettingsChange]);

  return (
    <div className="w-96 border-l bg-card flex flex-col" data-testid="settings-panel">
      <div className="h-16 border-b flex items-center justify-between px-4">
        <h2 className="font-semibold">Settings</h2>
        <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-settings">
          <X className="w-5 h-5" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <Tabs defaultValue="audio" className="p-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="audio" data-testid="tab-audio">Audio</TabsTrigger>
            <TabsTrigger value="video" data-testid="tab-video">Video</TabsTrigger>
          </TabsList>

          <TabsContent value="audio" className="space-y-6 mt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="noise-suppression-toggle" className="text-base font-semibold">
                  Noise Suppression
                </Label>
                <Switch
                  id="noise-suppression-toggle"
                  checked={noiseSuppressionEnabled}
                  onCheckedChange={setNoiseSuppressionEnabled}
                  data-testid="switch-noise-suppression"
                />
              </div>

              {noiseSuppressionEnabled && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <Label>Intensity</Label>
                    <span className="text-muted-foreground font-mono" data-testid="value-noise-intensity">
                      {noiseSuppression}%
                    </span>
                  </div>
                  <Slider
                    value={[noiseSuppression]}
                    onValueChange={([value]) => setNoiseSuppression(value)}
                    min={0}
                    max={100}
                    step={1}
                    data-testid="slider-noise-suppression"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Off</span>
                    <span>Low</span>
                    <span>Medium</span>
                    <span>High</span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <Label>Gain Control</Label>
                <span className="text-muted-foreground font-mono" data-testid="value-gain-control">
                  {gainControl}%
                </span>
              </div>
              <Slider
                value={[gainControl]}
                onValueChange={([value]) => setGainControl(value)}
                min={0}
                max={200}
                step={1}
                data-testid="slider-gain-control"
              />
              <p className="text-xs text-muted-foreground">
                Adjust microphone input volume
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="normalization" className="text-sm font-medium">
                  Audio Normalization
                </Label>
                <p className="text-xs text-muted-foreground">
                  Automatically balance audio levels
                </p>
              </div>
              <Switch
                id="normalization"
                checked={normalization}
                onCheckedChange={setNormalization}
                data-testid="switch-normalization"
              />
            </div>
          </TabsContent>

          <TabsContent value="video" className="space-y-6 mt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <Label>Brightness</Label>
                <span className="text-muted-foreground font-mono" data-testid="value-brightness">
                  {brightness}%
                </span>
              </div>
              <Slider
                value={[brightness]}
                onValueChange={([value]) => setBrightness(value)}
                min={0}
                max={200}
                step={1}
                data-testid="slider-brightness"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <Label>Contrast</Label>
                <span className="text-muted-foreground font-mono" data-testid="value-contrast">
                  {contrast}%
                </span>
              </div>
              <Slider
                value={[contrast]}
                onValueChange={([value]) => setContrast(value)}
                min={0}
                max={200}
                step={1}
                data-testid="slider-contrast"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <Label>Saturation</Label>
                <span className="text-muted-foreground font-mono" data-testid="value-saturation">
                  {saturation}%
                </span>
              </div>
              <Slider
                value={[saturation]}
                onValueChange={([value]) => setSaturation(value)}
                min={0}
                max={200}
                step={1}
                data-testid="slider-saturation"
              />
            </div>

            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Adjust video appearance in real-time. Changes apply to your camera feed.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </ScrollArea>
    </div>
  );
}
