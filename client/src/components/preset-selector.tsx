import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Sparkles, Check } from "lucide-react";
import type { QualityPreset } from "@/lib/quality-presets";
import { QUALITY_PRESETS } from "@/lib/quality-presets";

interface PresetSelectorProps {
  currentPreset: QualityPreset;
  onPresetChange: (preset: QualityPreset) => void;
}

export function PresetSelector({ currentPreset, onPresetChange }: PresetSelectorProps) {
  const presets: QualityPreset[] = ["podcast", "interview", "quick-call", "custom"];

  const getCurrentLabel = () => {
    const preset = QUALITY_PRESETS[currentPreset];
    return preset?.name || "Custom";
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          data-testid="button-preset-selector"
          title={`Preset: ${getCurrentLabel()}`}
          className="rounded-full w-12 h-12"
        >
          <Sparkles className="w-5 h-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Quality Presets</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {presets.map((presetKey) => {
          const preset = QUALITY_PRESETS[presetKey];
          if (!preset && presetKey !== "custom") return null;

          return (
            <DropdownMenuItem
              key={presetKey}
              onClick={() => onPresetChange(presetKey)}
              className="flex items-start justify-between gap-2"
              data-testid={`preset-option-${presetKey}`}
            >
              <div className="flex flex-col flex-1">
                <span className="font-medium">{preset?.name || "Custom"}</span>
                {preset && (
                  <span className="text-xs text-muted-foreground">{preset.description}</span>
                )}
              </div>
              {currentPreset === presetKey && <Check className="w-4 h-4 flex-shrink-0 mt-1" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
