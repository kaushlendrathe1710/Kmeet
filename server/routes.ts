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
  
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  const clients = new Map<string, WSClient>();

  wss.on('connection', (ws: WSClient) => {
    console.log('WebSocket client connected');

    ws.on('message', async (data: Buffer) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'join-room': {
            const { roomId, participantId, participantName } = message;
            
            ws.participantId = participantId;
            ws.roomId = roomId;
            clients.set(participantId, ws);

            let room = await storage.getRoom(roomId);
            const isHost = !room;
            
            if (!room) {
              room = await storage.createRoom(roomId, participantId);
            }

            const participant: Participant = {
              id: participantId,
              name: participantName,
              roomId,
              isAudioEnabled: true,
              isVideoEnabled: true,
              isScreenSharing: false,
              isHost,
              approvalStatus: isHost ? "approved" : "pending",
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
            
            const targetClient = clients.get(targetParticipantId);
            if (targetClient) {
              targetClient.send(JSON.stringify({
                type: 'approval-granted',
                participants,
              }));
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
              type: 'screen-share-toggled',
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
