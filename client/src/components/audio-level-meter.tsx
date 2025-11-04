import { cn } from "@/lib/utils";

interface AudioLevelMeterProps {
  level: number; // 0-100
  className?: string;
}

export function AudioLevelMeter({ level, className }: AudioLevelMeterProps) {
  // Determine color based on level
  const getColorClass = () => {
    if (level < 30) return "bg-green-500";
    if (level < 70) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div 
      className={cn(
        "relative h-1.5 w-full bg-background/50 rounded-full overflow-hidden",
        className
      )}
      data-testid="audio-level-meter"
    >
      <div
        className={cn(
          "absolute left-0 top-0 h-full transition-all duration-100 rounded-full",
          getColorClass()
        )}
        style={{ width: `${Math.max(2, level)}%` }}
        data-testid="audio-level-bar"
      />
    </div>
  );
}
