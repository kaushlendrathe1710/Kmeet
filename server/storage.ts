import { 
  type User, 
  type InsertUser, 
  type Room, 
  type Participant, 
  type ChatMessage,
  type OtpToken,
  type InsertOtpToken,
  type Session,
  type InsertSession,
  type SubscriptionPlan,
  type InsertSubscriptionPlan,
  type Subscription,
  type InsertSubscription,
  type Recording,
  type InsertRecording,
  type MeetingHistory,
  type InsertMeetingHistory,
  users,
  otpTokens,
  sessions,
  subscriptionPlans,
  subscriptions,
  recordings,
  meetingHistory,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gt, desc, asc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

// Super admin email that cannot be deleted
export const SUPER_ADMIN_EMAIL = "kaushlendra.k12@fms.edu";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  getUsersCount(): Promise<number>;
  
  // OTP operations
  createOtpToken(otp: InsertOtpToken): Promise<OtpToken>;
  getValidOtp(email: string, otp: string): Promise<OtpToken | undefined>;
  markOtpAsUsed(id: string): Promise<void>;
  cleanupExpiredOtps(): Promise<void>;
  
  // Session operations
  createSession(session: InsertSession): Promise<Session>;
  getSessionByToken(token: string): Promise<Session | undefined>;
  deleteSession(id: string): Promise<void>;
  deleteUserSessions(userId: string): Promise<void>;
  cleanupExpiredSessions(): Promise<void>;
  
  // Subscription plan operations
  createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan>;
  getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined>;
  getAllSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  updateSubscriptionPlan(id: string, updates: Partial<SubscriptionPlan>): Promise<SubscriptionPlan | undefined>;
  deleteSubscriptionPlan(id: string): Promise<boolean>;
  
  // User subscription operations
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  getUserSubscription(userId: string): Promise<Subscription | undefined>;
  updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription | undefined>;
  
  // Recording operations
  createRecording(recording: InsertRecording): Promise<Recording>;
  getRecording(id: string): Promise<Recording | undefined>;
  getUserRecordings(userId: string): Promise<Recording[]>;
  deleteRecording(id: string): Promise<boolean>;
  
  // Meeting history operations
  createMeetingHistory(history: InsertMeetingHistory): Promise<MeetingHistory>;
  getUserMeetingHistory(userId: string): Promise<MeetingHistory[]>;
  updateMeetingHistory(id: string, updates: Partial<MeetingHistory>): Promise<void>;
  
  // In-memory room operations (for WebSocket compatibility)
  createRoom(roomId: string, hostId: string, hostUserId?: string): Promise<Room>;
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
  
  // Admin utilities
  ensureSuperAdmin(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // In-memory storage for real-time room data (rooms, participants, messages are transient)
  private rooms: Map<string, Room> = new Map();
  private participants: Map<string, Participant> = new Map();
  private messages: Map<string, ChatMessage[]> = new Map();

  // === User Operations ===
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({ ...insertUser, email: insertUser.email.toLowerCase() })
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    // Get user first to check if super admin
    const user = await this.getUser(id);
    if (!user) return false;
    
    // Prevent deletion of super admin
    if (user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      throw new Error("Cannot delete super admin account");
    }
    
    const result = await db.delete(users).where(eq(users.id, id));
    return true;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getUsersCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(users);
    return Number(result[0]?.count || 0);
  }

  // === OTP Operations ===
  async createOtpToken(otp: InsertOtpToken): Promise<OtpToken> {
    const [token] = await db
      .insert(otpTokens)
      .values({ ...otp, email: otp.email.toLowerCase() })
      .returning();
    return token;
  }

  async getValidOtp(email: string, otp: string): Promise<OtpToken | undefined> {
    const [token] = await db
      .select()
      .from(otpTokens)
      .where(
        and(
          eq(otpTokens.email, email.toLowerCase()),
          eq(otpTokens.otp, otp),
          eq(otpTokens.isUsed, false),
          gt(otpTokens.expiresAt, new Date())
        )
      );
    return token || undefined;
  }

  async markOtpAsUsed(id: string): Promise<void> {
    await db.update(otpTokens).set({ isUsed: true }).where(eq(otpTokens.id, id));
  }

  async cleanupExpiredOtps(): Promise<void> {
    await db.delete(otpTokens).where(
      sql`${otpTokens.expiresAt} < NOW() OR ${otpTokens.isUsed} = true`
    );
  }

  // === Session Operations ===
  async createSession(session: InsertSession): Promise<Session> {
    const [newSession] = await db
      .insert(sessions)
      .values(session)
      .returning();
    return newSession;
  }

  async getSessionByToken(token: string): Promise<Session | undefined> {
    const [session] = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.token, token),
          gt(sessions.expiresAt, new Date())
        )
      );
    return session || undefined;
  }

  async deleteSession(id: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.id, id));
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  }

  async cleanupExpiredSessions(): Promise<void> {
    await db.delete(sessions).where(sql`${sessions.expiresAt} < NOW()`);
  }

  // === Subscription Plan Operations ===
  async createSubscriptionPlan(plan: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const [newPlan] = await db
      .insert(subscriptionPlans)
      .values(plan)
      .returning();
    return newPlan;
  }

  async getSubscriptionPlan(id: string): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id));
    return plan || undefined;
  }

  async getAllSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return await db.select().from(subscriptionPlans).orderBy(asc(subscriptionPlans.price));
  }

  async updateSubscriptionPlan(id: string, updates: Partial<SubscriptionPlan>): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db
      .update(subscriptionPlans)
      .set(updates)
      .where(eq(subscriptionPlans.id, id))
      .returning();
    return plan || undefined;
  }

  async deleteSubscriptionPlan(id: string): Promise<boolean> {
    await db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, id));
    return true;
  }

  // === User Subscription Operations ===
  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    const [newSub] = await db
      .insert(subscriptions)
      .values(subscription)
      .returning();
    return newSub;
  }

  async getUserSubscription(userId: string): Promise<Subscription | undefined> {
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);
    return sub || undefined;
  }

  async updateSubscription(id: string, updates: Partial<Subscription>): Promise<Subscription | undefined> {
    const [sub] = await db
      .update(subscriptions)
      .set(updates)
      .where(eq(subscriptions.id, id))
      .returning();
    return sub || undefined;
  }

  // === Recording Operations ===
  async createRecording(recording: InsertRecording): Promise<Recording> {
    const [newRec] = await db
      .insert(recordings)
      .values(recording)
      .returning();
    return newRec;
  }

  async getRecording(id: string): Promise<Recording | undefined> {
    const [rec] = await db.select().from(recordings).where(eq(recordings.id, id));
    return rec || undefined;
  }

  async getUserRecordings(userId: string): Promise<Recording[]> {
    return await db
      .select()
      .from(recordings)
      .where(eq(recordings.userId, userId))
      .orderBy(desc(recordings.createdAt));
  }

  async deleteRecording(id: string): Promise<boolean> {
    await db.delete(recordings).where(eq(recordings.id, id));
    return true;
  }

  // === Meeting History Operations ===
  async createMeetingHistory(history: InsertMeetingHistory): Promise<MeetingHistory> {
    const [newHistory] = await db
      .insert(meetingHistory)
      .values(history)
      .returning();
    return newHistory;
  }

  async getUserMeetingHistory(userId: string): Promise<MeetingHistory[]> {
    return await db
      .select()
      .from(meetingHistory)
      .where(eq(meetingHistory.userId, userId))
      .orderBy(desc(meetingHistory.joinedAt));
  }

  async updateMeetingHistory(id: string, updates: Partial<MeetingHistory>): Promise<void> {
    await db.update(meetingHistory).set(updates).where(eq(meetingHistory.id, id));
  }

  // === In-memory Room Operations ===
  async createRoom(roomId: string, hostId: string, hostUserId?: string): Promise<Room> {
    const room: Room = {
      id: roomId,
      name: `Room ${roomId}`,
      createdAt: Date.now(),
      hostId,
      hostUserId,
      participants: [],
      isLocked: false,
      spotlightedParticipantId: null,
      password: null,
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

  // === Admin Utilities ===
  async ensureSuperAdmin(): Promise<void> {
    const existingAdmin = await this.getUserByEmail(SUPER_ADMIN_EMAIL);
    if (!existingAdmin) {
      // Super admin will be created when they first log in via OTP
      console.log(`Super admin (${SUPER_ADMIN_EMAIL}) will be created on first login`);
    } else if (existingAdmin.role !== "superadmin") {
      // Ensure the super admin has correct role
      await this.updateUser(existingAdmin.id, { role: "superadmin" });
      console.log(`Updated ${SUPER_ADMIN_EMAIL} to superadmin role`);
    }
  }
}

export const storage = new DatabaseStorage();
