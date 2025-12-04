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

// Fetch dynamic TURN credentials from Cloudflare (no API key needed)
async function fetchCloudflareTurnCredentials(): Promise<RTCIceServer[]> {
  try {
    console.log("[WebRTC] Fetching Cloudflare TURN credentials...");
    const response = await fetch("https://speed.cloudflare.com/turn-creds", {
      method: "GET",
      headers: { "Accept": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`Cloudflare TURN API returned ${response.status}`);
    }
    
    const data = await response.json();
    console.log("[WebRTC] ✅ Got Cloudflare TURN credentials");
    
    // Cloudflare returns { iceServers: [...] }
    if (data.iceServers && Array.isArray(data.iceServers)) {
      return data.iceServers;
    }
    
    throw new Error("Invalid response format from Cloudflare");
  } catch (error) {
    console.warn("[WebRTC] Failed to fetch Cloudflare TURN:", error);
    return [];
  }
}

// Fallback static TURN servers (less reliable but better than nothing)
function getStaticTurnServers(): RTCIceServer[] {
  return [
    // Metered.ca Open Relay - public TURN on common ports
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp",
        "turns:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    // Twilio backup - commonly works
    {
      urls: "turn:global.turn.twilio.com:3478?transport=udp",
      username: "demo",
      credential: "demo",
    },
  ];
}

// Get ICE servers with dynamic credentials (cached)
export async function getIceServers(): Promise<RTCIceServer[]> {
  const now = Date.now();
  
  // Return cached servers if still valid
  if (cachedIceServers && (now - cacheTimestamp) < CACHE_DURATION) {
    console.log("[WebRTC] Using cached ICE servers");
    return cachedIceServers;
  }
  
  // Try to fetch dynamic credentials from Cloudflare
  const cloudflareTurn = await fetchCloudflareTurnCredentials();
  
  // Combine STUN + dynamic TURN + static fallbacks
  let iceServers: RTCIceServer[] = [...stunServers];
  
  if (cloudflareTurn.length > 0) {
    iceServers = [...iceServers, ...cloudflareTurn];
    console.log("[WebRTC] Using Cloudflare TURN servers");
  } else {
    // Fall back to static TURN servers
    iceServers = [...iceServers, ...getStaticTurnServers()];
    console.log("[WebRTC] Using fallback static TURN servers");
  }
  
  // Cache the result
  cachedIceServers = iceServers;
  cacheTimestamp = now;
  
  console.log("[WebRTC] ICE servers configured:", iceServers.length, "servers");
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
  console.log(`[WebRTC] Creating peer for ${participantName}, initiator: ${initiator}, forceRelay: ${forceRelay}`);
  
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
      console.log(`[WebRTC] Signal generated for ${participantName}: ${data.type}`);
    } else if ((data as any).candidate) {
      const candidateStr = (data as any).candidate?.candidate || "";
      const candidateType = candidateStr.includes("typ relay") ? "relay (TURN)" :
                           candidateStr.includes("typ srflx") ? "srflx (STUN)" :
                           candidateStr.includes("typ host") ? "host (local)" : "unknown";
      console.log(`[WebRTC] ICE candidate for ${participantName}: ${candidateType}`);
      
      // Special logging for relay candidates - these prove TURN is working
      if (candidateType === "relay (TURN)") {
        console.log(`[WebRTC] ✅ TURN relay candidate found for ${participantName}!`);
      }
    }
  });

  // Add ICE connection state logging for debugging
  peer.on("iceStateChange", (iceConnectionState: string) => {
    console.log(`[WebRTC] ICE state for ${participantName}: ${iceConnectionState}`);
    
    if (iceConnectionState === "connected" || iceConnectionState === "completed") {
      console.log(`[WebRTC] ✅ Successfully connected to ${participantName}!`);
      logSelectedCandidatePair(peer, participantName);
    } else if (iceConnectionState === "failed") {
      console.error(`[WebRTC] ❌ Connection FAILED for ${participantName}`);
      console.error(`[WebRTC] This usually means TURN servers are not working or blocked.`);
      console.error(`[WebRTC] Try: 1) Different network, 2) Disable VPN/firewall, 3) Use mobile data`);
    } else if (iceConnectionState === "disconnected") {
      console.warn(`[WebRTC] ⚠️ Disconnected from ${participantName}`);
    }
  });

  peer.on("connect", () => {
    console.log(`[WebRTC] ✅ Data channel connected to ${participantName}`);
  });

  peer.on("stream", (remoteStream: MediaStream) => {
    console.log(`[WebRTC] 🎥 Received stream from ${participantName}`, {
      videoTracks: remoteStream.getVideoTracks().length,
      audioTracks: remoteStream.getAudioTracks().length,
    });
  });

  peer.on("error", (err: Error) => {
    console.error(`[WebRTC] ❌ Peer error for ${participantName}:`, err.message);
  });

  peer.on("close", () => {
    console.log(`[WebRTC] Connection closed for ${participantName}`);
  });

  return peer;
}

// Helper to log the selected ICE candidate pair
function logSelectedCandidatePair(peer: SimplePeer.Instance, participantName: string) {
  try {
    const pc = (peer as any)._pc as RTCPeerConnection;
    if (pc && pc.getStats) {
      pc.getStats().then((stats: RTCStatsReport) => {
        stats.forEach((report: any) => {
          if (report.type === "candidate-pair" && report.state === "succeeded") {
            console.log(`[WebRTC] Connection type for ${participantName}:`, {
              localType: report.localCandidateType,
              remoteType: report.remoteCandidateType,
              protocol: report.protocol,
            });
            
            // Find the actual candidate details
            stats.forEach((candidate: any) => {
              if (candidate.id === report.localCandidateId) {
                console.log(`[WebRTC] Local candidate:`, candidate.candidateType, candidate.protocol, candidate.address);
              }
              if (candidate.id === report.remoteCandidateId) {
                console.log(`[WebRTC] Remote candidate:`, candidate.candidateType, candidate.protocol, candidate.address);
              }
            });
          }
        });
      }).catch(() => {});
    }
  } catch (e) {
    // Stats not available, that's ok
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
  return createPeerWithServers(initiator, stream, participantId, participantName, iceServers, false);
}
