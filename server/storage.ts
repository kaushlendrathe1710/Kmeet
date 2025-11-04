import { type User, type InsertUser, type Room, type Participant, type ChatMessage } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createRoom(roomId: string, hostId: string): Promise<Room>;
  getRoom(roomId: string): Promise<Room | undefined>;
  updateRoom(roomId: string, updates: Partial<Room>): Promise<void>;
  deleteRoom(roomId: string): Promise<void>;
  
  addParticipant(participant: Participant): Promise<void>;
  removeParticipant(roomId: string, participantId: string): Promise<void>;
  getParticipant(participantId: string): Promise<Participant | undefined>;
  getParticipants(roomId: string): Promise<Participant[]>;
  updateParticipant(participantId: string, updates: Partial<Participant>): Promise<void>;
  
  addMessage(message: ChatMessage): Promise<void>;
  getMessages(roomId: string): Promise<ChatMessage[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private rooms: Map<string, Room>;
  private participants: Map<string, Participant>;
  private messages: Map<string, ChatMessage[]>;

  constructor() {
    this.users = new Map();
    this.rooms = new Map();
    this.participants = new Map();
    this.messages = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createRoom(roomId: string, hostId: string): Promise<Room> {
    const room: Room = {
      id: roomId,
      name: `Room ${roomId}`,
      createdAt: Date.now(),
      hostId,
      participants: [],
      isLocked: false,
      spotlightedParticipantId: null,
    };
    this.rooms.set(roomId, room);
    this.messages.set(roomId, []);
    return room;
  }

  async getRoom(roomId: string): Promise<Room | undefined> {
    return this.rooms.get(roomId);
  }

  async updateRoom(roomId: string, updates: Partial<Room>): Promise<void> {
    const room = this.rooms.get(roomId);
    if (room) {
      this.rooms.set(roomId, { ...room, ...updates });
    }
  }

  async deleteRoom(roomId: string): Promise<void> {
    this.rooms.delete(roomId);
    this.messages.delete(roomId);
    Array.from(this.participants.values())
      .filter(p => p.roomId === roomId)
      .forEach(p => this.participants.delete(p.id));
  }

  async addParticipant(participant: Participant): Promise<void> {
    this.participants.set(participant.id, participant);
    const room = this.rooms.get(participant.roomId);
    if (room) {
      room.participants.push(participant.id);
    }
  }

  async removeParticipant(roomId: string, participantId: string): Promise<void> {
    this.participants.delete(participantId);
    const room = this.rooms.get(roomId);
    if (room) {
      room.participants = room.participants.filter(id => id !== participantId);
      if (room.participants.length === 0) {
        await this.deleteRoom(roomId);
      }
    }
  }

  async getParticipant(participantId: string): Promise<Participant | undefined> {
    return this.participants.get(participantId);
  }

  async getParticipants(roomId: string): Promise<Participant[]> {
    return Array.from(this.participants.values()).filter(
      p => p.roomId === roomId
    );
  }

  async updateParticipant(participantId: string, updates: Partial<Participant>): Promise<void> {
    const participant = this.participants.get(participantId);
    if (participant) {
      this.participants.set(participantId, { ...participant, ...updates });
    }
  }

  async addMessage(message: ChatMessage): Promise<void> {
    const roomMessages = this.messages.get(message.roomId) || [];
    roomMessages.push(message);
    this.messages.set(message.roomId, roomMessages);
  }

  async getMessages(roomId: string): Promise<ChatMessage[]> {
    return this.messages.get(roomId) || [];
  }
}

export const storage = new MemStorage();
