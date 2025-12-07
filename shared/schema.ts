import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, boolean, integer, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User roles enum
export type UserRole = "user" | "admin" | "superadmin";

// Subscription status enum
export type SubscriptionStatus = "active" | "expired" | "cancelled" | "trial";

// Users table - stores all registered users
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  mobile: text("mobile"),
  role: text("role").notNull().default("user"), // user, admin, superadmin
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  otpTokens: many(otpTokens),
  sessions: many(sessions),
  subscription: one(subscriptions, {
    fields: [users.id],
    references: [subscriptions.userId],
  }),
  recordings: many(recordings),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  lastLoginAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// OTP tokens for passwordless email authentication
export const otpTokens = pgTable("otp_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  otp: text("otp").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  isUsed: boolean("is_used").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const otpTokensRelations = relations(otpTokens, ({ one }) => ({
  user: one(users, {
    fields: [otpTokens.email],
    references: [users.email],
  }),
}));

export const insertOtpTokenSchema = createInsertSchema(otpTokens).omit({
  id: true,
  createdAt: true,
});

export type InsertOtpToken = z.infer<typeof insertOtpTokenSchema>;
export type OtpToken = typeof otpTokens.$inferSelect;

// Sessions table for persistent login
export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
});

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
});

export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;

// Subscription plans table
export const subscriptionPlans = pgTable("subscription_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  price: integer("price").notNull(), // Price in cents
  durationDays: integer("duration_days").notNull(),
  features: jsonb("features").notNull().default([]), // Array of feature strings
  maxRecordingMinutes: integer("max_recording_minutes").notNull().default(0),
  maxParticipants: integer("max_participants").notNull().default(10),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({
  id: true,
  createdAt: true,
});

export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;

// User subscriptions
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  planId: varchar("plan_id").notNull().references(() => subscriptionPlans.id),
  status: text("status").notNull().default("active"), // active, expired, cancelled, trial
  startDate: timestamp("start_date").notNull().defaultNow(),
  endDate: timestamp("end_date").notNull(),
  recordingMinutesUsed: integer("recording_minutes_used").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
  plan: one(subscriptionPlans, {
    fields: [subscriptions.planId],
    references: [subscriptionPlans.id],
  }),
}));

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
});

export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

// Recordings table for saved video recordings
export const recordings = pgTable("recordings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roomId: text("room_id").notNull(),
  roomName: text("room_name"),
  fileName: text("file_name").notNull(),
  s3Key: text("s3_key").notNull(),
  s3Url: text("s3_url").notNull(),
  fileSize: integer("file_size").notNull(), // Size in bytes
  duration: integer("duration").notNull(), // Duration in seconds
  format: text("format").notNull().default("webm"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const recordingsRelations = relations(recordings, ({ one }) => ({
  user: one(users, {
    fields: [recordings.userId],
    references: [users.id],
  }),
}));

export const insertRecordingSchema = createInsertSchema(recordings).omit({
  id: true,
  createdAt: true,
});

export type InsertRecording = z.infer<typeof insertRecordingSchema>;
export type Recording = typeof recordings.$inferSelect;

// Meeting history for tracking user's meetings
export const meetingHistory = pgTable("meeting_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roomId: text("room_id").notNull(),
  roomName: text("room_name"),
  wasHost: boolean("was_host").notNull().default(false),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  leftAt: timestamp("left_at"),
  duration: integer("duration"), // Duration in seconds
});

export const meetingHistoryRelations = relations(meetingHistory, ({ one }) => ({
  user: one(users, {
    fields: [meetingHistory.userId],
    references: [users.id],
  }),
}));

export const insertMeetingHistorySchema = createInsertSchema(meetingHistory).omit({
  id: true,
});

export type InsertMeetingHistory = z.infer<typeof insertMeetingHistorySchema>;
export type MeetingHistory = typeof meetingHistory.$inferSelect;

// Room schema for video conferencing (in-memory, kept for WebSocket compatibility)
export const roomSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.number(),
  hostId: z.string().optional(),
  hostUserId: z.string().optional(), // Link to authenticated user
  participants: z.array(z.string()).default([]),
  isLocked: z.boolean().default(false),
  spotlightedParticipantId: z.string().nullable().default(null),
  password: z.string().nullable().default(null),
});

export type Room = z.infer<typeof roomSchema>;

// Participant schema
export const participantSchema = z.object({
  id: z.string(),
  name: z.string(),
  roomId: z.string(),
  userId: z.string().optional(), // Link to authenticated user
  isAudioEnabled: z.boolean().default(true),
  isVideoEnabled: z.boolean().default(true),
  isScreenSharing: z.boolean().default(false),
  isHost: z.boolean().default(false),
  approvalStatus: z.enum(["pending", "approved", "denied"]).default("pending"),
  handRaised: z.boolean().default(false),
  canRecord: z.boolean().default(false),
  joinedAt: z.number(),
});

export type Participant = z.infer<typeof participantSchema>;

// Chat message schema
export const chatMessageSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  participantId: z.string(),
  participantName: z.string(),
  message: z.string(),
  timestamp: z.number(),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

// WebSocket message types
export const wsMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("join-room"),
    roomId: z.string(),
    participantId: z.string(),
    participantName: z.string(),
    userId: z.string().optional(),
  }),
  z.object({
    type: z.literal("leave-room"),
    roomId: z.string(),
    participantId: z.string(),
  }),
  z.object({
    type: z.literal("chat-message"),
    roomId: z.string(),
    message: z.string(),
    participantId: z.string(),
    participantName: z.string(),
  }),
  z.object({
    type: z.literal("signal"),
    roomId: z.string(),
    targetId: z.string(),
    signal: z.any(),
    participantId: z.string(),
  }),
  z.object({
    type: z.literal("toggle-audio"),
    roomId: z.string(),
    participantId: z.string(),
    isEnabled: z.boolean(),
  }),
  z.object({
    type: z.literal("toggle-video"),
    roomId: z.string(),
    participantId: z.string(),
    isEnabled: z.boolean(),
  }),
  z.object({
    type: z.literal("screen-share"),
    roomId: z.string(),
    participantId: z.string(),
    isSharing: z.boolean(),
  }),
  z.object({
    type: z.literal("request-join"),
    roomId: z.string(),
    participantId: z.string(),
    participantName: z.string(),
  }),
  z.object({
    type: z.literal("approve-participant"),
    roomId: z.string(),
    participantId: z.string(),
    targetParticipantId: z.string(),
  }),
  z.object({
    type: z.literal("deny-participant"),
    roomId: z.string(),
    participantId: z.string(),
    targetParticipantId: z.string(),
  }),
  z.object({
    type: z.literal("participant-denied"),
    participantId: z.string(),
  }),
  z.object({
    type: z.literal("remove-participant"),
    roomId: z.string(),
    participantId: z.string(),
    targetParticipantId: z.string(),
  }),
  z.object({
    type: z.literal("raise-hand"),
    roomId: z.string(),
    participantId: z.string(),
    isRaised: z.boolean(),
  }),
  z.object({
    type: z.literal("emoji-reaction"),
    roomId: z.string(),
    participantId: z.string(),
    participantName: z.string(),
    emoji: z.enum(["👍", "❤️", "👏", "😂"]),
  }),
  z.object({
    type: z.literal("mute-all"),
    roomId: z.string(),
    participantId: z.string(),
  }),
  z.object({
    type: z.literal("lock-room"),
    roomId: z.string(),
    participantId: z.string(),
    isLocked: z.boolean(),
  }),
  z.object({
    type: z.literal("room-locked"),
    roomId: z.string(),
    isLocked: z.boolean(),
  }),
  z.object({
    type: z.literal("transfer-host"),
    roomId: z.string(),
    participantId: z.string(),
    newHostId: z.string(),
  }),
  z.object({
    type: z.literal("host-transferred"),
    roomId: z.string(),
    newHostId: z.string(),
    newHostName: z.string(),
  }),
  z.object({
    type: z.literal("spotlight-participant"),
    roomId: z.string(),
    participantId: z.string(),
    targetParticipantId: z.string().nullable(),
  }),
  z.object({
    type: z.literal("participant-spotlighted"),
    roomId: z.string(),
    spotlightedParticipantId: z.string().nullable(),
    spotlightedParticipantName: z.string().nullable(),
  }),
  z.object({
    type: z.literal("force-disable-audio"),
    roomId: z.string(),
    participantId: z.string(),
    targetParticipantId: z.string(),
  }),
  z.object({
    type: z.literal("force-disable-video"),
    roomId: z.string(),
    participantId: z.string(),
    targetParticipantId: z.string(),
  }),
  z.object({
    type: z.literal("audio-force-disabled"),
    targetParticipantId: z.string(),
  }),
  z.object({
    type: z.literal("video-force-disabled"),
    targetParticipantId: z.string(),
  }),
  z.object({
    type: z.literal("grant-recording-permission"),
    roomId: z.string(),
    participantId: z.string(),
    targetParticipantId: z.string(),
  }),
  z.object({
    type: z.literal("recording-permission-updated"),
    targetParticipantId: z.string(),
    canRecord: z.boolean(),
  }),
  z.object({
    type: z.literal("recording-status"),
    roomId: z.string(),
    participantId: z.string(),
    isRecording: z.boolean(),
  }),
]);

export type WSMessage = z.infer<typeof wsMessageSchema>;

// Recording settings
export const recordingSettingsSchema = z.object({
  quality: z.enum(["1080p", "720p", "480p"]).default("1080p"),
  format: z.enum(["webm", "mp4"]).default("webm"),
  audioBitrate: z.number().default(128000),
  videoBitrate: z.number().default(2500000),
});

export type RecordingSettings = z.infer<typeof recordingSettingsSchema>;

// Audio enhancement settings
export const audioEnhancementSchema = z.object({
  noiseSuppressionEnabled: z.boolean().default(true),
  noiseSuppression: z.enum(["off", "low", "medium", "high"]).default("medium"),
  gainControl: z.number().min(0).max(2).default(1),
  normalization: z.boolean().default(true),
});

export type AudioEnhancement = z.infer<typeof audioEnhancementSchema>;

// Video enhancement settings
export const videoEnhancementSchema = z.object({
  brightness: z.number().min(0).max(2).default(1),
  contrast: z.number().min(0).max(2).default(1),
  saturation: z.number().min(0).max(2).default(1),
});

export type VideoEnhancement = z.infer<typeof videoEnhancementSchema>;
