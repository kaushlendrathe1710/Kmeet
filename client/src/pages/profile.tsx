import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { User } from "@shared/schema";

const NAME_REGEX = /^[A-Za-z][A-Za-z\s.'-]*[A-Za-z]$/;
const MOBILE_REGEX = /^[6-9]\d{9}$/;

interface MeResponse {
  user: User;
  subscription: unknown;
}

interface UpdateProfileResponse {
  user: User;
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();

  const [fullName, setFullName] = useState(user?.fullName || "");
  const [mobile, setMobile] = useState(user?.mobile || "");
  const [nameError, setNameError] = useState("");
  const [mobileError, setMobileError] = useState("");
  const [isFormInitialized, setIsFormInitialized] = useState(false);

  const { data: meData } = useQuery<MeResponse>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/auth/me");
      return (await res.json()) as MeResponse;
    },
    enabled: !!user,
  });

  const updateProfileMutation = useMutation<
    UpdateProfileResponse,
    Error,
    { fullName: string; mobile: string }
  >({
    mutationFn: async (payload) => {
      const res = await apiRequest("PUT", "/api/users/profile", payload);
      return (await res.json()) as UpdateProfileResponse;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] }),
        refreshUser(),
      ]);
      toast({
        title: "Profile updated",
        description: "Your profile was updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Update failed",
        description: error.message || "Could not update profile.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!isFormInitialized && meData?.user) {
      setFullName(meData.user.fullName || "");
      setMobile(meData.user.mobile || "");
      setIsFormInitialized(true);
    }
  }, [meData, isFormInitialized]);

  const validateName = (value: string) => {
    const normalized = value.trim();
    if (!normalized) {
      return "Name is required.";
    }
    if (normalized.length < 2) {
      return "Name must be at least 2 characters.";
    }
    if (!NAME_REGEX.test(normalized)) {
      return "Name can contain only letters, spaces, apostrophe, hyphen, and dot.";
    }
    return "";
  };

  const validateMobile = (value: string) => {
    const normalized = value.trim();
    if (!normalized) {
      return "Mobile number is required.";
    }
    if (!MOBILE_REGEX.test(normalized)) {
      return "Mobile must be 10 digits and start with 9, 8, 7, or 6.";
    }
    return "";
  };

  const runValidation = () => {
    const nextNameError = validateName(fullName);
    const nextMobileError = validateMobile(mobile);
    setNameError(nextNameError);
    setMobileError(nextMobileError);
    return !nextNameError && !nextMobileError;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!runValidation()) {
      toast({
        title: "Validation failed",
        description: "Please correct the highlighted fields.",
        variant: "destructive",
      });
      return;
    }

    await updateProfileMutation.mutateAsync({
      fullName: fullName.trim(),
      mobile: mobile.trim(),
    });
  };

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Edit Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Full name</label>
              <Input
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (nameError) setNameError(validateName(e.target.value));
                }}
                onBlur={() => setNameError(validateName(fullName))}
              />
              {nameError && (
                <p className="mt-1 text-xs text-destructive">{nameError}</p>
              )}
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-1">Mobile number</label>
              <Input
                value={mobile}
                inputMode="numeric"
                maxLength={10}
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/\D/g, "");
                  setMobile(digitsOnly);
                  if (mobileError) setMobileError(validateMobile(digitsOnly));
                }}
                onBlur={() => setMobileError(validateMobile(mobile))}
              />
              {mobileError && (
                <p className="mt-1 text-xs text-destructive">{mobileError}</p>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={updateProfileMutation.isPending || !!nameError || !!mobileError}
              >
                {updateProfileMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
