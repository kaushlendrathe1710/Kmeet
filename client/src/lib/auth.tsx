import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { apiRequest, queryClient } from "./queryClient";
import type { User, SubscriptionPlan, Subscription as BaseSubscription } from "@shared/schema";

interface SubscriptionWithPlan extends BaseSubscription {
  plan: SubscriptionPlan | null;
}

interface AuthContextType {
  user: User | null;
  subscription: SubscriptionWithPlan | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  requestOtp: (email: string) => Promise<{ success: boolean; message: string }>;
  verifyOtp: (email: string, otp: string) => Promise<{ success: boolean; message: string; isNewUser?: boolean }>;
  completeRegistration: (fullName: string, mobile: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionWithPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      });
      
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setSubscription(data.subscription);
      } else {
        setUser(null);
        setSubscription(null);
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
      setUser(null);
      setSubscription(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const requestOtp = async (email: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await apiRequest("POST", "/api/auth/request-otp", { email });
      const data = await response.json();
      return { success: true, message: data.message || "OTP sent to your email" };
    } catch (error: any) {
      return { success: false, message: error.message || "Failed to send OTP" };
    }
  };

  const verifyOtp = async (email: string, otp: string): Promise<{ success: boolean; message: string; isNewUser?: boolean }> => {
    try {
      const response = await apiRequest("POST", "/api/auth/verify-otp", { email, otp });
      const data = await response.json();
      
      setUser(data.user);
      await refreshUser();
      
      return { 
        success: true, 
        message: data.message || "Login successful",
        isNewUser: data.isNewUser,
      };
    } catch (error: any) {
      return { success: false, message: error.message || "Invalid OTP" };
    }
  };

  const completeRegistration = async (fullName: string, mobile: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await apiRequest("POST", "/api/auth/complete-registration", { fullName, mobile });
      const data = await response.json();
      
      setUser(data.user);
      
      return { success: true, message: data.message || "Registration complete" };
    } catch (error: any) {
      return { success: false, message: error.message || "Failed to complete registration" };
    }
  };

  const logout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch (error) {
      console.error("Logout error:", error);
    }
    
    setUser(null);
    setSubscription(null);
    queryClient.clear();
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const isSuperAdmin = user?.role === "superadmin";

  return (
    <AuthContext.Provider
      value={{
        user,
        subscription,
        isLoading,
        isAuthenticated,
        isAdmin,
        isSuperAdmin,
        requestOtp,
        verifyOtp,
        completeRegistration,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  
  return context;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    window.location.href = "/login";
    return null;
  }
  
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, isLoading, isAuthenticated } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    window.location.href = "/login";
    return null;
  }
  
  if (!isAdmin) {
    window.location.href = "/dashboard";
    return null;
  }
  
  return <>{children}</>;
}
