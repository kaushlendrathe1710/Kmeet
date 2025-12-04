import SimplePeer from "simple-peer";

export interface PeerConnection {
  peer: SimplePeer.Instance;
  stream: MediaStream | null;
  participantId: string;
  participantName: string;
}

// ICE servers configuration with STUN and TURN for cross-network connectivity
const iceServers: RTCIceServer[] = [
  // Google STUN servers (free, for direct connections)
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  
  // OpenRelay TURN servers (free, for relay when direct connection fails)
  // These are essential for connections across different networks/cities
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  
  // Additional free TURN servers for redundancy
  {
    urls: "turn:relay.metered.ca:80",
    username: "e8dd65b92c62d5e00375c5c6",
    credential: "kW/y3OjHsAzqFRy7",
  },
  {
    urls: "turn:relay.metered.ca:443",
    username: "e8dd65b92c62d5e00375c5c6",
    credential: "kW/y3OjHsAzqFRy7",
  },
  {
    urls: "turn:relay.metered.ca:443?transport=tcp",
    username: "e8dd65b92c62d5e00375c5c6",
    credential: "kW/y3OjHsAzqFRy7",
  },
];

export function createPeer(
  initiator: boolean,
  stream: MediaStream,
  participantId: string,
  participantName: string
): SimplePeer.Instance {
  const peer = new SimplePeer({
    initiator,
    trickle: true, // Enable trickle ICE for faster connection setup
    stream,
    config: {
      iceServers,
      iceCandidatePoolSize: 10, // Pre-gather candidates for faster connection
    },
  });

  // Add ICE connection state logging for debugging
  peer.on("iceStateChange", (iceConnectionState: string) => {
    console.log(`[WebRTC] ICE state for ${participantName}: ${iceConnectionState}`);
  });

  peer.on("error", (err: Error) => {
    console.error(`[WebRTC] Peer error for ${participantName}:`, err.message);
  });

  return peer;
}
