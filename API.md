# PodcastMeet API Documentation

## Overview

PodcastMeet uses WebSocket for real-time communication between clients and server. All messages are JSON-formatted and follow a consistent structure. The server also provides HTTP endpoints for health checks and future REST API capabilities.

---

## WebSocket Connection

**Endpoint**: `wss://[your-domain]/ws`

All clients must connect to this endpoint and send a `join-room` message before sending any other messages. Messages from unregistered clients (without `participantId`) are blocked except for `join-room`.

---

## WebSocket Message Types

### Room Management

#### `join-room`
Join or create a room. The first participant becomes the host.

**Client → Server:**
```json
{
  "type": "join-room",
  "roomId": "string",
  "participantId": "string",
  "participantName": "string"
}
```

**Response (Host)**:
```json
{
  "type": "participants-list",
  "participants": [...]
}
```

**Response (Guest - Pending Approval)**:
```json
{
  "type": "waiting-approval",
  "message": "Waiting for host to approve your join request"
}
```

**Error (Locked Room)**:
```json
{
  "type": "room-locked-error",
  "message": "This room is locked and not accepting new participants"
}
```

---

#### `leave-room`
Participant voluntarily leaves the room.

**Client → Server:**
```json
{
  "type": "leave-room",
  "roomId": "string",
  "participantId": "string"
}
```

**Broadcast to Room:**
```json
{
  "type": "participant-left",
  "participantId": "string",
  "participantName": "string"
}
```

---

### Participant Approval System

#### `approve-participant` (Host Only)
Host approves a pending participant.

**Client → Server:**
```json
{
  "type": "approve-participant",
  "roomId": "string",
  "participantId": "string (host)",
  "targetParticipantId": "string"
}
```

**To Approved Participant:**
```json
{
  "type": "approval-granted",
  "participants": [...]
}
```

**Broadcast to Room:**
```json
{
  "type": "participant-approved",
  "participantId": "string"
}
```

---

#### `deny-participant` (Host Only)
Host denies a pending participant.

**Client → Server:**
```json
{
  "type": "deny-participant",
  "roomId": "string",
  "participantId": "string (host)",
  "targetParticipantId": "string"
}
```

**To Denied Participant:**
```json
{
  "type": "approval-denied",
  "message": "The host denied your join request"
}
```

**Broadcast to Room:**
```json
{
  "type": "participant-denied",
  "participantId": "string"
}
```

---

#### `remove-participant` (Host Only)
Host removes an approved participant from the room.

**Client → Server:**
```json
{
  "type": "remove-participant",
  "roomId": "string",
  "participantId": "string (host)",
  "targetParticipantId": "string"
}
```

**To Removed Participant:**
```json
{
  "type": "removed-from-room",
  "message": "You have been removed from the room by the host"
}
```

**Broadcast to Room:**
```json
{
  "type": "participant-left",
  "participantId": "string",
  "participantName": "string"
}
```

---

### Media Controls

#### `toggle-audio`
Enable or disable participant's microphone.

**Client → Server:**
```json
{
  "type": "toggle-audio",
  "roomId": "string",
  "participantId": "string",
  "isEnabled": true
}
```

**Broadcast to Room:**
```json
{
  "type": "audio-toggled",
  "participantId": "string",
  "isEnabled": true
}
```

---

#### `toggle-video`
Enable or disable participant's camera.

**Client → Server:**
```json
{
  "type": "toggle-video",
  "roomId": "string",
  "participantId": "string",
  "isEnabled": true
}
```

**Broadcast to Room:**
```json
{
  "type": "video-toggled",
  "participantId": "string",
  "isEnabled": true
}
```

---

#### `screen-share`
Start or stop screen sharing.

**Client → Server:**
```json
{
  "type": "screen-share",
  "roomId": "string",
  "participantId": "string",
  "isSharing": true
}
```

**Broadcast to Room:**
```json
{
  "type": "screen-share",
  "participantId": "string",
  "isSharing": true
}
```

---

### Communication

#### `chat-message`
Send a chat message to all participants.

**Client → Server:**
```json
{
  "type": "chat-message",
  "roomId": "string",
  "participantId": "string",
  "participantName": "string",
  "message": "string"
}
```

**Broadcast to Room:**
```json
{
  "type": "chat-message",
  "message": {
    "id": "string",
    "roomId": "string",
    "participantId": "string",
    "participantName": "string",
    "message": "string",
    "timestamp": 1234567890
  }
}
```

---

#### `raise-hand`
Raise or lower hand for attention.

**Client → Server:**
```json
{
  "type": "raise-hand",
  "roomId": "string",
  "participantId": "string",
  "isRaised": true
}
```

**Broadcast to Room:**
```json
{
  "type": "hand-raised",
  "participantId": "string",
  "isRaised": true
}
```

---

#### `emoji-reaction`
Send an emoji reaction (visible temporarily).

**Client → Server:**
```json
{
  "type": "emoji-reaction",
  "roomId": "string",
  "participantId": "string",
  "participantName": "string",
  "emoji": "👍"
}
```

**Broadcast to Room:**
```json
{
  "type": "emoji-reaction",
  "participantId": "string",
  "participantName": "string",
  "emoji": "👍"
}
```

---

### File Sharing

#### `file-upload`
Share a file with all participants (max 5MB).

**Client → Server:**
```json
{
  "type": "file-upload",
  "roomId": "string",
  "participantId": "string",
  "file": {
    "id": "string",
    "name": "string",
    "size": 1234567,
    "type": "string",
    "uploadedBy": "string",
    "timestamp": 1234567890,
    "data": "base64-encoded-string"
  }
}
```

**Broadcast to Room:**
```json
{
  "type": "file-shared",
  "file": {
    "id": "string",
    "name": "string",
    "size": 1234567,
    "type": "string",
    "uploadedBy": "string",
    "timestamp": 1234567890,
    "data": "base64-encoded-string"
  }
}
```

**Limits**: Maximum file size is 5MB

---

### Host Controls

#### `mute-all` (Host Only)
Host mutes all participants' microphones.

**Client → Server:**
```json
{
  "type": "mute-all",
  "roomId": "string",
  "participantId": "string (host)"
}
```

**Broadcast to Room:**
```json
{
  "type": "mute-all-command"
}
```

---

#### `force-disable-audio` (Host Only)
Host force-mutes a specific participant.

**Client → Server:**
```json
{
  "type": "force-disable-audio",
  "roomId": "string",
  "participantId": "string (host)",
  "targetParticipantId": "string"
}
```

**To Target Participant:**
```json
{
  "type": "force-audio-disabled"
}
```

---

#### `lock-room` (Host Only)
Lock or unlock the room to prevent new participants from joining.

**Client → Server:**
```json
{
  "type": "lock-room",
  "roomId": "string",
  "participantId": "string (host)",
  "isLocked": true
}
```

**Broadcast to Room:**
```json
{
  "type": "room-locked",
  "roomId": "string",
  "isLocked": true
}
```

---

#### `transfer-host` (Host Only)
Transfer host role to another approved participant.

**Client → Server:**
```json
{
  "type": "transfer-host",
  "roomId": "string",
  "participantId": "string (current host)",
  "newHostId": "string"
}
```

**Broadcast to Room:**
```json
{
  "type": "host-transferred",
  "roomId": "string",
  "newHostId": "string",
  "newHostName": "string"
}
```

---

#### `spotlight-participant` (Host Only)
Spotlight a participant (or clear spotlight with null).

**Client → Server:**
```json
{
  "type": "spotlight-participant",
  "roomId": "string",
  "participantId": "string (host)",
  "targetParticipantId": "string | null"
}
```

**Broadcast to Room:**
```json
{
  "type": "participant-spotlighted",
  "roomId": "string",
  "spotlightedParticipantId": "string | null",
  "spotlightedParticipantName": "string | null"
}
```

---

### WebRTC Signaling

#### `signal`
Exchange WebRTC signaling data for peer connection establishment.

**Client → Server:**
```json
{
  "type": "signal",
  "roomId": "string",
  "participantId": "string (sender)",
  "targetId": "string (recipient)",
  "signal": {
    "type": "offer | answer | candidate",
    "sdp": "...",
    "candidate": "..."
  }
}
```

**Server → Target Participant:**
```json
{
  "type": "signal",
  "participantId": "string (sender)",
  "signal": {...}
}
```

---

## Data Models

### Participant
```typescript
{
  id: string;                    // UUID v4
  name: string;                  // Display name
  roomId: string;                // Room identifier
  isAudioEnabled: boolean;       // Microphone status
  isVideoEnabled: boolean;       // Camera status
  isScreenSharing: boolean;      // Screen share status
  isHost: boolean;               // Host privilege
  approvalStatus: "pending" | "approved" | "denied";
  handRaised: boolean;           // Hand raise status
  canRecord: boolean;            // Recording permission
  joinedAt: number;              // Unix timestamp (ms)
}
```

### Room
```typescript
{
  id: string;                    // 8-character room ID
  hostId: string;                // Host participant ID
  isLocked: boolean;             // Lock status
  spotlightedParticipantId: string | null;  // Spotlighted participant
  createdAt: number;             // Unix timestamp (ms)
}
```

### ChatMessage
```typescript
{
  id: string;                    // Message UUID
  roomId: string;                // Room identifier
  participantId: string;         // Sender ID
  participantName: string;       // Sender name
  message: string;               // Message content
  timestamp: number;             // Unix timestamp (ms)
}
```

---

## Error Handling

All errors are sent to the requesting client:

```json
{
  "type": "error",
  "message": "Error description"
}
```

### Common Error Messages:
- `"Participant not found"`
- `"You are not in this room"`
- `"Only the host can approve participants"`
- `"Only the host can deny participants"`
- `"Only the host can remove participants"`
- `"Only the host can lock/unlock the room"`
- `"Only the host can transfer host role"`
- `"Only the host can spotlight participants"`
- `"Only the host can force disable audio"`
- `"Target participant not found in this room"`
- `"Cannot remove the host"`
- `"Cannot transfer host role to yourself"`
- `"Cannot transfer host to this participant"`

---

## Security & Authorization

### Message Validation
1. All messages from clients without `participantId` are blocked (except `join-room`)
2. All host-only actions verify the requester's `isHost` status
3. All operations verify participants are in the same room
4. Room isolation is strictly enforced

### Host Privileges
Only the host (first participant or transferred host) can:
- Approve participants
- Deny participants
- Remove participants
- Mute all participants
- Force-mute individual participants
- Lock/unlock the room
- Transfer host role
- Spotlight participants

### Validation Rules
All host actions validate:
1. Requester exists in storage
2. Requester is in the specified room
3. Requester has `isHost: true`
4. Target participant exists and is in the same room
5. Target participant has appropriate status (e.g., approved for removal)

---

## Recording System

Recording is handled **entirely client-side** using RecordRTC. The server does not receive or process recording data.

### Recording Features:
- **Individual Track Recording**: Each participant's audio is recorded separately
- **Format Support**: WebM (default) or WAV
- **Quality**: 48kHz audio sample rate for broadcast quality
- **Controls**: Start/Stop with countdown, Pause/Resume
- **Automatic Download**: All tracks download when recording stops
- **Dynamic Participants**: Handles participants joining/leaving during recording

### File Naming Convention:
```
YYYY-MM-DD_HH-MM_ParticipantName.webm
```

### Recording Workflow:
1. Click record button → 3-second countdown
2. Press 'Escape' to cancel countdown
3. Recording starts → all participants recorded on separate tracks
4. Optional: Pause/resume during session
5. Click stop → all tracks automatically download

---

## Connection Lifecycle

1. **Connect**: Client establishes WebSocket connection to `/ws`
2. **Join**: Client sends `join-room` message
3. **Approval**: Guest waits for host approval (host auto-approved)
4. **WebRTC Setup**: Participants exchange `signal` messages
5. **Active Session**: Participants exchange media, chat, and control messages
6. **Disconnect**: Connection closes, participant removed from room

---

## Best Practices

### For Clients:
1. **Reconnection**: Implement exponential backoff for reconnection attempts
2. **State Sync**: Listen for all broadcast messages to keep UI in sync
3. **Error Handling**: Handle all error types gracefully with user feedback
4. **File Validation**: Validate file size client-side before upload (5MB max)
5. **WebRTC Cleanup**: Properly close peer connections on disconnect
6. **Recording Management**: Handle RecordRTC instances carefully to avoid memory leaks

### For Server Integration:
1. **Message Validation**: All messages are validated using Zod schemas
2. **Host Authorization**: Always verify host status server-side
3. **Room Isolation**: Enforce room boundaries for all operations
4. **Participant Membership**: Verify participants exist and are approved
5. **Security Logging**: Log all security violations and unauthorized attempts

---

## Debugging

### Server Logs
The server logs all WebSocket events to console:
- Join/leave events
- Approval/denial actions
- Host control actions
- Security violations
- Error conditions

### Browser DevTools
Use browser DevTools to:
- Monitor WebSocket messages (Network tab → WS filter)
- Check connection status
- View sent/received messages
- Debug signaling issues
- Inspect RecordRTC recording state

### Common Issues:
1. **WebRTC Connection Failed**: Check STUN server connectivity
2. **Recording Not Starting**: Verify microphone permissions granted
3. **File Upload Failed**: Check file size is under 5MB
4. **Participant Not Approved**: Ensure host has approved the join request
5. **Locked Room**: Room must be unlocked to allow new participants

---

## Example Message Flows

### Example 1: Joining as Host
```
Client → Server: join-room
Server → Client: participants-list
```

### Example 2: Joining as Guest
```
Guest → Server: join-room
Server → Guest: waiting-approval
Server → Host: join-request
Host → Server: approve-participant
Server → Guest: approval-granted
Server → All: participant-approved
```

### Example 3: WebRTC Connection
```
Participant A → Server: signal (offer)
Server → Participant B: signal (offer)
Participant B → Server: signal (answer)
Server → Participant A: signal (answer)
Participant A ↔ Server ↔ Participant B: signal (ICE candidates)
```

### Example 4: Screen Sharing
```
Client → Server: screen-share (isSharing: true)
Server → All: screen-share (isSharing: true)
[User clicks browser "Stop sharing"]
Client → Server: screen-share (isSharing: false)
Server → All: screen-share (isSharing: false)
```

### Example 5: File Sharing
```
Client → Server: file-upload (base64 data, < 5MB)
Server → All: file-shared (same data)
Other clients: Download from shared data
```

---

## Additional Resources

- **TypeScript Types**: `shared/schema.ts` - All message and data types
- **Storage Interface**: `server/storage.ts` - In-memory storage operations
- **WebSocket Handlers**: `server/routes.ts` - All message handling logic
- **Frontend Implementation**: `client/src/pages/room.tsx` - Main room component
- **Recording Component**: `client/src/components/recording-controls.tsx`
