import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Room schema for video conferencing
export const roomSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.number(),
  hostId: z.string().optional(),
  participants: z.array(z.string()).default([]),
  isLocked: z.boolean().default(false),
  spotlightedParticipantId: z.string().nullable().default(null),
});

export type Room = z.infer<typeof roomSchema>;

// Participant schema
export const participantSchema = z.object({
  id: z.string(),
  name: z.string(),
  roomId: z.string(),
  isAudioEnabled: z.boolean().default(true),
  isVideoEnabled: z.boolean().default(true),
  isScreenSharing: z.boolean().default(false),
  isHost: z.boolean().default(false),
  approvalStatus: z.enum(["pending", "approved", "denied"]).default("pending"),
  handRaised: z.boolean().default(false),
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
