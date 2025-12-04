import SimplePeer from "simple-peer";

export interface PeerConnection {
  peer: SimplePeer.Instance;
  stream: MediaStream | null;
  participantId: string;
  participantName: string;
}

// ICE servers configuration with STUN and TURN for cross-network connectivity
// TURN servers are REQUIRED for connections across different networks/NATs
const iceServers: RTCIceServer[] = [
  // Google STUN servers (free, for direct connections on same network)
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  
  // freestun.net - Free TURN server with working static credentials
  {
    urls: "turn:freestun.net:3478",
    username: "free",
    credential: "free",
  },
  {
    urls: "turn:freestun.net:5349",
    username: "free",
    credential: "free",
  },
  {
    urls: "turns:freestun.net:5349",
    username: "free",
    credential: "free",
  },
  
  // Numb STUN/TURN - widely used free server
  {
    urls: "turn:numb.viagenie.ca",
    username: "webrtc@live.com",
    credential: "muazkh",
  },
  
  // OpenRelay TURN servers (may have rate limits)
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
];

export function createPeer(
  initiator: boolean,
  stream: MediaStream,
  participantId: string,
  participantName: string
): SimplePeer.Instance {
  console.log(`[WebRTC] Creating peer for ${participantName}, initiator: ${initiator}`);
  
  const peer = new SimplePeer({
    initiator,
    trickle: true, // Enable trickle ICE for faster connection setup
    stream,
    config: {
      iceServers,
      iceCandidatePoolSize: 10, // Pre-gather candidates for faster connection
      // iceTransportPolicy: "relay", // Uncomment to force TURN relay for testing
    },
  });

  // Log when signaling data is generated
  peer.on("signal", (data: SimplePeer.SignalData) => {
    if (data.type) {
      console.log(`[WebRTC] Signal generated for ${participantName}: ${data.type}`);
    } else if ((data as any).candidate) {
      // Log candidate type for debugging
      const candidateStr = (data as any).candidate?.candidate || "";
      const candidateType = candidateStr.includes("typ relay") ? "relay (TURN)" :
                           candidateStr.includes("typ srflx") ? "srflx (STUN)" :
                           candidateStr.includes("typ host") ? "host (local)" : "unknown";
      console.log(`[WebRTC] ICE candidate for ${participantName}: ${candidateType}`);
    }
  });

  // Add ICE connection state logging for debugging
  peer.on("iceStateChange", (iceConnectionState: string) => {
    console.log(`[WebRTC] ICE state for ${participantName}: ${iceConnectionState}`);
    
    if (iceConnectionState === "connected" || iceConnectionState === "completed") {
      console.log(`[WebRTC] ✅ Successfully connected to ${participantName}!`);
      // Log the selected candidate pair for debugging
      try {
        const pc = (peer as any)._pc as RTCPeerConnection;
        if (pc && pc.getStats) {
          pc.getStats().then((stats: RTCStatsReport) => {
            stats.forEach((report: any) => {
              if (report.type === "candidate-pair" && report.state === "succeeded") {
                console.log(`[WebRTC] Selected pair for ${participantName}:`, {
                  localType: report.localCandidateType,
                  remoteType: report.remoteCandidateType,
                  protocol: report.protocol,
                });
              }
            });
          });
        }
      } catch (e) {
        // Stats not available, that's ok
      }
    } else if (iceConnectionState === "failed") {
      console.error(`[WebRTC] ❌ Connection FAILED for ${participantName} - TURN servers may not be working`);
    } else if (iceConnectionState === "disconnected") {
      console.warn(`[WebRTC] ⚠️ Disconnected from ${participantName}, attempting to reconnect...`);
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
