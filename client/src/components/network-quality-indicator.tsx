import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff } from "lucide-react";
import type { NetworkQuality } from "@/hooks/use-network-quality";

interface NetworkQualityIndicatorProps {
  quality: NetworkQuality;
  packetLoss: number;
  latency: number;
  showDetails?: boolean;
}

export function NetworkQualityIndicator({ 
  quality, 
  packetLoss, 
  latency,
  showDetails = false 
}: NetworkQualityIndicatorProps) {
  const qualityConfig = {
    excellent: {
      label: "Excellent",
      color: "bg-green-500/10 border-green-500 text-green-600 dark:text-green-500",
      icon: Wifi,
    },
    good: {
      label: "Good",
      color: "bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-500",
      icon: Wifi,
    },
    fair: {
      label: "Fair",
      color: "bg-yellow-500/10 border-yellow-500 text-yellow-600 dark:text-yellow-500",
      icon: Wifi,
    },
    poor: {
      label: "Poor",
      color: "bg-red-500/10 border-red-500 text-red-600 dark:text-red-500",
      icon: WifiOff,
    },
    unknown: {
      label: "Unknown",
      color: "bg-muted border-border text-muted-foreground",
      icon: Wifi,
    },
  };

  const config = qualityConfig[quality];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <div 
        className={`flex items-center gap-2 px-3 py-1 rounded-full border ${config.color}`}
        data-testid={`network-quality-${quality}`}
      >
        <Icon className="h-3 w-3" />
        <span className="text-xs font-medium">{config.label}</span>
      </div>
      {showDetails && quality !== "unknown" && (
        <span className="text-xs text-muted-foreground font-mono" data-testid="network-stats-details">
          {packetLoss > 0 && `${packetLoss.toFixed(1)}% loss | `}
          {latency.toFixed(0)}ms
        </span>
      )}
    </div>
  );
}
