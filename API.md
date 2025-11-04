# PodcastMeet - API Documentation

## Overview
This document describes all HTTP API endpoints and WebSocket messages available in PodcastMeet.

---

## 🌐 HTTP API Endpoints

### Base URL
- Development: `http://localhost:5000`
- Production: Your deployed URL

---

### Health Check

#### `GET /api/health`
Check if the server is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1234567890
}
```

---

## 🔌 WebSocket API

### Connection
Connect to WebSocket server at: `ws://your-domain/`

### Message Format
All messages are JSON strings with a `type` field and additional data.

---

## 📨 WebSocket Message Types

### 1. Room Management

#### `join-room`
Request to join a room (sent by client).

**Client → Server:**
```json
{
  "type": "join-room",
  "roomId": "ABCD1234",
  "participantId": "uuid-v4",
  "participantName": "John Doe"
}
```

**Server Response (Host):**
```json
{
  "type": "participants-list",
  "participants": [
    {
      "id": "uuid-v4",
      "name": "John Doe",
      "roomId": "ABCD1234",
      "isAudioEnabled": true,
      "isVideoEnabled": true,
      "isScreenSharing": false,
      "isHost": true,
      "approvalStatus": "approved",
      "joinedAt": 1234567890
    }
  ]
}
```

**Server Response (Non-Host):**
```json
{
  "type": "waiting-approval",
  "message": "Waiting for host to approve your join request"
}
```

---

#### `leave-room`
Leave a room (sent by client).

**Client → Server:**
```json
{
  "type": "leave-room",
  "roomId": "ABCD1234",
  "participantId": "uuid-v4"
}
```

**Server → All Participants:**
```json
{
  "type": "participant-left",
  "roomId": "ABCD1234",
  "participantId": "uuid-v4",
  "participantName": "John Doe"
}
```

---

### 2. Participant Approval

#### `request-join`
Broadcast to host when someone requests to join.

**Server → Host:**
```json
{
  "type": "join-request",
  "participant": {
    "id": "uuid-v4",
    "name": "Jane Smith",
    "roomId": "ABCD1234",
    "isAudioEnabled": true,
    "isVideoEnabled": true,
    "isScreenSharing": false,
    "isHost": false,
    "approvalStatus": "pending",
    "joinedAt": 1234567890
  }
}
```

---

#### `approve-participant`
Host approves a participant (sent by host).

**Client → Server:**
```json
{
  "type": "approve-participant",
  "roomId": "ABCD1234",
  "participantId": "host-uuid",
  "targetParticipantId": "guest-uuid"
}
```

**Server → Approved Participant:**
```json
{
  "type": "approval-granted",
  "participants": [/* array of all participants */]
}
```

**Server → All Participants:**
```json
{
  "type": "participant-approved",
  "participantId": "guest-uuid"
}
```

---

#### `deny-participant`
Host denies a participant (sent by host).

**Client → Server:**
```json
{
  "type": "deny-participant",
  "roomId": "ABCD1234",
  "participantId": "host-uuid",
  "targetParticipantId": "guest-uuid"
}
```

**Server → Denied Participant:**
```json
{
  "type": "approval-denied",
  "message": "The host denied your join request"
}
```

**Server → All Participants:**
```json
{
  "type": "participant-denied",
  "participantId": "guest-uuid"
}
```

---

### 3. WebRTC Signaling

#### `signal`
Exchange WebRTC signaling data (offers, answers, ICE candidates).

**Client → Server:**
```json
{
  "type": "signal",
  "roomId": "ABCD1234",
  "targetId": "recipient-uuid",
  "participantId": "sender-uuid",
  "signal": {
    "type": "offer|answer|candidate",
    "sdp": "...",
    "candidate": "..."
  }
}
```

**Server → Target Participant:**
```json
{
  "type": "signal",
  "participantId": "sender-uuid",
  "signal": {/* signal data */}
}
```

---

### 4. Media Controls

#### `toggle-audio`
Notify when participant toggles microphone.

**Client → Server:**
```json
{
  "type": "toggle-audio",
  "roomId": "ABCD1234",
  "participantId": "uuid-v4",
  "isEnabled": false
}
```

**Server → All Participants:**
```json
{
  "type": "audio-toggled",
  "participantId": "uuid-v4",
  "isEnabled": false
}
```

---

#### `toggle-video`
Notify when participant toggles camera.

**Client → Server:**
```json
{
  "type": "toggle-video",
  "roomId": "ABCD1234",
  "participantId": "uuid-v4",
  "isEnabled": false
}
```

**Server → All Participants:**
```json
{
  "type": "video-toggled",
  "participantId": "uuid-v4",
  "isEnabled": false
}
```

---

#### `screen-share`
Notify when participant toggles screen sharing.

**Client → Server:**
```json
{
  "type": "screen-share",
  "roomId": "ABCD1234",
  "participantId": "uuid-v4",
  "isSharing": true
}
```

**Server → All Participants:**
```json
{
  "type": "screen-sharing-toggled",
  "participantId": "uuid-v4",
  "isSharing": true
}
```

---

### 5. Chat Messages

#### `chat-message`
Send a chat message.

**Client → Server:**
```json
{
  "type": "chat-message",
  "roomId": "ABCD1234",
  "participantId": "uuid-v4",
  "participantName": "John Doe",
  "message": "Hello everyone!"
}
```

**Server → All Participants:**
```json
{
  "type": "chat-message",
  "message": {
    "id": "message-uuid",
    "roomId": "ABCD1234",
    "participantId": "uuid-v4",
    "participantName": "John Doe",
    "message": "Hello everyone!",
    "timestamp": 1234567890
  }
}
```

---

### 6. Error Messages

#### `error`
Server sends error messages when requests fail.

**Server → Client:**
```json
{
  "type": "error",
  "message": "Only the host can approve participants"
}
```

**Common Error Messages:**
- `"Participant not found"`
- `"You are not in this room"`
- `"Only the host can approve participants"`
- `"Only the host can deny participants"`
- `"Target participant not found in this room"`

---

## 📊 Data Models

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
  joinedAt: number;              // Unix timestamp
}
```

### Room
```typescript
{
  id: string;                    // 8-character room ID
  name: string;                  // Display name
  createdAt: number;             // Unix timestamp
  hostId: string;                // Host participant ID
  participants: string[];        // Array of participant IDs
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
  timestamp: number;             // Unix timestamp
}
```

---

## 🔐 Authorization

### Host Privileges
Only the host (first participant) can:
- Approve participants (`approve-participant`)
- Deny participants (`deny-participant`)

### Validation Rules
All `approve-participant` and `deny-participant` requests validate:
1. Requester exists in storage
2. Requester is in the specified room
3. Requester has `isHost: true`
4. Target participant exists in the same room

Failed validations return an `error` message.

---

## 🛡️ Security Notes

### WebSocket Security
- All messages validated using Zod schemas
- Host authorization checked server-side
- Room isolation enforced
- Participant membership verified
- Cross-room operations blocked

### Best Practices
- Always validate message types
- Check participant status before operations
- Handle disconnections gracefully
- Clean up resources on leave
- Log security violations

---

## 📝 Message Flow Examples

### Example 1: Joining a Room as Host
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
Participant A → Server: signal (ICE candidate)
Server → Participant B: signal (ICE candidate)
```

### Example 4: Sending Chat Message
```
Client → Server: chat-message
Server → All Participants: chat-message
```

---

## 🔄 Connection Lifecycle

### 1. Connect
Client establishes WebSocket connection.

### 2. Join Room
Client sends `join-room` message.

### 3. Approval (if guest)
Guest waits for host approval via `approve-participant`.

### 4. WebRTC Setup
Participants exchange `signal` messages to establish peer connections.

### 5. Active Session
Participants exchange media, chat, and control messages.

### 6. Disconnect
Client sends `leave-room` or connection closes.

### 7. Cleanup
Server removes participant and notifies others.

---

## 📚 Additional Resources

### TypeScript Types
All message types are defined in `shared/schema.ts`:
- `WSMessage` - Union type of all WebSocket messages
- `Participant` - Participant data structure
- `Room` - Room data structure
- `ChatMessage` - Chat message structure

### Storage Interface
Storage operations in `server/storage.ts`:
- `createRoom(roomId, hostId)` - Create new room
- `getRoom(roomId)` - Get room data
- `addParticipant(participant)` - Add participant
- `getParticipant(participantId)` - Get single participant
- `getParticipants(roomId)` - Get all room participants
- `updateParticipant(id, updates)` - Update participant
- `removeParticipant(roomId, participantId)` - Remove participant
- `addMessage(message)` - Add chat message
- `getMessages(roomId)` - Get chat history

---

## 🐛 Debugging

### Enable Logging
Server logs all WebSocket events to console:
- Join/leave events
- Approval/denial actions
- Security violations
- Error conditions

### Common Issues
1. **Participant not found**: Ensure participant ID exists
2. **Not in room**: Verify room ID matches participant's room
3. **Not host**: Check `isHost` flag is true
4. **Target not found**: Confirm target participant is in room

### Testing Tools
Use browser DevTools to:
- Monitor WebSocket messages (Network tab)
- Check connection status
- View sent/received messages
- Debug signaling issues
