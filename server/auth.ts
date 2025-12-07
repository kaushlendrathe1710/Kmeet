import type { Request, Response, NextFunction } from "express";
import { storage, SUPER_ADMIN_EMAIL } from "./storage";
import { generateOtp, sendOtpEmail } from "./email";
import { randomBytes } from "crypto";
import type { User } from "@shared/schema";

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
      session?: {
        id: string;
        token: string;
      };
    }
  }
}

// Constants
const OTP_EXPIRY_MINUTES = 10;
const SESSION_EXPIRY_DAYS = 30;
const SESSION_COOKIE_NAME = "podcastmeet_session";

// Generate a secure session token
function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

// Request OTP for email
export async function requestOtp(email: string): Promise<{ success: boolean; message: string }> {
  if (!email || !isValidEmail(email)) {
    return { success: false, message: "Please provide a valid email address" };
  }

  const normalizedEmail = email.toLowerCase().trim();
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  try {
    // Store OTP in database
    await storage.createOtpToken({
      email: normalizedEmail,
      otp,
      expiresAt,
      isUsed: false,
    });

    // Send OTP via email
    const sent = await sendOtpEmail(normalizedEmail, otp);
    
    if (!sent) {
      // For development, log the OTP if email fails
      console.log(`[DEV] OTP for ${normalizedEmail}: ${otp}`);
      return { success: true, message: "OTP generated (check console in dev mode)" };
    }

    return { success: true, message: "OTP sent to your email" };
  } catch (error) {
    console.error("Failed to request OTP:", error);
    return { success: false, message: "Failed to send OTP. Please try again." };
  }
}

// Verify OTP and create session
export async function verifyOtp(
  email: string, 
  otp: string,
  userAgent?: string,
  ipAddress?: string
): Promise<{ 
  success: boolean; 
  message: string; 
  token?: string;
  user?: User;
  isNewUser?: boolean;
}> {
  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Find valid OTP
    const otpToken = await storage.getValidOtp(normalizedEmail, otp);
    
    if (!otpToken) {
      return { success: false, message: "Invalid or expired OTP" };
    }

    // Mark OTP as used
    await storage.markOtpAsUsed(otpToken.id);

    // Check if user exists
    let user = await storage.getUserByEmail(normalizedEmail);
    let isNewUser = false;

    if (!user) {
      // Create new user - check if this is the super admin
      const isSuperAdmin = normalizedEmail === SUPER_ADMIN_EMAIL.toLowerCase();
      
      user = await storage.createUser({
        email: normalizedEmail,
        role: isSuperAdmin ? "superadmin" : "user",
        isActive: true,
      });
      isNewUser = true;
    }

    // Update last login
    await storage.updateUser(user.id, { lastLoginAt: new Date() });

    // Create session
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await storage.createSession({
      userId: user.id,
      token,
      expiresAt,
      userAgent,
      ipAddress,
    });

    return {
      success: true,
      message: "Login successful",
      token,
      user,
      isNewUser: isNewUser || !user.fullName, // Consider new if no fullName set
    };
  } catch (error) {
    console.error("Failed to verify OTP:", error);
    return { success: false, message: "Verification failed. Please try again." };
  }
}

// Complete registration for new users
export async function completeRegistration(
  userId: string,
  fullName: string,
  mobile: string
): Promise<{ success: boolean; message: string; user?: User }> {
  try {
    const user = await storage.updateUser(userId, { fullName, mobile });
    
    if (!user) {
      return { success: false, message: "User not found" };
    }

    return { success: true, message: "Registration completed", user };
  } catch (error) {
    console.error("Failed to complete registration:", error);
    return { success: false, message: "Failed to complete registration" };
  }
}

// Logout - delete session
export async function logout(token: string): Promise<boolean> {
  try {
    const session = await storage.getSessionByToken(token);
    if (session) {
      await storage.deleteSession(session.id);
    }
    return true;
  } catch (error) {
    console.error("Logout error:", error);
    return false;
  }
}

// Middleware to authenticate requests
export async function authenticateSession(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE_NAME] || 
                req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    req.user = undefined;
    return next();
  }

  try {
    const session = await storage.getSessionByToken(token);
    
    if (!session) {
      req.user = undefined;
      return next();
    }

    const user = await storage.getUser(session.userId);
    
    if (!user || !user.isActive) {
      req.user = undefined;
      return next();
    }

    req.user = user;
    req.session = { id: session.id, token: session.token };
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    req.user = undefined;
    next();
  }
}

// Middleware to require authentication
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

// Middleware to require admin role
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  
  if (req.user.role !== "admin" && req.user.role !== "superadmin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  
  next();
}

// Middleware to require super admin role
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  
  if (req.user.role !== "superadmin") {
    res.status(403).json({ error: "Super admin access required" });
    return;
  }
  
  next();
}

// Helper to validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Helper to check if user has active subscription with feature
export async function hasFeatureAccess(userId: string, feature: string): Promise<boolean> {
  const subscription = await storage.getUserSubscription(userId);
  
  if (!subscription) {
    return false;
  }
  
  if (subscription.status !== "active" && subscription.status !== "trial") {
    return false;
  }
  
  if (new Date(subscription.endDate) < new Date()) {
    return false;
  }
  
  const plan = await storage.getSubscriptionPlan(subscription.planId);
  
  if (!plan) {
    return false;
  }
  
  const features = plan.features as string[];
  return features.includes(feature);
}

// Check if user can record
export async function canRecord(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const subscription = await storage.getUserSubscription(userId);
  
  if (!subscription) {
    return { allowed: false, reason: "No active subscription. Please subscribe to record meetings." };
  }
  
  if (subscription.status !== "active" && subscription.status !== "trial") {
    return { allowed: false, reason: "Your subscription is not active." };
  }
  
  if (new Date(subscription.endDate) < new Date()) {
    return { allowed: false, reason: "Your subscription has expired." };
  }
  
  const plan = await storage.getSubscriptionPlan(subscription.planId);
  
  if (!plan) {
    return { allowed: false, reason: "Subscription plan not found." };
  }
  
  const features = plan.features as string[];
  if (!features.includes("recording")) {
    return { allowed: false, reason: "Your plan doesn't include recording. Please upgrade." };
  }
  
  // Check recording minutes limit
  if (subscription.recordingMinutesUsed >= plan.maxRecordingMinutes) {
    return { allowed: false, reason: "You've used all your recording minutes. Please upgrade." };
  }
  
  return { allowed: true };
}

export { SESSION_COOKIE_NAME };
