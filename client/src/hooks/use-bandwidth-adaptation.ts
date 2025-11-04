import { useState, useEffect, useRef } from "react";

export type VideoQualityLevel = "high" | "medium" | "low" | "auto";

interface BandwidthStats {
  availableBandwidth: number;
  recommendedQuality: VideoQualityLevel;
}

const QUALITY_THRESHOLDS = {
  high: 2500,
  medium: 1000,
  low: 500,
};

export const VIDEO_QUALITY_CONSTRAINTS = {
  high: {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30 },
  },
  medium: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 24 },
  },
  low: {
    width: { ideal: 640 },
    height: { ideal: 480 },
    frameRate: { ideal: 15 },
  },
};

export function useBandwidthAdaptation(
  peerConnection: RTCPeerConnection | null,
  enabled: boolean = true
): BandwidthStats {
  const [stats, setStats] = useState<BandwidthStats>({
    availableBandwidth: 0,
    recommendedQuality: "medium",
  });

  const intervalRef = useRef<number | null>(null);
  const previousStatsRef = useRef<RTCStatsReport | null>(null);

  useEffect(() => {
    if (!peerConnection || !enabled) {
      setStats({
        availableBandwidth: 0,
        recommendedQuality: "medium",
      });
      return;
    }

    const updateBandwidthStats = async () => {
      try {
        const statsReport = await peerConnection.getStats();
        const previousStats = previousStatsRef.current;

        let totalBytesSent = 0;
        let totalBytesReceived = 0;
        let prevBytesSent = 0;
        let prevBytesReceived = 0;
        let timeDiff = 0;

        statsReport.forEach((report) => {
          if (report.type === "outbound-rtp" && report.kind === "video") {
            totalBytesSent += report.bytesSent || 0;
            
            if (previousStats && report.id) {
              previousStats.forEach((prevReport) => {
                if (prevReport.id === report.id && prevReport.type === "outbound-rtp") {
                  prevBytesSent += prevReport.bytesSent || 0;
                  if (report.timestamp && prevReport.timestamp) {
                    timeDiff = (report.timestamp - prevReport.timestamp) / 1000;
                  }
                }
              });
            }
          }

          if (report.type === "inbound-rtp" && report.kind === "video") {
            totalBytesReceived += report.bytesReceived || 0;
            
            if (previousStats && report.id) {
              previousStats.forEach((prevReport) => {
                if (prevReport.id === report.id && prevReport.type === "inbound-rtp") {
                  prevBytesReceived += prevReport.bytesReceived || 0;
                }
              });
            }
          }
        });

        if (timeDiff > 0) {
          const bytesDiff = (totalBytesSent - prevBytesSent) + (totalBytesReceived - prevBytesReceived);
          const bandwidth = (bytesDiff * 8) / timeDiff / 1000;

          let recommendedQuality: VideoQualityLevel = "low";
          if (bandwidth >= QUALITY_THRESHOLDS.high) {
            recommendedQuality = "high";
          } else if (bandwidth >= QUALITY_THRESHOLDS.medium) {
            recommendedQuality = "medium";
          }

          setStats({
            availableBandwidth: Math.round(bandwidth),
            recommendedQuality,
          });
        }

        previousStatsRef.current = statsReport;
      } catch (error) {
        console.error("Error getting bandwidth stats:", error);
      }
    };

    updateBandwidthStats();
    intervalRef.current = window.setInterval(updateBandwidthStats, 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [peerConnection, enabled]);

  return stats;
}
