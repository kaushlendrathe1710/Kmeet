import { useState, useEffect, useRef } from "react";

export type NetworkQuality = "excellent" | "good" | "fair" | "poor" | "unknown";

interface NetworkStats {
  quality: NetworkQuality;
  packetLoss: number;
  latency: number;
  jitter: number;
}

export function useNetworkQuality(peerConnection: RTCPeerConnection | null): NetworkStats {
  const [stats, setStats] = useState<NetworkStats>({
    quality: "unknown",
    packetLoss: 0,
    latency: 0,
    jitter: 0,
  });

  const previousStatsRef = useRef<RTCStatsReport | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!peerConnection) {
      setStats({
        quality: "unknown",
        packetLoss: 0,
        latency: 0,
        jitter: 0,
      });
      return;
    }

    const updateStats = async () => {
      try {
        const statsReport = await peerConnection.getStats();
        const currentStats = previousStatsRef.current;
        
        let totalPacketsLost = 0;
        let totalPacketsReceived = 0;
        let avgJitter = 0;
        let jitterCount = 0;
        let avgRtt = 0;
        let rttCount = 0;

        statsReport.forEach((report) => {
          if (report.type === "inbound-rtp" && report.kind === "audio") {
            const packetsLost = report.packetsLost || 0;
            const packetsReceived = report.packetsReceived || 0;
            
            totalPacketsLost += packetsLost;
            totalPacketsReceived += packetsReceived;

            if (report.jitter) {
              avgJitter += report.jitter * 1000;
              jitterCount++;
            }
          }

          if (report.type === "candidate-pair" && report.state === "succeeded") {
            if (report.currentRoundTripTime) {
              avgRtt += report.currentRoundTripTime * 1000;
              rttCount++;
            }
          }
        });

        const totalPackets = totalPacketsLost + totalPacketsReceived;
        const packetLossPercentage = totalPackets > 0 
          ? (totalPacketsLost / totalPackets) * 100 
          : 0;

        const latency = rttCount > 0 ? avgRtt / rttCount : 0;
        const jitter = jitterCount > 0 ? avgJitter / jitterCount : 0;

        let quality: NetworkQuality = "excellent";
        if (packetLossPercentage > 5 || latency > 300) {
          quality = "poor";
        } else if (packetLossPercentage > 2 || latency > 150) {
          quality = "fair";
        } else if (packetLossPercentage > 0.5 || latency > 50) {
          quality = "good";
        }

        setStats({
          quality,
          packetLoss: packetLossPercentage,
          latency,
          jitter,
        });

        previousStatsRef.current = statsReport;
      } catch (error) {
        console.error("Error getting network stats:", error);
      }
    };

    updateStats();
    intervalRef.current = window.setInterval(updateStats, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [peerConnection]);

  return stats;
}
