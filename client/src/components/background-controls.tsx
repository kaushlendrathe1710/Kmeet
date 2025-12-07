import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Circle, 
  Image as ImageIcon, 
  X, 
  Play,
  Building2,
  Trees,
  Sparkles,
  Rocket,
  Home,
  Building,
  Waves,
  Lock,
  Crown,
} from "lucide-react";
import { useState, useEffect } from "react";
import type { BackgroundMode, BackgroundSettings } from "@/lib/background-processor";
import { 
  BACKGROUND_CATEGORIES, 
  getBackgroundsByCategory,
  type BackgroundItem,
} from "@/lib/background-catalog";

interface BackgroundControlsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: BackgroundSettings;
  onSettingsChange: (settings: Partial<BackgroundSettings>) => void;
  isProcessing: boolean;
  hasSubscription?: boolean;
  hasLimitedAnimated?: boolean;
}

const CATEGORY_ICONS: Record<string, typeof Building2> = {
  office: Building2,
  nature: Trees,
  abstract: Sparkles,
  space: Rocket,
  cozy: Home,
  city: Building,
  beach: Waves,
  animated: Play,
};

export function BackgroundControls({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
  isProcessing,
  hasSubscription = false,
  hasLimitedAnimated = false,
}: BackgroundControlsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('office');
  const [customImage, setCustomImage] = useState("");

  const canUseAnimated = hasSubscription || hasLimitedAnimated;

  useEffect(() => {
    if (!canUseAnimated && settings.mode === 'video') {
      onSettingsChange({ mode: 'none', backgroundVideo: null });
    }
  }, [canUseAnimated, settings.mode, onSettingsChange]);

  const handleModeChange = (mode: BackgroundMode) => {
    if (mode === 'video' && !canUseAnimated) {
      return;
    }
    
    if (mode === 'none') {
      onSettingsChange({ mode, backgroundImage: null, backgroundVideo: null });
    } else if (mode === 'blur') {
      onSettingsChange({ mode, backgroundVideo: null });
    } else if (mode === 'image') {
      onSettingsChange({ mode, backgroundVideo: null });
    } else if (mode === 'video') {
      onSettingsChange({ mode, backgroundImage: null });
    }
  };

  const handleBlurChange = (value: number[]) => {
    onSettingsChange({ blurAmount: value[0] });
  };

  const handleBackgroundSelect = (item: BackgroundItem, index?: number) => {
    if (item.type === 'video') {
      if (!canUseAnimated) return;
      if (hasLimitedAnimated && !hasSubscription && index !== 0) return;
      onSettingsChange({ 
        mode: 'video',
        backgroundVideo: item.url,
        backgroundImage: null,
      });
    } else if (item.type === 'image') {
      onSettingsChange({ 
        mode: 'image',
        backgroundImage: item.url,
        backgroundVideo: null,
      });
    }
  };

  const handleCustomImageSubmit = () => {
    if (customImage.trim()) {
      onSettingsChange({ 
        mode: 'image',
        backgroundImage: customImage,
        backgroundVideo: null,
      });
      setCustomImage("");
    }
  };

  const currentCategoryItems = getBackgroundsByCategory(selectedCategory);
  const isAnimatedCategory = selectedCategory === 'animated';
  const showImageOrVideoMode = settings.mode === 'image' || settings.mode === 'video';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Background Effects
            {hasSubscription && (
              <Badge variant="secondary" className="gap-1">
                <Crown className="w-3 h-3" />
                Premium
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Choose a background effect for your video. {!hasSubscription && "Animated backgrounds require a subscription."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          <div className="space-y-3">
            <Label>Effect Mode</Label>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={settings.mode === 'none' ? 'default' : 'outline'}
                onClick={() => handleModeChange('none')}
                className="flex-1 min-w-[100px]"
                data-testid="button-background-none"
                disabled={!isProcessing}
              >
                <X className="w-4 h-4 mr-2" />
                None
              </Button>
              <Button
                variant={settings.mode === 'blur' ? 'default' : 'outline'}
                onClick={() => handleModeChange('blur')}
                className="flex-1 min-w-[100px]"
                data-testid="button-background-blur"
                disabled={!isProcessing}
              >
                <Circle className="w-4 h-4 mr-2" />
                Blur
              </Button>
              <Button
                variant={settings.mode === 'image' ? 'default' : 'outline'}
                onClick={() => handleModeChange('image')}
                className="flex-1 min-w-[100px]"
                data-testid="button-background-image"
                disabled={!isProcessing}
              >
                <ImageIcon className="w-4 h-4 mr-2" />
                Image
              </Button>
              <Button
                variant={settings.mode === 'video' ? 'default' : 'outline'}
                onClick={() => handleModeChange('video')}
                className="flex-1 min-w-[100px]"
                data-testid="button-background-video"
                disabled={!isProcessing || !canUseAnimated}
              >
                <Play className="w-4 h-4 mr-2" />
                Animated
                {!canUseAnimated && <Lock className="w-3 h-3 ml-1" />}
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

          {showImageOrVideoMode && (
            <div className="flex-1 flex flex-col min-h-0 gap-3">
              <Label>Categories</Label>
              <ScrollArea className="w-full">
                <div className="flex gap-2 pb-2">
                  {BACKGROUND_CATEGORIES.map((category) => {
                    const Icon = CATEGORY_ICONS[category.id] || Sparkles;
                    const isPremiumCategory = category.id === 'animated';
                    return (
                      <Button
                        key={category.id}
                        variant={selectedCategory === category.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedCategory(category.id)}
                        className="flex-shrink-0 gap-1"
                        data-testid={`button-category-${category.id}`}
                        disabled={isPremiumCategory && !canUseAnimated}
                      >
                        <Icon className="w-4 h-4" />
                        {category.name}
                        {isPremiumCategory && !canUseAnimated && (
                          <Lock className="w-3 h-3 ml-1" />
                        )}
                        {isPremiumCategory && canUseAnimated && (
                          <Crown className="w-3 h-3 ml-1 text-yellow-500" />
                        )}
                      </Button>
                    );
                  })}
                </div>
              </ScrollArea>

              <ScrollArea className="flex-1 min-h-[200px]">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 pr-4">
                  {currentCategoryItems.map((item, index) => {
                    const isAnimatedItem = item.type === 'video';
                    const isLocked = isAnimatedItem && !canUseAnimated ? true :
                                     isAnimatedItem && hasLimitedAnimated && !hasSubscription && index !== 0 ? true :
                                     false;
                    const isSelected = 
                      (item.type === 'image' && settings.backgroundImage === item.url) ||
                      (item.type === 'video' && settings.backgroundVideo === item.url);
                    
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleBackgroundSelect(item, index)}
                        disabled={isLocked}
                        className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                          isSelected
                            ? 'border-primary ring-2 ring-primary/20'
                            : 'border-border'
                        } ${isLocked ? 'opacity-50 cursor-not-allowed' : 'hover-elevate cursor-pointer'}`}
                        data-testid={`button-bg-${item.id}`}
                      >
                        <img
                          src={item.thumbnail}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                        {item.type === 'video' && (
                          <div className="absolute top-1 right-1">
                            <Badge variant="secondary" className="text-xs px-1 py-0">
                              <Play className="w-3 h-3" />
                            </Badge>
                          </div>
                        )}
                        {isLocked && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <Lock className="w-6 h-6 text-white" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1">
                          <span className="text-xs text-white truncate block">{item.name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>

              {!isAnimatedCategory && settings.mode === 'image' && (
                <div className="space-y-2 pt-2 border-t">
                  <Label>Custom Image URL</Label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customImage}
                      onChange={(e) => setCustomImage(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="flex-1 px-3 py-2 border rounded-md bg-background text-sm"
                      data-testid="input-custom-background"
                    />
                    <Button
                      onClick={handleCustomImageSubmit}
                      disabled={!customImage.trim()}
                      size="sm"
                      data-testid="button-apply-custom-background"
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!isProcessing && (
            <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
              Background effects are initializing. This may take a moment...
            </div>
          )}

          {isAnimatedCategory && !hasSubscription && hasLimitedAnimated && (
            <div className="text-sm p-3 bg-primary/10 border border-primary/20 rounded-md flex items-center gap-2">
              <Crown className="w-4 h-4 text-primary" />
              <span>Basic plan includes 1 animated background. Upgrade to Pro or Enterprise to unlock all moving backgrounds.</span>
            </div>
          )}
          
          {isAnimatedCategory && !canUseAnimated && (
            <div className="text-sm p-3 bg-primary/10 border border-primary/20 rounded-md flex items-center gap-2">
              <Crown className="w-4 h-4 text-primary" />
              <span>Animated backgrounds are a premium feature. Subscribe to unlock moving backgrounds.</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
