import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import type { Participant, ChatMessage, WSMessage } from "@shared/schema";

interface WSClient extends WebSocket {
  participantId?: string;
  roomId?: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // API endpoint to get TURN server credentials
  // This keeps credentials secure on the server side
  app.get('/api/turn-credentials', (req, res) => {
    const turnServerUrl = process.env.TURN_SERVER_URL;
    const turnUsername = process.env.TURN_USERNAME;
    const turnPassword = process.env.TURN_PASSWORD;
    
    if (!turnServerUrl || !turnUsername || !turnPassword) {
      console.log('[TURN] No custom TURN server configured, using fallback');
      // Return fallback public STUN servers only
      return res.json({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
        hasTurn: false
      });
    }
    
    // Clean up the TURN URL - extract just the host:port
    // Remove any protocol prefix and any embedded credentials
    let cleanUrl = turnServerUrl;
    
    // Remove turn: or turns: prefix if present
    cleanUrl = cleanUrl.replace(/^turns?:/, '');
    
    // Remove any embedded credentials in brackets like [user:pass]
    cleanUrl = cleanUrl.replace(/\[.*?\]/g, '');
    
    // Extract just host:port (handle various formats)
    const hostPortMatch = cleanUrl.match(/^([^/?]+)/);
    const hostPort = hostPortMatch ? hostPortMatch[1] : cleanUrl;
    
    console.log(`[TURN] Serving credentials for turn:${hostPort}`);
    
    res.json({
      iceServers: [
        // STUN servers for direct connection discovery
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        
        // Your self-hosted Coturn TURN server - UDP (default, fastest)
        {
          urls: `turn:${hostPort}`,
          username: turnUsername,
          credential: turnPassword,
        },
        // TCP fallback (works through more firewalls)
        {
          urls: `turn:${hostPort}?transport=tcp`,
          username: turnUsername,
          credential: turnPassword,
        },
        // TLS/TURNS if your Coturn supports it (port 5349 typically)
        {
          urls: `turns:${hostPort.replace(':3478', ':5349')}`,
          username: turnUsername,
          credential: turnPassword,
        },
      ],
      hasTurn: true
    });
  });
  
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  const clients = new Map<string, WSClient>();

  wss.on('connection', (ws: WSClient) => {
    console.log('WebSocket client connected');

    ws.on('message', async (data: Buffer) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        
        // Guard: Block messages from clients that haven't successfully joined (no participantId)
        // Exception: Allow join-room messages to pass through for initial connection
        if (message.type !== 'join-room' && !ws.participantId) {
          console.log(`Blocked message from unregistered client: ${message.type}`);
          return;
        }
        
        switch (message.type) {
          case 'join-room': {
            const { roomId, participantId, participantName } = message;
            
            let room = await storage.getRoom(roomId);
            let isHost = !room;
            
            if (!room) {
              room = await storage.createRoom(roomId, participantId);
            } else {
              // Room exists - check if there are any active approved participants
              const existingParticipants = await storage.getParticipants(roomId);
              const activeHosts = existingParticipants.filter(p => 
                p.isHost && p.approvalStatus === 'approved' && clients.has(p.id)
              );
              
              // If no active host exists, promote this participant to host
              if (activeHosts.length === 0) {
                isHost = true;
                // Clean up any stale participants from this room
                for (const staleP of existingParticipants) {
                  if (!clients.has(staleP.id)) {
                    await storage.removeParticipant(roomId, staleP.id);
                  }
                }
                console.log(`No active host in room ${roomId}, promoting ${participantName} to host`);
              }
            }

            // Check if room is locked (non-host cannot join)
            if (!isHost && room.isLocked) {
              ws.send(JSON.stringify({
                type: 'room-locked-error',
                message: 'This room is locked and not accepting new participants',
              }));
              console.log(`Participant ${participantName} tried to join locked room ${roomId} - connection will be closed`);
              ws.close();
              break;
            }

            // Register client after lock check passes
            ws.participantId = participantId;
            ws.roomId = roomId;
            clients.set(participantId, ws);

            const participant: Participant = {
              id: participantId,
              name: participantName,
              roomId,
              isAudioEnabled: true,
              isVideoEnabled: true,
              isScreenSharing: false,
              isHost,
              approvalStatus: isHost ? "approved" : "pending",
              handRaised: false,
              canRecord: isHost,
              joinedAt: Date.now(),
            };

            await storage.addParticipant(participant);

            if (isHost) {
              const participants = await storage.getParticipants(roomId);
              ws.send(JSON.stringify({
                type: 'participants-list',
                participants,
              }));
              console.log(`Host ${participantName} created room ${roomId}`);
            } else {
              ws.send(JSON.stringify({
                type: 'waiting-approval',
                message: 'Waiting for host to approve your join request',
              }));

              broadcastToRoom(roomId, participantId, {
                type: 'join-request',
                participant,
              });

              console.log(`Participant ${participantName} requesting to join room ${roomId}`);
            }
            break;
          }

          case 'approve-participant': {
            const { roomId, participantId, targetParticipantId } = message;
            
            const requestingParticipant = await storage.getParticipant(participantId);
            if (!requestingParticipant) {
              console.error(`Unknown participant ${participantId} tried to approve - rejected`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Participant not found',
              }));
              break;
            }

            if (requestingParticipant.roomId !== roomId) {
              console.error(`Participant ${participantId} tried to approve in wrong room ${roomId} - rejected`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'You are not in this room',
              }));
              break;
            }

            if (!requestingParticipant.isHost) {
              console.error(`Non-host ${participantId} tried to approve participant - rejected`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Only the host can approve participants',
              }));
              break;
            }

            const targetParticipant = await storage.getParticipant(targetParticipantId);
            if (!targetParticipant || targetParticipant.roomId !== roomId) {
              console.error(`Target participant ${targetParticipantId} not in room ${roomId} - rejected`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Target participant not found in this room',
              }));
              break;
            }

            await storage.updateParticipant(targetParticipantId, { approvalStatus: "approved" });

            const participants = await storage.getParticipants(roomId);
            const room = await storage.getRoom(roomId);
            
            const targetClient = clients.get(targetParticipantId);
            if (targetClient) {
              targetClient.send(JSON.stringify({
                type: 'approval-granted',
                participants,
              }));
              
              // Sync current room state to newly approved participant
              if (room) {
                // Sync lock status
                if (room.isLocked) {
                  targetClient.send(JSON.stringify({
                    type: 'room-locked',
                    roomId,
                    isLocked: true,
                  }));
                }
                
                // Sync spotlight status
                if (room.spotlightedParticipantId) {
                  const spotlightedParticipant = await storage.getParticipant(room.spotlightedParticipantId);
                  targetClient.send(JSON.stringify({
                    type: 'participant-spotlighted',
                    roomId,
                    spotlightedParticipantId: room.spotlightedParticipantId,
                    spotlightedParticipantName: spotlightedParticipant?.name || null,
                  }));
                }
              }
            }

            broadcastToRoom(roomId, '', {
              type: 'participant-approved',
              participantId: targetParticipantId,
            });

            console.log(`Host ${participantId} approved participant ${targetParticipantId} in room ${roomId}`);
            break;
          }

          case 'deny-participant': {
            const { roomId, participantId, targetParticipantId } = message;
            
            const requestingParticipant = await storage.getParticipant(participantId);
            if (!requestingParticipant) {
              console.error(`Unknown participant ${participantId} tried to deny - rejected`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Participant not found',
              }));
              break;
            }

            if (requestingParticipant.roomId !== roomId) {
              console.error(`Participant ${participantId} tried to deny in wrong room ${roomId} - rejected`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'You are not in this room',
              }));
              break;
            }

            if (!requestingParticipant.isHost) {
              console.error(`Non-host ${participantId} tried to deny participant - rejected`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Only the host can deny participants',
              }));
              break;
            }

            const targetParticipant = await storage.getParticipant(targetParticipantId);
            if (!targetParticipant || targetParticipant.roomId !== roomId) {
              console.error(`Target participant ${targetParticipantId} not in room ${roomId} - rejected`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Target participant not found in this room',
              }));
              break;
            }

            await storage.removeParticipant(roomId, targetParticipantId);

            const targetClient = clients.get(targetParticipantId);
            if (targetClient) {
              targetClient.send(JSON.stringify({
                type: 'approval-denied',
                message: 'The host denied your join request',
              }));
              targetClient.close();
            }

            clients.delete(targetParticipantId);

            broadcastToRoom(roomId, '', {
              type: 'participant-denied',
              participantId: targetParticipantId,
            });

            console.log(`Host ${participantId} denied participant ${targetParticipantId} in room ${roomId}`);
            break;
          }

          case 'remove-participant': {
            const { roomId, participantId, targetParticipantId } = message;
            
            const requestingParticipant = await storage.getParticipant(participantId);
            if (!requestingParticipant) {
              console.error(`Unknown participant ${participantId} tried to remove - rejected`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Participant not found',
              }));
              break;
            }

            if (requestingParticipant.roomId !== roomId) {
              console.error(`Participant ${participantId} tried to remove in wrong room ${roomId} - rejected`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'You are not in this room',
              }));
              break;
            }

            if (!requestingParticipant.isHost) {
              console.error(`Non-host ${participantId} tried to remove participant - rejected`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Only the host can remove participants',
              }));
              break;
            }

            const targetParticipant = await storage.getParticipant(targetParticipantId);
            if (!targetParticipant || targetParticipant.roomId !== roomId) {
              console.error(`Target participant ${targetParticipantId} not in room ${roomId} - rejected`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Target participant not found in this room',
              }));
              break;
            }

            if (targetParticipant.isHost) {
              console.error(`Participant ${participantId} tried to remove host - rejected`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Cannot remove the host',
              }));
              break;
            }

            await storage.removeParticipant(roomId, targetParticipantId);

            const targetClient = clients.get(targetParticipantId);
            if (targetClient) {
              targetClient.send(JSON.stringify({
                type: 'removed-from-room',
                message: 'You have been removed from the room by the host',
              }));
              targetClient.close();
            }

            clients.delete(targetParticipantId);

            broadcastToRoom(roomId, '', {
              type: 'participant-left',
              participantId: targetParticipantId,
              participantName: targetParticipant.name,
            });

            console.log(`Host ${participantId} removed participant ${targetParticipantId} from room ${roomId}`);
            break;
          }

          case 'leave-room': {
            const { roomId, participantId } = message;
            
            const participant = (await storage.getParticipants(roomId))
              .find(p => p.id === participantId);

            await storage.removeParticipant(roomId, participantId);
            clients.delete(participantId);

            broadcastToRoom(roomId, participantId, {
              type: 'participant-left',
              participantId,
              participantName: participant?.name || 'Unknown',
            });

            console.log(`Participant ${participantId} left room ${roomId}`);
            break;
          }

          case 'chat-message': {
            const { roomId, message: messageText, participantId, participantName } = message;
            
            const chatMessage: ChatMessage = {
              id: Math.random().toString(36).substring(7),
              roomId,
              participantId,
              participantName,
              message: messageText,
              timestamp: Date.now(),
            };

            await storage.addMessage(chatMessage);

            broadcastToRoom(roomId, '', {
              type: 'chat-message',
              message: chatMessage,
            });

            console.log(`Chat message in room ${roomId} from ${participantName}`);
            break;
          }

          case 'signal': {
            const { roomId, targetId, signal, participantId } = message;
            
            const targetClient = clients.get(targetId);
            if (targetClient && targetClient.readyState === WebSocket.OPEN) {
              targetClient.send(JSON.stringify({
                type: 'signal',
                participantId,
                signal,
              }));
            }

            console.log(`Signal from ${participantId} to ${targetId} in room ${roomId}`);
            break;
          }

          case 'toggle-audio': {
            const { roomId, participantId, isEnabled } = message;
            
            await storage.updateParticipant(participantId, { isAudioEnabled: isEnabled });

            broadcastToRoom(roomId, participantId, {
              type: 'audio-toggled',
              participantId,
              isEnabled,
            });

            console.log(`Participant ${participantId} ${isEnabled ? 'enabled' : 'disabled'} audio`);
            break;
          }

          case 'toggle-video': {
            const { roomId, participantId, isEnabled } = message;
            
            await storage.updateParticipant(participantId, { isVideoEnabled: isEnabled });

            broadcastToRoom(roomId, participantId, {
              type: 'video-toggled',
              participantId,
              isEnabled,
            });

            console.log(`Participant ${participantId} ${isEnabled ? 'enabled' : 'disabled'} video`);
            break;
          }

          case 'screen-share': {
            const { roomId, participantId, isSharing } = message;
            
            await storage.updateParticipant(participantId, { isScreenSharing: isSharing });

            broadcastToRoom(roomId, participantId, {
              type: 'screen-share',
              participantId,
              isSharing,
            });

            console.log(`Participant ${participantId} ${isSharing ? 'started' : 'stopped'} screen sharing`);
            break;
          }

          case 'raise-hand': {
            const { roomId, participantId, isRaised } = message;
            
            await storage.updateParticipant(participantId, { handRaised: isRaised });

            broadcastToRoom(roomId, '', {
              type: 'hand-raised',
              participantId,
              isRaised,
            });

            console.log(`Participant ${participantId} ${isRaised ? 'raised' : 'lowered'} hand in room ${roomId}`);
            break;
          }

          case 'emoji-reaction': {
            const { roomId, participantId, participantName, emoji } = message;
            
            broadcastToRoom(roomId, '', {
              type: 'emoji-reaction',
              participantId,
              participantName,
              emoji,
            });

            console.log(`Participant ${participantName} sent ${emoji} reaction in room ${roomId}`);
            break;
          }

          case 'mute-all': {
            const { roomId, participantId } = message;
            
            const requester = await storage.getParticipant(participantId);
            if (!requester || !requester.isHost) {
              console.log(`Unauthorized mute-all attempt by ${participantId}`);
              break;
            }
            
            broadcastToRoom(roomId, participantId, {
              type: 'mute-all-command',
            });

            console.log(`Host ${participantId} muted all participants in room ${roomId}`);
            break;
          }

          case 'lock-room': {
            const { roomId, participantId, isLocked } = message;
            
            const requester = await storage.getParticipant(participantId);
            if (!requester || !requester.isHost) {
              console.log(`Unauthorized lock-room attempt by ${participantId}`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Only the host can lock/unlock the room',
              }));
              break;
            }
            
            await storage.updateRoom(roomId, { isLocked });
            
            broadcastToRoom(roomId, '', {
              type: 'room-locked',
              roomId,
              isLocked,
            });

            console.log(`Host ${participantId} ${isLocked ? 'locked' : 'unlocked'} room ${roomId}`);
            break;
          }

          case 'transfer-host': {
            const { roomId, participantId, newHostId } = message;
            
            // Verify requester is current host and in the same room
            const requester = await storage.getParticipant(participantId);
            if (!requester || !requester.isHost || requester.roomId !== roomId) {
              console.log(`Unauthorized transfer-host attempt by ${participantId}`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Only the host can transfer host role',
              }));
              break;
            }
            
            // Verify new host exists, is approved, and is in the same room
            const newHost = await storage.getParticipant(newHostId);
            if (!newHost || newHost.approvalStatus !== 'approved' || newHost.roomId !== roomId) {
              console.log(`Invalid transfer-host target: ${newHostId} (not in room or not approved)`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Cannot transfer host to this participant',
              }));
              break;
            }
            
            // Prevent transferring to self
            if (newHostId === participantId) {
              console.log(`Host ${participantId} attempted to transfer to self`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Cannot transfer host role to yourself',
              }));
              break;
            }
            
            // Update room hostId
            await storage.updateRoom(roomId, { hostId: newHostId });
            
            // Update old host's isHost to false
            await storage.updateParticipant(participantId, { isHost: false });
            
            // Update new host's isHost to true and grant recording permission
            await storage.updateParticipant(newHostId, { isHost: true, canRecord: true });
            
            // Broadcast host-transferred to all participants
            broadcastToRoom(roomId, '', {
              type: 'host-transferred',
              roomId,
              newHostId,
              newHostName: newHost.name,
            });

            console.log(`Host transferred from ${requester.name} to ${newHost.name} in room ${roomId}`);
            break;
          }

          case 'spotlight-participant': {
            const { roomId, participantId, targetParticipantId } = message;
            
            // Verify requester is host
            const requester = await storage.getParticipant(participantId);
            if (!requester || !requester.isHost) {
              console.log(`Unauthorized spotlight attempt by ${participantId}`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Only the host can spotlight participants',
              }));
              break;
            }
            
            // If clearing spotlight (null), verify it
            let targetName: string | null = null;
            if (targetParticipantId) {
              const target = await storage.getParticipant(targetParticipantId);
              if (!target || target.roomId !== roomId) {
                console.log(`Invalid spotlight target: ${targetParticipantId}`);
                ws.send(JSON.stringify({
                  type: 'error',
                  message: 'Cannot spotlight this participant',
                }));
                break;
              }
              targetName = target.name;
            }
            
            // Update room spotlightedParticipantId
            await storage.updateRoom(roomId, { spotlightedParticipantId: targetParticipantId });
            
            // Broadcast to all participants
            broadcastToRoom(roomId, '', {
              type: 'participant-spotlighted',
              roomId,
              spotlightedParticipantId: targetParticipantId,
              spotlightedParticipantName: targetName,
            });

            console.log(`Host ${participantId} ${targetParticipantId ? `spotlighted ${targetName}` : 'cleared spotlight'} in room ${roomId}`);
            break;
          }

          case 'force-disable-audio': {
            const { roomId, participantId, targetParticipantId } = message;
            
            // Verify requester is host
            const requester = await storage.getParticipant(participantId);
            if (!requester || !requester.isHost) {
              console.log(`Unauthorized force-disable-audio attempt by ${participantId}`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Only the host can force disable audio',
              }));
              break;
            }
            
            // Verify target exists and is in same room
            const target = await storage.getParticipant(targetParticipantId);
            if (!target || target.roomId !== roomId) {
              console.log(`Invalid force-disable-audio target: ${targetParticipantId}`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Cannot disable audio for this participant',
              }));
              break;
            }
            
            // Send force-disable command to target participant
            const targetClient = clients.get(targetParticipantId);
            if (targetClient && targetClient.readyState === WebSocket.OPEN) {
              targetClient.send(JSON.stringify({
                type: 'audio-force-disabled',
                targetParticipantId,
              }));
              
              console.log(`Host ${participantId} force-disabled audio for ${target.name}`);
            }
            break;
          }

          case 'force-disable-video': {
            const { roomId, participantId, targetParticipantId } = message;
            
            // Verify requester is host
            const requester = await storage.getParticipant(participantId);
            if (!requester || !requester.isHost) {
              console.log(`Unauthorized force-disable-video attempt by ${participantId}`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Only the host can force disable video',
              }));
              break;
            }
            
            // Verify target exists and is in same room
            const target = await storage.getParticipant(targetParticipantId);
            if (!target || target.roomId !== roomId) {
              console.log(`Invalid force-disable-video target: ${targetParticipantId}`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Cannot disable video for this participant',
              }));
              break;
            }
            
            // Send force-disable command to target participant
            const targetClient = clients.get(targetParticipantId);
            if (targetClient && targetClient.readyState === WebSocket.OPEN) {
              targetClient.send(JSON.stringify({
                type: 'video-force-disabled',
                targetParticipantId,
              }));
              
              console.log(`Host ${participantId} force-disabled video for ${target.name}`);
            }
            break;
          }

          case 'grant-recording-permission': {
            const { roomId, participantId, targetParticipantId } = message;
            
            // Verify requester is host
            const requester = await storage.getParticipant(participantId);
            if (!requester || !requester.isHost) {
              console.log(`Unauthorized grant-recording-permission attempt by ${participantId}`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Only the host can grant recording permissions',
              }));
              break;
            }
            
            // Verify target exists and is in same room
            const target = await storage.getParticipant(targetParticipantId);
            if (!target || target.roomId !== roomId) {
              console.log(`Invalid grant-recording-permission target: ${targetParticipantId}`);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Cannot grant permission to this participant',
              }));
              break;
            }
            
            // Toggle recording permission
            const newCanRecord = !target.canRecord;
            await storage.updateParticipant(targetParticipantId, { canRecord: newCanRecord });
            
            // Notify target participant
            const targetClient = clients.get(targetParticipantId);
            if (targetClient && targetClient.readyState === WebSocket.OPEN) {
              targetClient.send(JSON.stringify({
                type: 'recording-permission-updated',
                targetParticipantId,
                canRecord: newCanRecord,
              }));
            }
            
            console.log(`Host ${participantId} ${newCanRecord ? 'granted' : 'revoked'} recording permission for ${target.name}`);
            break;
          }
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });

    ws.on('close', async () => {
      if (ws.participantId && ws.roomId) {
        const participant = (await storage.getParticipants(ws.roomId))
          .find(p => p.id === ws.participantId);

        await storage.removeParticipant(ws.roomId, ws.participantId);
        clients.delete(ws.participantId);

        broadcastToRoom(ws.roomId, ws.participantId, {
          type: 'participant-left',
          participantId: ws.participantId,
          participantName: participant?.name || 'Unknown',
        });

        console.log(`WebSocket client disconnected: ${ws.participantId}`);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  function broadcastToRoom(roomId: string, excludeId: string, message: any) {
    clients.forEach((client, clientId) => {
      if (
        client.roomId === roomId &&
        clientId !== excludeId &&
        client.readyState === WebSocket.OPEN
      ) {
        client.send(JSON.stringify(message));
      }
    });
  }

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  return httpServer;
}
