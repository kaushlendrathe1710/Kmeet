import { useState, useEffect, useRef } from "react";

export type ConnectionQuality = "excellent" | "good" | "poor" | "unknown";

export interface ConnectionStats {
  quality: ConnectionQuality;
  packetLoss: number;
  jitter: number;
  rtt: number;
}

/**
 * Hook to monitor WebRTC connection quality for a peer connection
 * Returns the current connection quality based on network statistics
 */
export function useConnectionQuality(
  peerConnection: RTCPeerConnection | null,
  updateIntervalMs: number = 2000
): ConnectionStats {
  const [stats, setStats] = useState<ConnectionStats>({
    quality: "unknown",
    packetLoss: 0,
    jitter: 0,
    rtt: 0,
  });

  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!peerConnection) {
      setStats({
        quality: "unknown",
        packetLoss: 0,
        jitter: 0,
        rtt: 0,
      });
      return;
    }

    const updateStats = async () => {
      try {
        const statsReport = await peerConnection.getStats();
        let packetLoss = 0;
        let jitter = 0;
        let rtt = 0;
        let hasInboundStats = false;

        statsReport.forEach((report) => {
          // Inbound RTP stream (receiving video/audio)
          if (report.type === "inbound-rtp" && report.kind === "video") {
            hasInboundStats = true;
            
            // Calculate packet loss percentage
            const packetsReceived = report.packetsReceived || 0;
            const packetsLost = report.packetsLost || 0;
            const totalPackets = packetsReceived + packetsLost;
            
            if (totalPackets > 0) {
              packetLoss = (packetsLost / totalPackets) * 100;
            }

            // Get jitter (in seconds, convert to ms)
            jitter = (report.jitter || 0) * 1000;
          }

          // Candidate pair stats (for RTT)
          if (report.type === "candidate-pair" && report.state === "succeeded") {
            rtt = report.currentRoundTripTime ? report.currentRoundTripTime * 1000 : 0;
          }
        });

        // Determine quality based on metrics
        let quality: ConnectionQuality = "unknown";
        
        if (hasInboundStats) {
          // Excellent: <1% packet loss, <30ms jitter, <100ms RTT
          // Good: <5% packet loss, <50ms jitter, <200ms RTT
          // Poor: anything worse
          if (packetLoss < 1 && jitter < 30 && rtt < 100) {
            quality = "excellent";
          } else if (packetLoss < 5 && jitter < 50 && rtt < 200) {
            quality = "good";
          } else {
            quality = "poor";
          }
        }

        setStats({
          quality,
          packetLoss: Math.round(packetLoss * 10) / 10,
          jitter: Math.round(jitter * 10) / 10,
          rtt: Math.round(rtt),
        });
      } catch (error) {
        console.error("Error fetching connection stats:", error);
      }
    };

    // Initial update
    updateStats();

    // Set up interval for periodic updates
    intervalRef.current = window.setInterval(updateStats, updateIntervalMs);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [peerConnection, updateIntervalMs]);

  return stats;
}
