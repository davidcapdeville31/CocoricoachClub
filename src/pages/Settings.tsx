import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings as SettingsIcon } from "lucide-react";
import { OfflineSyncPanel } from "@/components/OfflineSyncPanel";
import { PushNotificationSettings } from "@/components/notifications/PushNotificationSettings";
import { useEffect } from "react";

export default function Settings() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-3xl px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <SettingsIcon className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Paramètres</h1>
              <p className="text-muted-foreground">Gérez vos préférences</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Push Notifications */}
          <PushNotificationSettings />

          {/* Offline Sync */}
          <OfflineSyncPanel />
        </div>
      </div>
    </div>
  );
}
