import { useState, useEffect } from "react";
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
import { requestOneSignalPermission, getOneSignalPermission, initOneSignal, buildUserTags, oneSignalLogin, checkOneSignalSubscriptionStatus } from "@/lib/onesignal";
import { useQuery } from "@tanstack/react-query";
import { PersonalNotificationPreferences } from "@/components/notifications/PersonalNotificationPreferences";
import { PWAInstallGuide } from "@/components/PWAInstallGuide";
import { useTranslation } from "react-i18next";

interface AthleteSpaceSettingsProps {
  playerId?: string;
}

export function AthleteSpaceSettings({ playerId }: AthleteSpaceSettingsProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [serverSubscribed, setServerSubscribed] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>(getOneSignalPermission());
  const [isActivating, setIsActivating] = useState(false);

  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Refresh permission on mount and when tab becomes visible
  useEffect(() => {
    const refresh = () => setPermission(getOneSignalPermission());
    setIsSupported(typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator);
    refresh();
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, []);

  // Fetch the athlete's email from player profile
  const { data: playerData } = useQuery({
    queryKey: ["player-settings-email", playerId],
    queryFn: async () => {
      if (!playerId) return null;
      const { data } = await supabase
        .from("players")
        .select("email, name, first_name, user_id")
        .eq("id", playerId)
        .single();
      return data;
    },
    enabled: !!playerId,
  });

  // Fetch the athlete's auth email if they have a user account
  const { data: athleteProfile } = useQuery({
    queryKey: ["athlete-profile-email", playerData?.user_id],
    queryFn: async () => {
      if (!playerData?.user_id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", playerData.user_id)
        .single();
      return data;
    },
    enabled: !!playerData?.user_id,
  });

  // Check if email is registered in OneSignal via edge function
  const { data: emailNotifStatus } = useQuery({
    queryKey: ["email-notif-status", playerData?.user_id || user?.id],
    queryFn: async () => {
      const targetUserId = playerData?.user_id || user?.id;
      if (!targetUserId) return false;
      try {
        const { data } = await supabase.functions.invoke("check-onesignal-subscriptions", {
          body: { user_ids: [targetUserId] },
        });
        return data?.results?.[targetUserId]?.hasEmail ?? false;
      } catch {
        return false;
      }
    },
    enabled: !!(playerData?.user_id || user?.id),
  });

  // Determine the email to display:
  // 1. Athlete's profile email (from profiles table via user_id)
  // 2. Player's email (from players table)
  // 3. Current user's email (fallback)
  const displayEmail = athleteProfile?.email || playerData?.email || user?.email || "—";

  useEffect(() => {
    const targetUserId = playerData?.user_id || user?.id;
    if (!targetUserId) return;
    checkOneSignalSubscriptionStatus(targetUserId).then(setServerSubscribed).catch(() => setServerSubscribed(false));
  }, [playerData?.user_id, user?.id]);

  const handleActivateNotifications = async () => {
    setIsActivating(true);
    try {
      await initOneSignal();
      const granted = await requestOneSignalPermission();
      if (granted) {
        if (!user) throw new Error(t("athleteSpace.settings.userNotFound"));
        const tags = await buildUserTags(user.id);
        const subscribed = await oneSignalLogin(user.id, user.email || "", tags);
        setPermission(getOneSignalPermission());
        setServerSubscribed(subscribed);
        if (subscribed) toast.success(t("athleteSpace.settings.activatedSuccess"));
        else toast.warning(t("athleteSpace.settings.grantedNotSubscribed"));
      } else {
        setPermission(getOneSignalPermission());
        toast.error(t("athleteSpace.settings.denied"));
      }
    } catch {
      toast.error(t("athleteSpace.settings.activationError"));
    } finally {
      setIsActivating(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error(t("athleteSpace.settings.passwordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("athleteSpace.settings.passwordMismatch"));
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success(t("athleteSpace.settings.passwordChanged"));
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
    } catch (err: any) {
      toast.error(err.message || t("athleteSpace.settings.passwordChangeError"));
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Determine push status: use OneSignal SDK permission + subscription
  const pushIsGranted = serverSubscribed === true;
  const pushIsDenied = permission === "denied";
  const pushIsDefault = !pushIsGranted && !pushIsDenied;

  return (
    <div className="space-y-6">
      {/* Push Notifications */}
      <Card className="shadow-md border-2" style={{ borderColor: `${NAV_COLORS.communication.base}30` }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" style={{ color: NAV_COLORS.communication.base }} />
            {t("athleteSpace.settings.pushNotifications")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isSupported ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <BellOff className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{t("athleteSpace.settings.notSupported")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("athleteSpace.settings.notSupportedDesc")}
                </p>
              </div>
            </div>
          ) : pushIsGranted ? (
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: `${NAV_COLORS.communication.base}10` }}>
              <CheckCircle2 className="h-5 w-5 text-status-optimal" />
              <div>
                <p className="text-sm font-medium">{t("athleteSpace.settings.enabled")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("athleteSpace.settings.enabledDesc")}
                </p>
              </div>
            </div>
          ) : pushIsDenied ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-sm font-medium">{t("athleteSpace.settings.blocked")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("athleteSpace.settings.blockedDesc")}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/10">
                <Bell className="h-5 w-5 text-warning" />
                <div>
                  <p className="text-sm font-medium">{t("athleteSpace.settings.notEnabled")}</p>
                  <p className="text-xs text-muted-foreground">
                    {permission === "granted"
                      ? t("athleteSpace.settings.grantedNoDevice")
                      : t("athleteSpace.settings.activatePrompt")}
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
                {isActivating ? t("athleteSpace.settings.activating") : t("athleteSpace.settings.activate")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Notifications Status */}
      <Card className="shadow-md border-2" style={{ borderColor: `${NAV_COLORS.planification.base}30` }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" style={{ color: NAV_COLORS.planification.base }} />
            {t("athleteSpace.settings.emailNotifications")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: emailNotifStatus ? `${NAV_COLORS.sante.base}10` : `${NAV_COLORS.performance.base}10` }}>
            {emailNotifStatus ? (
              <CheckCircle2 className="h-5 w-5" style={{ color: NAV_COLORS.sante.base }} />
            ) : (
              <AlertCircle className="h-5 w-5" style={{ color: NAV_COLORS.performance.base }} />
            )}
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">
                  {emailNotifStatus ? t("athleteSpace.settings.active") : t("athleteSpace.settings.inactive")}
                </p>
                <Badge 
                  variant={emailNotifStatus ? "default" : "secondary"}
                  className="text-[10px] h-5"
                  style={emailNotifStatus ? { backgroundColor: NAV_COLORS.sante.base } : {}}
                >
                  {emailNotifStatus ? t("athleteSpace.settings.active") : t("athleteSpace.settings.inactive")}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {emailNotifStatus 
                  ? t("athleteSpace.settings.emailActiveDesc")
                  : t("athleteSpace.settings.emailInactiveDesc")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Notification Preferences */}
      <PersonalNotificationPreferences />

      {/* Account info */}
      <Card className="shadow-md border-2" style={{ borderColor: `${NAV_COLORS.effectif.base}30` }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" style={{ color: NAV_COLORS.effectif.base }} />
            {t("athleteSpace.settings.myAccount")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/30 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground">{t("athleteSpace.settings.emailIdentifier")}</Label>
              <Badge variant="outline" className="text-xs max-w-[200px] truncate">{displayEmail}</Badge>
            </div>
          </div>

          {!showPasswordForm ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowPasswordForm(true)}
            >
              <Lock className="h-4 w-4 mr-2" />
              {t("athleteSpace.settings.changePassword")}
            </Button>
          ) : (
            <div className="space-y-3 p-4 rounded-lg border">
              <div>
                <Label className="text-sm">{t("athleteSpace.settings.newPassword")}</Label>
                <div className="relative mt-1">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t("athleteSpace.settings.newPasswordPlaceholder")}
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
                <Label className="text-sm">{t("athleteSpace.settings.confirmPassword")}</Label>
                <Input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("athleteSpace.settings.confirmPasswordPlaceholder")}
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
                  {t("athleteSpace.settings.cancel")}
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleChangePassword}
                  disabled={isChangingPassword || !newPassword || !confirmPassword}
                >
                  {isChangingPassword ? t("athleteSpace.settings.saving") : t("athleteSpace.settings.save")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PWA Install Guide (always visible) */}
      <PWAInstallGuide />
    </div>
  );
}
