import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, Lock, Mail, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { NAV_COLORS } from "@/components/ui/colored-nav-tabs";
import { requestOneSignalPermission, getOneSignalPermission } from "@/lib/onesignal";
import { usePushNotifications } from "@/hooks/use-push-notifications";

export function AthleteSpaceSettings() {
  const { user } = useAuth();
  const { isSupported, subscribe } = usePushNotifications();
  const [permission, setPermission] = useState<NotificationPermission>(getOneSignalPermission());
  const [isActivating, setIsActivating] = useState(false);

  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleActivateNotifications = async () => {
    setIsActivating(true);
    try {
      const granted = await requestOneSignalPermission();
      if (granted) {
        await subscribe();
        setPermission("granted");
        toast.success("Notifications activées !");
      } else {
        setPermission(getOneSignalPermission());
        toast.error("Notifications refusées par le navigateur");
      }
    } catch {
      toast.error("Erreur lors de l'activation");
    } finally {
      setIsActivating(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Mot de passe modifié avec succès !");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors du changement de mot de passe");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
      <Card className="shadow-md border-2" style={{ borderColor: `${NAV_COLORS.communication.base}30` }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" style={{ color: NAV_COLORS.communication.base }} />
            Notifications Push
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isSupported ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <BellOff className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Non disponible</p>
                <p className="text-xs text-muted-foreground">
                  Les notifications push ne sont pas supportées sur ce navigateur.
                </p>
              </div>
            </div>
          ) : permission === "granted" ? (
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: `${NAV_COLORS.communication.base}10` }}>
              <CheckCircle2 className="h-5 w-5 text-status-optimal" />
              <div>
                <p className="text-sm font-medium">Notifications activées</p>
                <p className="text-xs text-muted-foreground">
                  Tu recevras les notifications de messages, convocations et annonces.
                </p>
              </div>
            </div>
          ) : permission === "denied" ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-sm font-medium">Notifications bloquées</p>
                <p className="text-xs text-muted-foreground">
                  Les notifications sont bloquées dans les paramètres de ton navigateur. 
                  Va dans les paramètres de ton navigateur pour les réactiver.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/10">
                <Bell className="h-5 w-5 text-warning" />
                <div>
                  <p className="text-sm font-medium">Notifications non activées</p>
                  <p className="text-xs text-muted-foreground">
                    Active les notifications pour ne rien manquer !
                  </p>
                </div>
              </div>
              <Button
                onClick={handleActivateNotifications}
                disabled={isActivating}
                className="w-full"
                style={{ backgroundColor: NAV_COLORS.communication.base }}
              >
                <Bell className="h-4 w-4 mr-2" />
                {isActivating ? "Activation..." : "Activer les notifications"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account info */}
      <Card className="shadow-md border-2" style={{ borderColor: `${NAV_COLORS.effectif.base}30` }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" style={{ color: NAV_COLORS.effectif.base }} />
            Mon compte
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/30 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground">Email / Identifiant</Label>
              <Badge variant="outline" className="text-xs">{user?.email || "—"}</Badge>
            </div>
          </div>

          {!showPasswordForm ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowPasswordForm(true)}
            >
              <Lock className="h-4 w-4 mr-2" />
              Modifier mon mot de passe
            </Button>
          ) : (
            <div className="space-y-3 p-4 rounded-lg border">
              <div>
                <Label className="text-sm">Nouveau mot de passe</Label>
                <div className="relative mt-1">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 6 caractères"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-sm">Confirmer le mot de passe</Label>
                <Input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirmer"
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                >
                  Annuler
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleChangePassword}
                  disabled={isChangingPassword || !newPassword || !confirmPassword}
                >
                  {isChangingPassword ? "..." : "Enregistrer"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
