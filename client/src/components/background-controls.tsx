import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Circle, Image as ImageIcon, X } from "lucide-react";
import { useState } from "react";
import type { BackgroundMode, BackgroundSettings } from "@/lib/background-processor";

interface BackgroundControlsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: BackgroundSettings;
  onSettingsChange: (settings: Partial<BackgroundSettings>) => void;
  isProcessing: boolean;
}

const DEFAULT_BACKGROUNDS = [
  "https://images.unsplash.com/photo-1557683316-973673baf926?w=1920&h=1080&fit=crop",
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1920&h=1080&fit=crop",
  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&h=1080&fit=crop",
  "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1920&h=1080&fit=crop",
  "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1920&h=1080&fit=crop",
  "https://images.unsplash.com/photo-1506003094589-53954a26283c?w=1920&h=1080&fit=crop",
];

export function BackgroundControls({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
  isProcessing,
}: BackgroundControlsProps) {
  const [customImage, setCustomImage] = useState("");

  const handleModeChange = (mode: BackgroundMode) => {
    onSettingsChange({ mode });
  };

  const handleBlurChange = (value: number[]) => {
    onSettingsChange({ blurAmount: value[0] });
  };

  const handleBackgroundSelect = (imageUrl: string) => {
    onSettingsChange({ 
      mode: 'image',
      backgroundImage: imageUrl 
    });
  };

  const handleCustomImageSubmit = () => {
    if (customImage.trim()) {
      handleBackgroundSelect(customImage);
      setCustomImage("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Background Effects</DialogTitle>
          <DialogDescription>
            Choose a background effect for your video
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <Label>Effect Mode</Label>
            <div className="flex gap-2">
              <Button
                variant={settings.mode === 'none' ? 'default' : 'outline'}
                onClick={() => handleModeChange('none')}
                className="flex-1"
                data-testid="button-background-none"
                disabled={!isProcessing}
              >
                <X className="w-4 h-4 mr-2" />
                None
              </Button>
              <Button
                variant={settings.mode === 'blur' ? 'default' : 'outline'}
                onClick={() => handleModeChange('blur')}
                className="flex-1"
                data-testid="button-background-blur"
                disabled={!isProcessing}
              >
                <Circle className="w-4 h-4 mr-2" />
                Blur
              </Button>
              <Button
                variant={settings.mode === 'image' ? 'default' : 'outline'}
                onClick={() => handleModeChange('image')}
                className="flex-1"
                data-testid="button-background-image"
                disabled={!isProcessing}
              >
                <ImageIcon className="w-4 h-4 mr-2" />
                Virtual Background
              </Button>
            </div>
          </div>

          {settings.mode === 'blur' && (
            <div className="space-y-3">
              <Label>Blur Amount: {settings.blurAmount}px</Label>
              <Slider
                value={[settings.blurAmount]}
                onValueChange={handleBlurChange}
                min={5}
                max={30}
                step={1}
                data-testid="slider-blur-amount"
              />
            </div>
          )}

          {settings.mode === 'image' && (
            <div className="space-y-3">
              <Label>Choose Background</Label>
              <div className="grid grid-cols-3 gap-3">
                {DEFAULT_BACKGROUNDS.map((bg, index) => (
                  <button
                    key={index}
                    onClick={() => handleBackgroundSelect(bg)}
                    className={`aspect-video rounded-lg overflow-hidden border-2 transition-all hover-elevate ${
                      settings.backgroundImage === bg
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-border'
                    }`}
                    data-testid={`button-background-${index}`}
                  >
                    <img
                      src={bg}
                      alt={`Background ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Custom Image URL</Label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customImage}
                    onChange={(e) => setCustomImage(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="flex-1 px-3 py-2 border rounded-md bg-background"
                    data-testid="input-custom-background"
                  />
                  <Button
                    onClick={handleCustomImageSubmit}
                    disabled={!customImage.trim()}
                    data-testid="button-apply-custom-background"
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!isProcessing && (
            <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
              Background effects are initializing. This may take a moment...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
