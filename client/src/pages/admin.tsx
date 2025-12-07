import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  CreditCard,
  Settings,
  LayoutDashboard,
  LogOut,
  Video,
  Shield,
  ShieldCheck,
  ChevronRight,
  Plus,
  Trash2,
  Edit,
  UserCheck,
  UserX,
  Crown,
  Loader2,
  Search,
} from "lucide-react";
import type { User, SubscriptionPlan } from "@shared/schema";

type AdminTab = "dashboard" | "users" | "plans";

export default function AdminPage() {
  const [, navigate] = useLocation();
  const { user, logout, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    email: "",
    fullName: "",
    mobile: "",
  });
  const [newPlan, setNewPlan] = useState({
    name: "",
    description: "",
    price: 0,
    durationDays: 30,
    maxRecordingMinutes: 60,
    maxParticipants: 10,
    features: ["meetings", "chat"],
  });

  const { data: usersData, isLoading: usersLoading } = useQuery<{ users: User[] }>({
    queryKey: ["/api/admin/users"],
  });

  const { data: plansData, isLoading: plansLoading } = useQuery<{ plans: SubscriptionPlan[] }>({
    queryKey: ["/api/admin/plans"],
  });

  const { data: statsData } = useQuery<{ totalUsers: number; totalPlans: number }>({
    queryKey: ["/api/admin/stats"],
  });

  const toggleUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("PUT", `/api/admin/users/${userId}/toggle-active`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User status updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return apiRequest("PUT", `/api/admin/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User role updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("DELETE", `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createPlanMutation = useMutation({
    mutationFn: async (plan: typeof newPlan) => {
      return apiRequest("POST", "/api/admin/plans", plan);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      setShowCreatePlan(false);
      setNewPlan({
        name: "",
        description: "",
        price: 0,
        durationDays: 30,
        maxRecordingMinutes: 60,
        maxParticipants: 10,
        features: ["meetings", "chat"],
      });
      toast({ title: "Plan created" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      return apiRequest("DELETE", `/api/admin/plans/${planId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      toast({ title: "Plan deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createAdminMutation = useMutation({
    mutationFn: async (admin: typeof newAdmin) => {
      return apiRequest("POST", "/api/admin/create-admin", admin);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setShowCreateAdmin(false);
      setNewAdmin({ email: "", fullName: "", mobile: "" });
      toast({ title: "Success", description: data.message || "Admin created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const users = usersData?.users || [];
  const plans = plansData?.plans || [];
  
  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.fullName && u.fullName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "superadmin":
        return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20"><Crown className="h-3 w-3 mr-1" />Super Admin</Badge>;
      case "admin":
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20"><ShieldCheck className="h-3 w-3 mr-1" />Admin</Badge>;
      default:
        return <Badge variant="secondary">User</Badge>;
    }
  };

  const SUPER_ADMIN_EMAIL = "kaushlendra.k12@fms.edu";

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Video className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="font-bold">PodcastMeet</h1>
              <p className="text-xs text-muted-foreground">Admin Panel</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <Button
            variant={activeTab === "dashboard" ? "secondary" : "ghost"}
            className="w-full justify-start"
            onClick={() => setActiveTab("dashboard")}
            data-testid="nav-dashboard"
          >
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          <Button
            variant={activeTab === "users" ? "secondary" : "ghost"}
            className="w-full justify-start"
            onClick={() => setActiveTab("users")}
            data-testid="nav-users"
          >
            <Users className="h-4 w-4 mr-2" />
            Users
          </Button>
          <Button
            variant={activeTab === "plans" ? "secondary" : "ghost"}
            className="w-full justify-start"
            onClick={() => setActiveTab("plans")}
            data-testid="nav-plans"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Subscription Plans
          </Button>
        </nav>

        <Separator />

        <div className="p-4 space-y-2">
          <Button variant="outline" className="w-full justify-start" asChild>
            <Link href="/dashboard">
              <ChevronRight className="h-4 w-4 mr-2" />
              User Dashboard
            </Link>
          </Button>
          <Button variant="ghost" className="w-full justify-start text-destructive" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>

        <div className="p-4 border-t">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                {getInitials(user?.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.fullName || "Admin"}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <header className="border-b p-4 bg-background/95 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold capitalize">{activeTab}</h2>
              <p className="text-sm text-muted-foreground">
                {activeTab === "dashboard" && "Overview and quick stats"}
                {activeTab === "users" && "Manage users and permissions"}
                {activeTab === "plans" && "Manage subscription plans"}
              </p>
            </div>
            {isSuperAdmin && (
              <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                <Crown className="h-3 w-3 mr-1" />
                Super Admin
              </Badge>
            )}
          </div>
        </header>

        <ScrollArea className="flex-1 p-6">
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total Users</CardDescription>
                    <CardTitle className="text-3xl">{statsData?.totalUsers || 0}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Active Plans</CardDescription>
                    <CardTitle className="text-3xl">{statsData?.totalPlans || 0}</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Admins</CardDescription>
                    <CardTitle className="text-3xl">
                      {users.filter((u) => u.role === "admin" || u.role === "superadmin").length}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Active Users</CardDescription>
                    <CardTitle className="text-3xl">{users.filter((u) => u.isActive).length}</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {users.slice(0, 5).map((u) => (
                      <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">{getInitials(u.fullName)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{u.fullName || u.email}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                        {getRoleBadge(u.role)}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "users" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-users"
                  />
                </div>
                
                {isSuperAdmin && (
                  <Dialog open={showCreateAdmin} onOpenChange={setShowCreateAdmin}>
                    <DialogTrigger asChild>
                      <Button data-testid="button-create-admin">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Admin
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Admin</DialogTitle>
                        <DialogDescription>
                          Add a new administrator to the platform. If the email already exists, that user will be promoted to admin.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="admin-email">Email *</Label>
                          <Input
                            id="admin-email"
                            type="email"
                            placeholder="admin@example.com"
                            value={newAdmin.email}
                            onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                            data-testid="input-admin-email"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="admin-name">Full Name *</Label>
                          <Input
                            id="admin-name"
                            placeholder="John Doe"
                            value={newAdmin.fullName}
                            onChange={(e) => setNewAdmin({ ...newAdmin, fullName: e.target.value })}
                            data-testid="input-admin-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="admin-mobile">Mobile (Optional)</Label>
                          <Input
                            id="admin-mobile"
                            type="tel"
                            placeholder="+1234567890"
                            value={newAdmin.mobile}
                            onChange={(e) => setNewAdmin({ ...newAdmin, mobile: e.target.value })}
                            data-testid="input-admin-mobile"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setShowCreateAdmin(false)}
                          data-testid="button-cancel-create-admin"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => createAdminMutation.mutate(newAdmin)}
                          disabled={!newAdmin.email || !newAdmin.fullName || createAdminMutation.isPending}
                          data-testid="button-submit-create-admin"
                        >
                          {createAdminMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="h-4 w-4 mr-2" />
                              Create Admin
                            </>
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              {usersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {filteredUsers.map((u) => {
                        const isSuperAdminUser = u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
                        
                        return (
                          <div key={u.id} className="flex items-center justify-between p-4" data-testid={`user-row-${u.id}`}>
                            <div className="flex items-center gap-4">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback>{getInitials(u.fullName)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{u.fullName || "No name"}</p>
                                  {getRoleBadge(u.role)}
                                  {!u.isActive && (
                                    <Badge variant="outline" className="text-destructive border-destructive/30">
                                      Inactive
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">{u.email}</p>
                                <p className="text-xs text-muted-foreground">
                                  Joined {new Date(u.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {isSuperAdmin && !isSuperAdminUser && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateRoleMutation.mutate({
                                      userId: u.id,
                                      role: u.role === "admin" ? "user" : "admin",
                                    })}
                                    data-testid={`button-toggle-role-${u.id}`}
                                  >
                                    {u.role === "admin" ? (
                                      <>
                                        <UserX className="h-4 w-4 mr-1" />
                                        Remove Admin
                                      </>
                                    ) : (
                                      <>
                                        <ShieldCheck className="h-4 w-4 mr-1" />
                                        Make Admin
                                      </>
                                    )}
                                  </Button>
                                </>
                              )}

                              {!isSuperAdminUser && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => toggleUserMutation.mutate(u.id)}
                                    data-testid={`button-toggle-active-${u.id}`}
                                  >
                                    {u.isActive ? (
                                      <>
                                        <UserX className="h-4 w-4 mr-1" />
                                        Deactivate
                                      </>
                                    ) : (
                                      <>
                                        <UserCheck className="h-4 w-4 mr-1" />
                                        Activate
                                      </>
                                    )}
                                  </Button>
                                  
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                      if (confirm("Are you sure you want to delete this user?")) {
                                        deleteUserMutation.mutate(u.id);
                                      }
                                    }}
                                    data-testid={`button-delete-${u.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}

                              {isSuperAdminUser && (
                                <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                                  Protected
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {activeTab === "plans" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Subscription Plans</h3>
                <Dialog open={showCreatePlan} onOpenChange={setShowCreatePlan}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-create-plan">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Plan
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Subscription Plan</DialogTitle>
                      <DialogDescription>Create a new subscription plan for users</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Plan Name</Label>
                        <Input
                          value={newPlan.name}
                          onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                          placeholder="Pro Plan"
                          data-testid="input-plan-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input
                          value={newPlan.description}
                          onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                          placeholder="Best for professionals"
                          data-testid="input-plan-description"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Price (cents)</Label>
                          <Input
                            type="number"
                            value={newPlan.price}
                            onChange={(e) => setNewPlan({ ...newPlan, price: parseInt(e.target.value) || 0 })}
                            data-testid="input-plan-price"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Duration (days)</Label>
                          <Input
                            type="number"
                            value={newPlan.durationDays}
                            onChange={(e) => setNewPlan({ ...newPlan, durationDays: parseInt(e.target.value) || 30 })}
                            data-testid="input-plan-duration"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Recording Minutes</Label>
                          <Input
                            type="number"
                            value={newPlan.maxRecordingMinutes}
                            onChange={(e) => setNewPlan({ ...newPlan, maxRecordingMinutes: parseInt(e.target.value) || 0 })}
                            data-testid="input-plan-recording"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Max Participants</Label>
                          <Input
                            type="number"
                            value={newPlan.maxParticipants}
                            onChange={(e) => setNewPlan({ ...newPlan, maxParticipants: parseInt(e.target.value) || 10 })}
                            data-testid="input-plan-participants"
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowCreatePlan(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={() => createPlanMutation.mutate(newPlan)}
                        disabled={createPlanMutation.isPending || !newPlan.name}
                        data-testid="button-submit-plan"
                      >
                        {createPlanMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Create Plan"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {plansLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : plans.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No subscription plans yet. Create your first plan!</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {plans.map((plan) => (
                    <Card key={plan.id} data-testid={`plan-card-${plan.id}`}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{plan.name}</CardTitle>
                          <Badge variant={plan.isActive ? "default" : "secondary"}>
                            {plan.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <CardDescription>{plan.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="text-3xl font-bold">
                          ${(plan.price / 100).toFixed(2)}
                          <span className="text-sm font-normal text-muted-foreground">/{plan.durationDays} days</span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Recording Minutes</span>
                            <span>{plan.maxRecordingMinutes}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Max Participants</span>
                            <span>{plan.maxParticipants}</span>
                          </div>
                        </div>
                        <Separator />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this plan?")) {
                              deletePlanMutation.mutate(plan.id);
                            }
                          }}
                          data-testid={`button-delete-plan-${plan.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Plan
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </main>
    </div>
  );
}
