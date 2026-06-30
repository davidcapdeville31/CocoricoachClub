import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentUserIdentity } from "@/hooks/useCurrentUserIdentity";
import { TutorialVideosSection } from "@/components/category/settings/TutorialVideosSection";
import { NotificationManagementSection } from "@/components/category/settings/NotificationManagementSection";
import { PersonalNotificationPreferences } from "@/components/notifications/PersonalNotificationPreferences";
import { PushNotificationSettings } from "@/components/notifications/PushNotificationSettings";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Video, Bell, Settings, ChevronDown, Archive } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SettingsTabProps {
  categoryId: string;
}

export function SettingsTab({ categoryId }: SettingsTabProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [myNotifsOpen, setMyNotifsOpen] = useState(false);
  const [tutorialsOpen, setTutorialsOpen] = useState(false);

  const { data: isSuperAdmin } = useQuery({
    queryKey: ["is-super-admin", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase.rpc("is_super_admin", { _user_id: user.id });
      return data === true;
    },
    enabled: !!user?.id,
  });

  const archiveCategory = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("archive_category", { _category_id: categoryId });
      if (error) throw error;
      const r = data as { success: boolean; error?: string };
      if (!r?.success) throw new Error(r?.error || "Échec");
    },
    onSuccess: () => {
      toast.success("Catégorie archivée");
      navigate("/");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {/* Notifications Collapsible */}
      <Collapsible open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <CollapsibleTrigger className="w-full">
          <div className={cn(
            "flex items-center justify-between w-full p-4 rounded-xl border bg-card shadow-sm transition-colors hover:bg-accent/50",
            notificationsOpen && "rounded-b-none border-b-0"
          )}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Notifications</p>
                <p className="text-sm text-muted-foreground">Push et email pour le staff et les athlètes</p>
              </div>
            </div>
            <ChevronDown className={cn(
              "h-5 w-5 text-muted-foreground transition-transform duration-200",
              notificationsOpen && "rotate-180"
            )} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border border-t-0 rounded-b-xl p-4 bg-card shadow-sm">
            <NotificationManagementSection categoryId={categoryId} />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* My Notification Preferences Collapsible */}
      <Collapsible open={myNotifsOpen} onOpenChange={setMyNotifsOpen}>
        <CollapsibleTrigger className="w-full">
          <div className={cn(
            "flex items-center justify-between w-full p-4 rounded-xl border bg-card shadow-sm transition-colors hover:bg-accent/50",
            myNotifsOpen && "rounded-b-none border-b-0"
          )}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Mes notifications</p>
                <p className="text-sm text-muted-foreground">Gérer mes préférences et activer les notifications</p>
              </div>
            </div>
            <ChevronDown className={cn(
              "h-5 w-5 text-muted-foreground transition-transform duration-200",
              myNotifsOpen && "rotate-180"
            )} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border border-t-0 rounded-b-xl p-4 bg-card shadow-sm space-y-4">
            <PushNotificationSettings />
            <PersonalNotificationPreferences />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Tutorial Videos Collapsible */}
      <Collapsible open={tutorialsOpen} onOpenChange={setTutorialsOpen}>
        <CollapsibleTrigger className="w-full">
          <div className={cn(
            "flex items-center justify-between w-full p-4 rounded-xl border bg-card shadow-sm transition-colors hover:bg-accent/50",
            tutorialsOpen && "rounded-b-none border-b-0"
          )}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Video className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Vidéos & Tutoriels</p>
                <p className="text-sm text-muted-foreground">Guides et formations vidéo</p>
              </div>
            </div>
            <ChevronDown className={cn(
              "h-5 w-5 text-muted-foreground transition-transform duration-200",
              tutorialsOpen && "rotate-180"
            )} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border border-t-0 rounded-b-xl p-4 bg-card shadow-sm">
            <TutorialVideosSection />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {isSuperAdmin && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <Archive className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="font-semibold">Archiver cette catégorie</p>
              <p className="text-sm text-muted-foreground">
                Sauvegarde un instantané et masque la catégorie. Restauration possible depuis Super Admin → Archives.
              </p>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={archiveCategory.isPending}>
                <Archive className="h-4 w-4 mr-2" />
                {archiveCategory.isPending ? "Archivage..." : "Archiver la catégorie"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Archiver cette catégorie ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Toutes les données restent conservées et peuvent être restaurées depuis Super Admin → Archives.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={() => archiveCategory.mutate()}>
                  Archiver
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
