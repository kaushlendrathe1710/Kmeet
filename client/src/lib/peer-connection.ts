import SimplePeer from "simple-peer";

export interface PeerConnection {
  peer: SimplePeer.Instance;
  stream: MediaStream | null;
  participantId: string;
  participantName: string;
}

export function createPeer(
  initiator: boolean,
  stream: MediaStream,
  participantId: string,
  participantName: string
): SimplePeer.Instance {
  const peer = new SimplePeer({
    initiator,
    trickle: false,
    stream,
    config: {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    },
  });

  return peer;
}
