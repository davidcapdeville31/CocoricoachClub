import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TutorialVideosSection } from "@/components/category/settings/TutorialVideosSection";
import { NotificationManagementSection } from "@/components/category/settings/NotificationManagementSection";
import { PersonalNotificationPreferences } from "@/components/notifications/PersonalNotificationPreferences";
import { PushNotificationSettings } from "@/components/notifications/PushNotificationSettings";
import { CategoryCoverUpload } from "@/components/category/CategoryCoverUpload";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Video, Bell, Settings, ChevronDown, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsTabProps {
  categoryId: string;
}

export function SettingsTab({ categoryId }: SettingsTabProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [myNotifsOpen, setMyNotifsOpen] = useState(false);
  const [tutorialsOpen, setTutorialsOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);

  const { data: category } = useQuery({
    queryKey: ["category-cover", categoryId],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("cover_image_url")
        .eq("id", categoryId)
        .maybeSingle();
      return data;
    },
  });

  return (
    <div className="space-y-4">
      {/* Cover image */}
      <Collapsible open={coverOpen} onOpenChange={setCoverOpen}>
        <CollapsibleTrigger className="w-full">
          <div className={cn(
            "flex items-center justify-between w-full p-4 rounded-xl border bg-card shadow-sm transition-colors hover:bg-accent/50",
            coverOpen && "rounded-b-none border-b-0"
          )}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ImageIcon className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Image de couverture</p>
                <p className="text-sm text-muted-foreground">Modifier ou supprimer l'image affichée en en-tête</p>
              </div>
            </div>
            <ChevronDown className={cn(
              "h-5 w-5 text-muted-foreground transition-transform duration-200",
              coverOpen && "rotate-180"
            )} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border border-t-0 rounded-b-xl p-4 bg-card shadow-sm">
            <div className="rounded-lg bg-slate-800 p-4 inline-flex">
              <CategoryCoverUpload
                categoryId={categoryId}
                currentCoverUrl={category?.cover_image_url ?? null}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

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
    </div>
  );
}
