import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { Wrench, AlertTriangle } from "lucide-react";

interface MaintenanceValue {
  enabled: boolean;
  message: string;
}

const DEFAULT_MESSAGE = "Application en maintenance. Nous revenons très vite !";

export function MaintenanceModeCard() {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["maintenance-setting"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "maintenance_mode")
        .maybeSingle();
      if (error) throw error;
      return (data?.setting_value as unknown as MaintenanceValue) ?? {
        enabled: false,
        message: DEFAULT_MESSAGE,
      };
    },
  });

  useEffect(() => {
    if (data) {
      setEnabled(!!data.enabled);
      setMessage(data.message || DEFAULT_MESSAGE);
    }
  }, [data]);

  const save = async (nextEnabled: boolean, nextMessage: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert(
          {
            setting_key: "maintenance_mode",
            setting_value: { enabled: nextEnabled, message: nextMessage } as any,
            description:
              "Mode maintenance global. Bloque l'accès à toute l'app sauf pour les super admins.",
          },
          { onConflict: "setting_key" },
        );
      if (error) throw error;
      toast.success(
        nextEnabled
          ? "Mode maintenance activé"
          : "Mode maintenance désactivé",
      );
      queryClient.invalidateQueries({ queryKey: ["maintenance-setting"] });
      queryClient.invalidateQueries({ queryKey: ["maintenance-status"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    save(checked, message);
  };

  const handleSaveMessage = () => {
    save(enabled, message);
  };

  return (
    <Card className="rounded-2xl border-2 border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-red-500/5">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-orange-500/15 text-orange-600 flex items-center justify-center">
            <Wrench className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <CardTitle>Mode maintenance</CardTitle>
            <CardDescription>
              Bloque l'accès à toute l'application sauf pour les super admins.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between bg-background/60 rounded-xl p-4 backdrop-blur-sm">
          <div>
            <Label htmlFor="maintenance-toggle" className="text-base font-semibold">
              Activer la maintenance
            </Label>
            <p className="text-sm text-muted-foreground">
              {enabled
                ? "🔴 Maintenance ACTIVE – les utilisateurs voient l'écran de blocage."
                : "🟢 Application accessible normalement."}
            </p>
          </div>
          <Switch
            id="maintenance-toggle"
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={isLoading || saving}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="maintenance-message">Message affiché aux utilisateurs</Label>
          <Textarea
            id="maintenance-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder={DEFAULT_MESSAGE}
            className="bg-muted/40 rounded-xl"
            maxLength={500}
          />
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">{message.length}/500 caractères</p>
            <Button onClick={handleSaveMessage} disabled={saving} size="sm">
              Enregistrer le message
            </Button>
          </div>
        </div>

        {enabled && (
          <div className="flex gap-3 p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 text-sm">
            <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0" />
            <p>
              <strong>Maintenance active.</strong> Seuls les super admins peuvent toujours
              accéder à la plateforme. La page <code>/super-admin</code> et <code>/auth</code> restent ouvertes pour pouvoir désactiver le mode.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
