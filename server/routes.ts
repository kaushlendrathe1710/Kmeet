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
              joinedAt: Date.now(),
            };

            await storage.addParticipant(participant);

            const participants = await storage.getParticipants(roomId);
            
            ws.send(JSON.stringify({
              type: 'participants-list',
              participants,
            }));

            broadcastToRoom(roomId, participantId, {
              type: 'participant-joined',
              participant,
            });

            console.log(`Participant ${participantName} joined room ${roomId}`);
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
