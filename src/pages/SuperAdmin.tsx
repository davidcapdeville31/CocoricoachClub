import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/sonner";
import {
  Shield, ArrowLeft, LayoutDashboard, Users, Building2, CreditCard, Video, Bell, Settings, Lock, Clock, Dumbbell, Archive, ClipboardList, CircleDot, Mail, ChevronDown,
} from "lucide-react";

// Import tab components
import { SuperAdminDashboard } from "@/components/super-admin/SuperAdminDashboard";
import { SuperAdminClients } from "@/components/super-admin/SuperAdminClients";
import { SuperAdminClubs } from "@/components/super-admin/SuperAdminClubs";
import { SuperAdminUsers } from "@/components/super-admin/SuperAdminUsers";
import { SuperAdminSubscriptions } from "@/components/super-admin/SuperAdminSubscriptions";
import { SuperAdminPayments } from "@/components/super-admin/SuperAdminPayments";
import { SuperAdminVideos } from "@/components/super-admin/SuperAdminVideos";
import { SuperAdminNotifications } from "@/components/super-admin/SuperAdminNotifications";
import { SuperAdminSettings } from "@/components/super-admin/SuperAdminSettings";
import { AuditLogsTab } from "@/components/admin/AuditLogsTab";
import { SecurityCenter } from "@/components/super-admin/SecurityCenter";
import { RoleMenuPermissions } from "@/components/super-admin/RoleMenuPermissions";
import { SuperAdminUsage } from "@/components/super-admin/SuperAdminUsage";
import { SuperAdminExerciseLibrary } from "@/components/super-admin/SuperAdminExerciseLibrary";
import { SuperAdminArchives } from "@/components/super-admin/SuperAdminArchives";
import { SuperAdminTestBank } from "@/components/super-admin/SuperAdminTestBank";
import { SuperAdminArsenalBank } from "@/components/super-admin/SuperAdminArsenalBank";
import { EmailMonitoring } from "@/components/super-admin/EmailMonitoring";

const TABS = [
  { value: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { value: "clients", label: "Clients", icon: Building2 },
  { value: "clubs", label: "Clubs", icon: Building2 },
  { value: "users", label: "Utilisateurs", icon: Users },
  { value: "subscriptions", label: "Abonnements", icon: CreditCard },
  { value: "payments", label: "Paiements", icon: CreditCard },
  { value: "videos", label: "Vidéos", icon: Video },
  { value: "notifications", label: "Notifications", icon: Bell },
  { value: "settings", label: "Paramètres", icon: Settings },
  { value: "permissions", label: "Permissions", icon: Lock },
  { value: "usage", label: "Utilisation", icon: Clock },
  { value: "exercises", label: "Exercices", icon: Dumbbell },
  { value: "test-bank", label: "Banque de tests", icon: ClipboardList },
  { value: "arsenal-bank", label: "Banque Arsenal", icon: CircleDot },
  { value: "audit", label: "Sécurité & Audit", icon: Shield },
  { value: "emails", label: "Emails", icon: Mail },
  { value: "archives", label: "Archives", icon: Archive },
] as const;
 
 export default function SuperAdmin() {
   const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const defaultTab = searchParams.get("tab") || "dashboard";
    const [activeTab, setActiveTab] = useState(defaultTab);
 
   // Check if current user is super admin
   const { data: isSuperAdmin, isLoading: checkingAdmin } = useQuery({
     queryKey: ["is-super-admin", user?.id],
     queryFn: async () => {
       if (!user?.id) return false;
       const { data, error } = await supabase.rpc("is_super_admin", {
         _user_id: user.id,
       });
       if (error) {
         console.error("Error checking super admin status:", error);
         return false;
       }
       return data === true;
     },
     enabled: !!user?.id,
   });
 
   // Redirect if not authenticated or not super admin
   useEffect(() => {
     if (!authLoading && !user) {
       navigate("/auth");
     }
   }, [authLoading, user, navigate]);
 
   useEffect(() => {
     if (!checkingAdmin && isSuperAdmin === false && user) {
       toast.error("Accès non autorisé");
       navigate("/");
     }
   }, [checkingAdmin, isSuperAdmin, user, navigate]);
 
   if (authLoading || checkingAdmin) {
     return (
       <div className="min-h-screen bg-background flex items-center justify-center">
         <p className="text-muted-foreground">Vérification des permissions...</p>
       </div>
     );
   }
 
   if (!isSuperAdmin) {
     return null;
   }
 



    const handleTabChange = (value: string) => {
      setActiveTab(value);
      navigate(`?tab=${value}`, { replace: true });
    };

    const activeTabInfo = TABS.find((t) => t.value === activeTab) ?? TABS[0];
    const ActiveIcon = activeTabInfo.icon;

    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold">Super Admin</h1>
                <p className="text-muted-foreground">Gestion globale de la plateforme</p>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2 min-w-[220px] justify-between">
                  <span className="flex items-center gap-2">
                    <ActiveIcon className="h-4 w-4" />
                    {activeTabInfo.label}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[220px] max-h-[60vh] overflow-y-auto">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <DropdownMenuItem
                      key={tab.value}
                      onClick={() => handleTabChange(tab.value)}
                      className={activeTab === tab.value ? "bg-accent text-accent-foreground" : ""}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {tab.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
 
           <TabsContent value="dashboard">
             <SuperAdminDashboard />
           </TabsContent>
 
           <TabsContent value="clients">
             <SuperAdminClients />
           </TabsContent>
 
           <TabsContent value="clubs">
             <SuperAdminClubs />
           </TabsContent>
 
           <TabsContent value="users">
             <SuperAdminUsers />
           </TabsContent>
 
           <TabsContent value="subscriptions">
             <SuperAdminSubscriptions />
           </TabsContent>
 
           <TabsContent value="payments">
             <SuperAdminPayments />
           </TabsContent>
 
           <TabsContent value="videos">
             <SuperAdminVideos />
           </TabsContent>
 
           <TabsContent value="notifications">
             <SuperAdminNotifications />
           </TabsContent>
 
           <TabsContent value="settings">
             <SuperAdminSettings />
           </TabsContent>

             <TabsContent value="permissions">
               <RoleMenuPermissions />
             </TabsContent>

             <TabsContent value="usage">
               <SuperAdminUsage />
             </TabsContent>

               <TabsContent value="exercises">
                 <SuperAdminExerciseLibrary />
               </TabsContent>

                <TabsContent value="test-bank">
                  <SuperAdminTestBank />
                </TabsContent>

                <TabsContent value="arsenal-bank">
                  <SuperAdminArsenalBank />
                </TabsContent>

                <TabsContent value="audit">
                  <SecurityCenter />
                </TabsContent>

                 <TabsContent value="emails">
                   <EmailMonitoring />
                 </TabsContent>

                 <TabsContent value="archives">
                   <SuperAdminArchives />
                 </TabsContent>
            </Tabs>
        </div>
      </div>
    );
  }