import type { Express, Request, Response } from "express";
import cookieParser from "cookie-parser";
import { 
  requestOtp, 
  verifyOtp, 
  completeRegistration, 
  logout,
  authenticateSession,
  requireAuth,
  requireAdmin,
  requireSuperAdmin,
  SESSION_COOKIE_NAME,
  canRecord,
} from "./auth";
import { storage, SUPER_ADMIN_EMAIL } from "./storage";
import { initializeEmailTransporter } from "./email";
import { initializeS3, getUploadPresignedUrl, getDownloadPresignedUrl, deleteRecordingFromS3, isS3Configured } from "./s3";
import { z } from "zod";

// Validation schemas
const requestOtpSchema = z.object({
  email: z.string().email(),
});

const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

const completeRegistrationSchema = z.object({
  fullName: z.string().min(2).max(100),
  mobile: z.string().min(10).max(15),
});

const createSubscriptionPlanSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().int().min(0),
  durationDays: z.number().int().min(1),
  features: z.array(z.string()),
  maxRecordingMinutes: z.number().int().min(0),
  maxParticipants: z.number().int().min(1),
});

const assignSubscriptionSchema = z.object({
  userId: z.string(),
  planId: z.string(),
});

const createRecordingSchema = z.object({
  roomId: z.string(),
  roomName: z.string().optional(),
  fileName: z.string(),
  fileSize: z.number().int().min(0),
  duration: z.number().int().min(0),
  format: z.string().default("webm"),
});

export function setupAuthRoutes(app: Express): void {
  // Initialize services
  initializeEmailTransporter();
  initializeS3();
  
  // Cookie parser middleware
  app.use(cookieParser());
  
  // Session authentication middleware (applies to all routes)
  app.use(authenticateSession);

  // ==================== AUTH ROUTES ====================

  // Request OTP
  app.post("/api/auth/request-otp", async (req: Request, res: Response) => {
    try {
      const { email } = requestOtpSchema.parse(req.body);
      const result = await requestOtp(email);
      
      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }
      
      res.json({ message: result.message });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid email format" });
      }
      console.error("Request OTP error:", error);
      res.status(500).json({ error: "Failed to request OTP" });
    }
  });

  // Verify OTP
  app.post("/api/auth/verify-otp", async (req: Request, res: Response) => {
    try {
      const { email, otp } = verifyOtpSchema.parse(req.body);
      const userAgent = req.headers["user-agent"];
      const ipAddress = req.ip || req.connection.remoteAddress;
      
      const result = await verifyOtp(email, otp, userAgent, ipAddress);
      
      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }
      
      // Set session cookie (30 days)
      res.cookie(SESSION_COOKIE_NAME, result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
      
      res.json({
        message: result.message,
        user: result.user,
        isNewUser: result.isNewUser,
        token: result.token,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid email or OTP format" });
      }
      console.error("Verify OTP error:", error);
      res.status(500).json({ error: "Failed to verify OTP" });
    }
  });

  // Complete registration (for new users)
  app.post("/api/auth/complete-registration", requireAuth, async (req: Request, res: Response) => {
    try {
      const { fullName, mobile } = completeRegistrationSchema.parse(req.body);
      const result = await completeRegistration(req.user!.id, fullName, mobile);
      
      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }
      
      res.json({ message: result.message, user: result.user });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Complete registration error:", error);
      res.status(500).json({ error: "Failed to complete registration" });
    }
  });

  // Get current user
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    // Get subscription info
    const subscription = await storage.getUserSubscription(req.user.id);
    let plan = null;
    if (subscription) {
      plan = await storage.getSubscriptionPlan(subscription.planId);
    }
    
    res.json({ 
      user: req.user,
      subscription: subscription ? {
        ...subscription,
        plan,
      } : null,
    });
  });

  // Logout
  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    const token = req.cookies?.[SESSION_COOKIE_NAME] || 
                  req.headers.authorization?.replace("Bearer ", "");
    
    if (token) {
      await logout(token);
    }
    
    res.clearCookie(SESSION_COOKIE_NAME);
    res.json({ message: "Logged out successfully" });
  });

  // ==================== USER ROUTES ====================

  // Update user profile
  app.put("/api/users/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const { fullName, mobile } = req.body;
      const updates: any = {};
      
      if (fullName) updates.fullName = fullName;
      if (mobile) updates.mobile = mobile;
      
      const user = await storage.updateUser(req.user!.id, updates);
      res.json({ user });
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Get user's meeting history
  app.get("/api/users/meetings", requireAuth, async (req: Request, res: Response) => {
    try {
      const history = await storage.getUserMeetingHistory(req.user!.id);
      res.json({ meetings: history });
    } catch (error) {
      console.error("Get meeting history error:", error);
      res.status(500).json({ error: "Failed to get meeting history" });
    }
  });

  // ==================== SUBSCRIPTION ROUTES ====================

  // Get all subscription plans
  app.get("/api/subscriptions/plans", async (req: Request, res: Response) => {
    try {
      const plans = await storage.getAllSubscriptionPlans();
      res.json({ plans: plans.filter(p => p.isActive) });
    } catch (error) {
      console.error("Get plans error:", error);
      res.status(500).json({ error: "Failed to get subscription plans" });
    }
  });

  // Get user's current subscription
  app.get("/api/subscriptions/current", requireAuth, async (req: Request, res: Response) => {
    try {
      const subscription = await storage.getUserSubscription(req.user!.id);
      
      if (!subscription) {
        return res.json({ subscription: null });
      }
      
      const plan = await storage.getSubscriptionPlan(subscription.planId);
      res.json({ 
        subscription: {
          ...subscription,
          plan,
        }
      });
    } catch (error) {
      console.error("Get subscription error:", error);
      res.status(500).json({ error: "Failed to get subscription" });
    }
  });

  // Check recording access
  app.get("/api/subscriptions/can-record", requireAuth, async (req: Request, res: Response) => {
    try {
      const result = await canRecord(req.user!.id);
      res.json(result);
    } catch (error) {
      console.error("Check recording access error:", error);
      res.status(500).json({ error: "Failed to check recording access" });
    }
  });

  // ==================== RECORDING ROUTES ====================

  // Get upload URL for recording
  app.post("/api/recordings/upload-url", requireAuth, async (req: Request, res: Response) => {
    try {
      // Check if user can record
      const recordingAccess = await canRecord(req.user!.id);
      if (!recordingAccess.allowed) {
        return res.status(403).json({ error: recordingAccess.reason });
      }
      
      if (!isS3Configured()) {
        return res.status(503).json({ error: "Recording storage is not configured" });
      }
      
      const { fileName, contentType } = req.body;
      const result = await getUploadPresignedUrl(req.user!.id, fileName, contentType);
      
      if (!result) {
        return res.status(500).json({ error: "Failed to generate upload URL" });
      }
      
      res.json(result);
    } catch (error) {
      console.error("Get upload URL error:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Save recording metadata after upload
  app.post("/api/recordings", requireAuth, async (req: Request, res: Response) => {
    try {
      const { roomId, roomName, fileName, fileSize, duration, format } = createRecordingSchema.parse(req.body);
      const { s3Key, s3Url } = req.body;
      
      if (!s3Key || !s3Url) {
        return res.status(400).json({ error: "Missing S3 key or URL" });
      }
      
      const recording = await storage.createRecording({
        userId: req.user!.id,
        roomId,
        roomName,
        fileName,
        s3Key,
        s3Url,
        fileSize,
        duration,
        format,
      });
      
      // Update subscription recording minutes used
      const subscription = await storage.getUserSubscription(req.user!.id);
      if (subscription) {
        const minutesUsed = Math.ceil(duration / 60);
        await storage.updateSubscription(subscription.id, {
          recordingMinutesUsed: subscription.recordingMinutesUsed + minutesUsed,
        });
      }
      
      res.json({ recording });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Save recording error:", error);
      res.status(500).json({ error: "Failed to save recording" });
    }
  });

  // Get user's recordings
  app.get("/api/recordings", requireAuth, async (req: Request, res: Response) => {
    try {
      const recordings = await storage.getUserRecordings(req.user!.id);
      res.json({ recordings });
    } catch (error) {
      console.error("Get recordings error:", error);
      res.status(500).json({ error: "Failed to get recordings" });
    }
  });

  // Get recording download URL
  app.get("/api/recordings/:id/download", requireAuth, async (req: Request, res: Response) => {
    try {
      const recording = await storage.getRecording(req.params.id);
      
      if (!recording) {
        return res.status(404).json({ error: "Recording not found" });
      }
      
      if (recording.userId !== req.user!.id && req.user!.role !== "admin" && req.user!.role !== "superadmin") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const url = await getDownloadPresignedUrl(recording.s3Key);
      
      if (!url) {
        return res.status(500).json({ error: "Failed to generate download URL" });
      }
      
      res.json({ url });
    } catch (error) {
      console.error("Get download URL error:", error);
      res.status(500).json({ error: "Failed to generate download URL" });
    }
  });

  // Delete recording
  app.delete("/api/recordings/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const recording = await storage.getRecording(req.params.id);
      
      if (!recording) {
        return res.status(404).json({ error: "Recording not found" });
      }
      
      if (recording.userId !== req.user!.id && req.user!.role !== "admin" && req.user!.role !== "superadmin") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Delete from S3
      await deleteRecordingFromS3(recording.s3Key);
      
      // Delete from database
      await storage.deleteRecording(recording.id);
      
      res.json({ message: "Recording deleted" });
    } catch (error) {
      console.error("Delete recording error:", error);
      res.status(500).json({ error: "Failed to delete recording" });
    }
  });

  // ==================== ADMIN ROUTES ====================

  // Get all users (admin only)
  app.get("/api/admin/users", requireAdmin, async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      res.json({ users });
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  // Get user stats (admin only)
  app.get("/api/admin/stats", requireAdmin, async (req: Request, res: Response) => {
    try {
      const usersCount = await storage.getUsersCount();
      const plans = await storage.getAllSubscriptionPlans();
      
      res.json({
        totalUsers: usersCount,
        totalPlans: plans.length,
      });
    } catch (error) {
      console.error("Get stats error:", error);
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  // Update user role (super admin only)
  app.put("/api/admin/users/:id/role", requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { role } = req.body;
      
      if (!["user", "admin"].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      
      const user = await storage.getUser(req.params.id);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Cannot change super admin's role
      if (user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
        return res.status(403).json({ error: "Cannot modify super admin" });
      }
      
      const updatedUser = await storage.updateUser(req.params.id, { role });
      res.json({ user: updatedUser });
    } catch (error) {
      console.error("Update user role error:", error);
      res.status(500).json({ error: "Failed to update user role" });
    }
  });

  // Delete user (admin only, can't delete super admin)
  app.delete("/api/admin/users/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.params.id);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Cannot delete self
      if (user.id === req.user!.id) {
        return res.status(403).json({ error: "Cannot delete yourself" });
      }
      
      await storage.deleteUser(req.params.id);
      res.json({ message: "User deleted" });
    } catch (error: any) {
      if (error.message === "Cannot delete super admin account") {
        return res.status(403).json({ error: error.message });
      }
      console.error("Delete user error:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Toggle user active status (admin only)
  app.put("/api/admin/users/:id/toggle-active", requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.params.id);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      if (user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
        return res.status(403).json({ error: "Cannot modify super admin" });
      }
      
      const updatedUser = await storage.updateUser(req.params.id, { isActive: !user.isActive });
      res.json({ user: updatedUser });
    } catch (error) {
      console.error("Toggle user active error:", error);
      res.status(500).json({ error: "Failed to toggle user status" });
    }
  });

  // Create subscription plan (admin only)
  app.post("/api/admin/plans", requireAdmin, async (req: Request, res: Response) => {
    try {
      const data = createSubscriptionPlanSchema.parse(req.body);
      const plan = await storage.createSubscriptionPlan({
        ...data,
        isActive: true,
      });
      res.json({ plan });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Create plan error:", error);
      res.status(500).json({ error: "Failed to create plan" });
    }
  });

  // Get all subscription plans (admin only)
  app.get("/api/admin/plans", requireAdmin, async (req: Request, res: Response) => {
    try {
      const plans = await storage.getAllSubscriptionPlans();
      res.json({ plans });
    } catch (error) {
      console.error("Get plans error:", error);
      res.status(500).json({ error: "Failed to get plans" });
    }
  });

  // Update subscription plan (admin only)
  app.put("/api/admin/plans/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const plan = await storage.updateSubscriptionPlan(req.params.id, req.body);
      
      if (!plan) {
        return res.status(404).json({ error: "Plan not found" });
      }
      
      res.json({ plan });
    } catch (error) {
      console.error("Update plan error:", error);
      res.status(500).json({ error: "Failed to update plan" });
    }
  });

  // Delete subscription plan (admin only)
  app.delete("/api/admin/plans/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteSubscriptionPlan(req.params.id);
      res.json({ message: "Plan deleted" });
    } catch (error) {
      console.error("Delete plan error:", error);
      res.status(500).json({ error: "Failed to delete plan" });
    }
  });

  // Assign subscription to user (admin only)
  app.post("/api/admin/subscriptions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId, planId } = assignSubscriptionSchema.parse(req.body);
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const plan = await storage.getSubscriptionPlan(planId);
      if (!plan) {
        return res.status(404).json({ error: "Plan not found" });
      }
      
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + plan.durationDays);
      
      const subscription = await storage.createSubscription({
        userId,
        planId,
        status: "active",
        startDate: new Date(),
        endDate,
        recordingMinutesUsed: 0,
      });
      
      res.json({ subscription });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid input", details: error.errors });
      }
      console.error("Assign subscription error:", error);
      res.status(500).json({ error: "Failed to assign subscription" });
    }
  });

  console.log("Auth routes initialized");
}
