import { Wifi, WifiOff } from "lucide-react";
import type { ConnectionQuality } from "@/hooks/use-connection-quality";

interface NetworkIndicatorProps {
  quality: ConnectionQuality;
  showLabel?: boolean;
}

export function NetworkIndicator({ quality, showLabel = false }: NetworkIndicatorProps) {
  const getIndicatorColor = () => {
    switch (quality) {
      case "excellent":
        return "text-green-500";
      case "good":
        return "text-yellow-500";
      case "poor":
        return "text-red-500";
      default:
        return "text-muted-foreground";
    }
  };

  const getSignalBars = () => {
    switch (quality) {
      case "excellent":
        return 3;
      case "good":
        return 2;
      case "poor":
        return 1;
      default:
        return 0;
    }
  };

  const bars = getSignalBars();

  return (
    <div className="flex items-center gap-1" data-testid={`network-indicator-${quality}`}>
      {quality === "unknown" ? (
        <WifiOff className={`w-4 h-4 ${getIndicatorColor()}`} />
      ) : (
        <div className="flex items-end gap-0.5 h-4">
          {[1, 2, 3].map((bar) => (
            <div
              key={bar}
              className={`w-1 rounded-sm transition-all ${
                bar <= bars ? getIndicatorColor().replace("text-", "bg-") : "bg-muted"
              }`}
              style={{ height: `${bar * 33}%` }}
              data-testid={`signal-bar-${bar}`}
            />
          ))}
        </div>
      )}
      {showLabel && (
        <span className={`text-xs ${getIndicatorColor()}`}>
          {quality === "unknown" ? "Unknown" : quality.charAt(0).toUpperCase() + quality.slice(1)}
        </span>
      )}
    </div>
  );
}
