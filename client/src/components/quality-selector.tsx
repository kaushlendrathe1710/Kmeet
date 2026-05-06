import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Settings2, Check } from "lucide-react";
import type { VideoQualityLevel } from "@/hooks/use-bandwidth-adaptation";

interface QualitySelectorProps {
  currentQuality: VideoQualityLevel;
  recommendedQuality: VideoQualityLevel;
  onQualityChange: (quality: VideoQualityLevel) => void;
  availableBandwidth: number;
}

export function QualitySelector({
  currentQuality,
  recommendedQuality,
  onQualityChange,
  availableBandwidth,
}: QualitySelectorProps) {
  const qualities: Array<{ value: VideoQualityLevel; label: string; resolution: string }> = [
    { value: "auto", label: "Auto", resolution: "Adaptive" },
    { value: "high", label: "High", resolution: "1080p • 30fps" },
    { value: "medium", label: "Medium", resolution: "720p • 24fps" },
    { value: "low", label: "Low", resolution: "480p • 15fps" },
  ];

  const getCurrentLabel = () => {
    if (currentQuality === "auto") {
      const recommended = qualities.find(q => q.value === recommendedQuality);
      return `Auto (${recommended?.label})`;
    }
    return qualities.find(q => q.value === currentQuality)?.label || "Medium";
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          data-testid="button-quality-selector"
          title="Video Quality"
        >
          <Settings2 className="w-4 h-4"/>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Video Quality</span>
          <span className="text-xs text-muted-foreground font-normal">
            {availableBandwidth > 0 ? `${availableBandwidth} kbps` : ""}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {qualities.map((quality) => (
          <DropdownMenuItem
            key={quality.value}
            onClick={() => onQualityChange(quality.value)}
            className="flex items-center justify-between"
            data-testid={`quality-option-${quality.value}`}
          >
            <div className="flex flex-col">
              <span>{quality.label}</span>
              <span className="text-xs text-muted-foreground">{quality.resolution}</span>
            </div>
            {currentQuality === quality.value && (
              <Check className="w-4 h-4" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
