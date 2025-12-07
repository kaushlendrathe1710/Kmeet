import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, ArrowRight, KeyRound, User, Phone, Loader2, Video } from "lucide-react";

type Step = "email" | "otp" | "registration";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { requestOtp, verifyOtp, completeRegistration, isAuthenticated, isLoading: authLoading, isAdmin } = useAuth();
  const { toast } = useToast();
  
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      if (isAdmin) {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    }
  }, [isAuthenticated, authLoading, isAdmin, navigate]);

  // Countdown timer for resend OTP
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({ title: "Please enter your email", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const result = await requestOtp(email);
    setIsLoading(false);

    if (result.success) {
      toast({ title: "OTP Sent", description: "Check your email for the login code" });
      setStep("otp");
      setCountdown(60);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!otp || otp.length !== 6) {
      toast({ title: "Please enter the 6-digit OTP", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const result = await verifyOtp(email, otp);
    setIsLoading(false);

    if (result.success) {
      if (result.isNewUser) {
        setStep("registration");
      } else {
        toast({ title: "Welcome back!" });
        // Navigation is handled by useEffect
      }
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
  };

  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fullName || fullName.length < 2) {
      toast({ title: "Please enter your full name", variant: "destructive" });
      return;
    }

    if (!mobile || mobile.length < 10) {
      toast({ title: "Please enter a valid mobile number", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const result = await completeRegistration(fullName, mobile);
    setIsLoading(false);

    if (result.success) {
      toast({ title: "Welcome to PodcastMeet!" });
      // Navigation is handled by useEffect
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    
    setIsLoading(true);
    const result = await requestOtp(email);
    setIsLoading(false);

    if (result.success) {
      toast({ title: "OTP Resent", description: "Check your email for the new code" });
      setCountdown(60);
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/30">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <Video className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">PodcastMeet</h1>
          <p className="text-muted-foreground">Professional Video Conferencing</p>
        </div>

        <Card className="border-border/50 shadow-lg">
          {step === "email" && (
            <>
              <CardHeader>
                <CardTitle className="text-xl">Sign in</CardTitle>
                <CardDescription>
                  Enter your email to receive a one-time login code
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleRequestOtp}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        className="pl-10"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoading}
                        data-testid="input-email"
                        autoFocus
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading}
                    data-testid="button-request-otp"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Continue <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </CardFooter>
              </form>
            </>
          )}

          {step === "otp" && (
            <>
              <CardHeader>
                <CardTitle className="text-xl">Enter Code</CardTitle>
                <CardDescription>
                  We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleVerifyOtp}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="otp">One-Time Password</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="otp"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        placeholder="000000"
                        className="pl-10 text-center tracking-[0.5em] font-mono text-lg"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        disabled={isLoading}
                        data-testid="input-otp"
                        autoFocus
                      />
                    </div>
                  </div>
                  
                  <div className="text-center">
                    {countdown > 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Resend code in {countdown}s
                      </p>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleResendOtp}
                        disabled={isLoading}
                        data-testid="button-resend-otp"
                        className="text-primary"
                      >
                        Didn't receive code? Resend
                      </Button>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading || otp.length !== 6}
                    data-testid="button-verify-otp"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Verify <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStep("email");
                      setOtp("");
                    }}
                    disabled={isLoading}
                    data-testid="button-back-to-email"
                  >
                    Use different email
                  </Button>
                </CardFooter>
              </form>
            </>
          )}

          {step === "registration" && (
            <>
              <CardHeader>
                <CardTitle className="text-xl">Complete Your Profile</CardTitle>
                <CardDescription>
                  Just a few more details to get started
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleCompleteRegistration}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="John Doe"
                        className="pl-10"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        disabled={isLoading}
                        data-testid="input-fullname"
                        autoFocus
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="mobile">Mobile Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="mobile"
                        type="tel"
                        placeholder="+1 234 567 8900"
                        className="pl-10"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        disabled={isLoading}
                        data-testid="input-mobile"
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading}
                    data-testid="button-complete-registration"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Get Started <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </CardFooter>
              </form>
            </>
          )}
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
