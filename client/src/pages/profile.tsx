import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();

  const [fullName, setFullName] = useState(user?.fullName || "");
  const [mobile, setMobile] = useState(user?.mobile || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const res = await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fullName, mobile }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update profile");
      }

      await refreshUser();
      toast({ title: "Profile updated", description: "Your profile was updated successfully." });
    } catch (err: any) {
      toast({ title: "Update failed", description: err?.message || "Could not update profile." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-lg mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Edit Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Full name</label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>

                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Mobile number</label>
                  <Input value={mobile} onChange={(e) => setMobile(e.target.value)} />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
