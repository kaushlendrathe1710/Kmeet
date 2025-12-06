import SimplePeer from "simple-peer";

export interface PeerConnection {
  peer: SimplePeer.Instance;
  stream: MediaStream | null;
  participantId: string;
  participantName: string;
}

// Cache for dynamic TURN credentials
let cachedIceServers: RTCIceServer[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Base STUN servers (always available, no credentials needed)
const stunServers: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

// Fetch TURN credentials from your backend (which securely stores your Coturn credentials)
async function fetchCustomTurnCredentials(): Promise<{
  iceServers: RTCIceServer[];
  hasTurn: boolean;
}> {
  try {
    console.log(
      "[WebRTC] 📡 Fetching TURN credentials from /api/turn-credentials..."
    );
    const response = await fetch("/api/turn-credentials", {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      console.error(`[WebRTC] ❌ TURN API returned HTTP ${response.status}`);
      throw new Error(`TURN credentials API returned ${response.status}`);
    }

    const data = await response.json();
    console.log("[WebRTC] ✅ Received ICE server configuration from backend");
    console.log(`[WebRTC] 📊 Server count: ${data.iceServers?.length || 0}`);
    console.log(
      `[WebRTC] 🔄 TURN server available: ${data.hasTurn ? "YES" : "NO"}`
    );

    // Log each ICE server for debugging
    if (data.iceServers && Array.isArray(data.iceServers)) {
      data.iceServers.forEach((server: RTCIceServer, idx: number) => {
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        urls.forEach((url) => {
          const serverType = url.startsWith("turn:")
            ? "🔄 TURN"
            : url.startsWith("turns:")
            ? "🔒 TURNS"
            : url.startsWith("stun:")
            ? "📍 STUN"
            : "❓ Unknown";
          console.log(`[WebRTC] ${serverType} Server ${idx + 1}: ${url}`);
        });
      });

      return {
        iceServers: data.iceServers,
        hasTurn: data.hasTurn || false,
      };
    }

    console.error(
      "[WebRTC] ❌ Invalid response format - missing iceServers array"
    );
    throw new Error("Invalid response format from TURN credentials API");
  } catch (error) {
    console.error("[WebRTC] ❌ Failed to fetch TURN credentials:", error);
    return { iceServers: [], hasTurn: false };
  }
}

// Fallback public TURN servers (if custom TURN server is not configured)
function getPublicTurnServers(): RTCIceServer[] {
  return [
    // Metered.ca Open Relay - public TURN on common ports
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ];
}

// Get ICE servers with dynamic credentials (cached)
export async function getIceServers(): Promise<RTCIceServer[]> {
  const now = Date.now();

  // Return cached servers if still valid
  if (cachedIceServers && now - cacheTimestamp < CACHE_DURATION) {
    console.log(
      "[WebRTC] 💾 Using cached ICE servers (cache valid for",
      Math.round((CACHE_DURATION - (now - cacheTimestamp)) / 1000),
      "more seconds)"
    );
    return cachedIceServers;
  }

  console.log(
    "[WebRTC] 🔄 Cache expired or empty, fetching fresh ICE servers..."
  );

  // Try to fetch credentials from your backend
  const { iceServers: serverIceServers, hasTurn } =
    await fetchCustomTurnCredentials();

  let iceServers: RTCIceServer[] = [...stunServers];

  if (hasTurn && serverIceServers.length > 0) {
    // Use custom TURN server from backend
    iceServers = serverIceServers;
    console.log("[WebRTC] ✅ Using custom TURN server configuration");
  } else {
    // Fall back to public TURN servers
    iceServers = [...iceServers, ...getPublicTurnServers()];
    console.warn(
      "[WebRTC] ⚠️ No custom TURN server configured, using public fallback servers"
    );
    console.warn(
      "[WebRTC] 💡 Tip: Configure TURN_SERVER_URL, TURN_USERNAME, and TURN_PASSWORD in .env"
    );
  }

  // Cache the result
  cachedIceServers = iceServers;
  cacheTimestamp = now;

  console.log(`[WebRTC] 📦 Total ICE servers configured: ${iceServers.length}`);
  const turnCount = iceServers.filter((s) => {
    const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
    return urls.some(
      (url) => url.startsWith("turn:") || url.startsWith("turns:")
    );
  }).length;
  const stunCount = iceServers.filter((s) => {
    const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
    return urls.some((url) => url.startsWith("stun:"));
  }).length;
  console.log(
    `[WebRTC] 📊 Breakdown: ${stunCount} STUN servers, ${turnCount} TURN servers`
  );

  return iceServers;
}

// Create peer with pre-fetched ICE servers
export function createPeerWithServers(
  initiator: boolean,
  stream: MediaStream,
  participantId: string,
  participantName: string,
  iceServers: RTCIceServer[],
  forceRelay: boolean = false
): SimplePeer.Instance {
  console.log(`[WebRTC] 🔗 Creating peer connection`);
  console.log(
    `[WebRTC]   └─ Participant: ${participantName} (${participantId})`
  );
  console.log(
    `[WebRTC]   └─ Role: ${
      initiator ? "Initiator (offers)" : "Responder (answers)"
    }`
  );
  console.log(
    `[WebRTC]   └─ Force relay: ${
      forceRelay ? "YES (TURN only)" : "NO (all candidates)"
    }`
  );
  console.log(
    `[WebRTC]   └─ Stream tracks: ${stream.getTracks().length} (${
      stream.getVideoTracks().length
    } video, ${stream.getAudioTracks().length} audio)`
  );

  const peer = new SimplePeer({
    initiator,
    trickle: true,
    stream,
    config: {
      iceServers,
      iceCandidatePoolSize: 10,
      // Force relay mode for testing TURN - helps diagnose connection issues
      iceTransportPolicy: forceRelay ? "relay" : "all",
    },
  });

  // Log when signaling data is generated
  peer.on("signal", (data: SimplePeer.SignalData) => {
    if (data.type) {
      console.log(
        `[WebRTC] 📤 Signal generated for ${participantName}: ${data.type.toUpperCase()}`
      );
    } else if ((data as any).candidate) {
      const candidateStr = (data as any).candidate?.candidate || "";
      const candidateType = candidateStr.includes("typ relay")
        ? "relay (TURN)"
        : candidateStr.includes("typ srflx")
        ? "srflx (STUN)"
        : candidateStr.includes("typ host")
        ? "host (local)"
        : "unknown";
      console.log(
        `[WebRTC] 🧊 ICE candidate for ${participantName}: ${candidateType}`
      );

      // Special logging for relay candidates - these prove TURN is working
      if (candidateType === "relay (TURN)") {
        console.log(
          `[WebRTC] ✅ TURN relay candidate discovered for ${participantName}! Cross-network connectivity confirmed.`
        );
      }
    }
  });

  // Add ICE connection state logging for debugging
  peer.on("iceStateChange", (iceConnectionState: string) => {
    const stateIcon =
      iceConnectionState === "connected"
        ? "✅"
        : iceConnectionState === "completed"
        ? "✅"
        : iceConnectionState === "checking"
        ? "🔍"
        : iceConnectionState === "failed"
        ? "❌"
        : iceConnectionState === "disconnected"
        ? "⚠️"
        : "📡";

    console.log(
      `[WebRTC] ${stateIcon} ICE state for ${participantName}: ${iceConnectionState.toUpperCase()}`
    );

    if (
      iceConnectionState === "connected" ||
      iceConnectionState === "completed"
    ) {
      console.log(`[WebRTC] ✅ Successfully connected to ${participantName}!`);
      logSelectedCandidatePair(peer, participantName);
    } else if (iceConnectionState === "failed") {
      console.error(`[WebRTC] ❌ Connection FAILED for ${participantName}`);
      console.error(`[WebRTC] 💡 Possible causes:`);
      console.error(
        `[WebRTC]    1. TURN server not reachable (check firewall/ports)`
      );
      console.error(`[WebRTC]    2. Invalid TURN credentials`);
      console.error(
        `[WebRTC]    3. Both peers behind symmetric NAT without TURN`
      );
      console.error(`[WebRTC] 🔧 Troubleshooting:`);
      console.error(
        `[WebRTC]    - Verify TURN server is running: systemctl status coturn`
      );
      console.error(`[WebRTC]    - Check ports 3478/5349 are open`);
      console.error(
        `[WebRTC]    - Try different network (mobile hotspot) to isolate issue`
      );
    } else if (iceConnectionState === "disconnected") {
      console.warn(
        `[WebRTC] ⚠️ Temporarily disconnected from ${participantName} - will attempt reconnection`
      );
    } else if (iceConnectionState === "checking") {
      console.log(`[WebRTC] 🔍 Checking connectivity to ${participantName}...`);
    }
  });

  peer.on("connect", () => {
    console.log(`[WebRTC] ✅ Data channel established with ${participantName}`);
  });

  peer.on("stream", (remoteStream: MediaStream) => {
    console.log(`[WebRTC] 🎥 Received media stream from ${participantName}`);
    console.log(
      `[WebRTC]   └─ Video tracks: ${remoteStream.getVideoTracks().length}`
    );
    console.log(
      `[WebRTC]   └─ Audio tracks: ${remoteStream.getAudioTracks().length}`
    );
    remoteStream.getTracks().forEach((track, idx) => {
      console.log(
        `[WebRTC]   └─ Track ${idx + 1}: ${track.kind} (${
          track.label || "no label"
        }) - ${track.readyState}`
      );
    });
  });

  peer.on("error", (err: Error) => {
    console.error(
      `[WebRTC] ❌ Peer error for ${participantName}:`,
      err.message
    );
    console.error(`[WebRTC] Error details:`, err);
  });

  peer.on("close", () => {
    console.log(`[WebRTC] 🔌 Connection closed for ${participantName}`);
  });

  return peer;
}

// Helper to log the selected ICE candidate pair
function logSelectedCandidatePair(
  peer: SimplePeer.Instance,
  participantName: string
) {
  try {
    const pc = (peer as any)._pc as RTCPeerConnection;
    if (pc && pc.getStats) {
      pc.getStats()
        .then((stats: RTCStatsReport) => {
          stats.forEach((report: any) => {
            if (
              report.type === "candidate-pair" &&
              report.state === "succeeded"
            ) {
              console.log(
                `[WebRTC] 🎯 Active connection path for ${participantName}:`
              );
              console.log(`[WebRTC]   └─ Local: ${report.localCandidateType}`);
              console.log(
                `[WebRTC]   └─ Remote: ${report.remoteCandidateType}`
              );
              console.log(`[WebRTC]   └─ Protocol: ${report.protocol}`);

              // Determine connection type for user-friendly message
              const isRelay =
                report.localCandidateType === "relay" ||
                report.remoteCandidateType === "relay";
              const isSrflx =
                report.localCandidateType === "srflx" ||
                report.remoteCandidateType === "srflx";

              if (isRelay) {
                console.log(
                  `[WebRTC] 🔄 Using TURN relay - excellent for cross-network connections!`
                );
              } else if (isSrflx) {
                console.log(
                  `[WebRTC] 📍 Using STUN-assisted P2P - good direct connection!`
                );
              } else {
                console.log(
                  `[WebRTC] 🏠 Using local P2P - perfect for same network!`
                );
              }

              // Find the actual candidate details
              stats.forEach((candidate: any) => {
                if (candidate.id === report.localCandidateId) {
                  console.log(
                    `[WebRTC]   └─ Local endpoint: ${
                      candidate.candidateType
                    } via ${candidate.protocol} at ${
                      candidate.address || "unknown"
                    }:${candidate.port || "?"}`
                  );
                }
                if (candidate.id === report.remoteCandidateId) {
                  console.log(
                    `[WebRTC]   └─ Remote endpoint: ${
                      candidate.candidateType
                    } via ${candidate.protocol} at ${
                      candidate.address || "unknown"
                    }:${candidate.port || "?"}`
                  );
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn(
            `[WebRTC] ⚠️ Could not retrieve connection stats:`,
            err.message
          );
        });
    }
  } catch (e) {
    console.warn(`[WebRTC] ⚠️ Stats API not available:`, e);
  }
}

// Legacy function for backward compatibility - now async
export async function createPeer(
  initiator: boolean,
  stream: MediaStream,
  participantId: string,
  participantName: string
): Promise<SimplePeer.Instance> {
  const iceServers = await getIceServers();
  return createPeerWithServers(
    initiator,
    stream,
    participantId,
    participantName,
    iceServers,
    false
  );
}
