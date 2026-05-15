import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, ShieldCheck, KeyRound, Clock, Smartphone, Eye, AlertTriangle, CheckCircle2, Lock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useUserSecuritySettings, useUpdateSecuritySettings } from "@/lib/security/hooks/useUserSecuritySettings";
import { logSecurityEvent } from "@/lib/security/securityLogger";

interface MfaFactor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
}

export function SecuritySettingsPanel() {
  const { data: settings, isLoading } = useUserSecuritySettings();
  const updateSettings = useUpdateSecuritySettings();
  const qc = useQueryClient();

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollData, setEnrollData] = useState<{ qr: string; secret: string; factorId: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Password change state
  const [pwdOpen, setPwdOpen] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);

  // Load enrolled factors
  const { data: factors } = useQuery({
    queryKey: ["mfa-factors"],
    queryFn: async (): Promise<MfaFactor[]> => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return (data?.totp ?? []) as MfaFactor[];
    },
  });

  // Recent security events for current user
  const { data: myEvents } = useQuery({
    queryKey: ["my-security-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_events")
        .select("id, event_type, severity, created_at, device_fingerprint, metadata")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const verifiedFactor = factors?.find((f) => f.status === "verified");

  const handleEnableMfa = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error) throw error;
      if (!data) return;
      setEnrollData({
        qr: data.totp.qr_code,
        secret: data.totp.secret,
        factorId: data.id,
      });
      setEnrollOpen(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'activation";
      toast.error(msg);
    }
  };

  const handleVerifyMfa = async () => {
    if (!enrollData || !verifyCode || verifyCode.length !== 6) {
      toast.error("Entre le code à 6 chiffres");
      return;
    }
    setVerifying(true);
    try {
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
        factorId: enrollData.factorId,
      });
      if (chErr) throw chErr;

      const { error: verErr } = await supabase.auth.mfa.verify({
        factorId: enrollData.factorId,
        challengeId: challenge.id,
        code: verifyCode,
      });
      if (verErr) throw verErr;

      await updateSettings.mutateAsync({
        mfa_enabled: true,
        mfa_factor_id: enrollData.factorId,
        mfa_verified_at: new Date().toISOString(),
      });

      await logSecurityEvent({ eventType: "mfa_enabled", severity: "info" });

      toast.success("✓ Authentification à deux facteurs activée !");
      setEnrollOpen(false);
      setVerifyCode("");
      setEnrollData(null);
      qc.invalidateQueries({ queryKey: ["mfa-factors"] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Code invalide";
      toast.error(msg);
    } finally {
      setVerifying(false);
    }
  };

  const handleDisableMfa = async () => {
    if (!verifiedFactor) return;
    if (!confirm("Désactiver l'authentification à deux facteurs ? Ton compte sera moins protégé.")) return;
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactor.id });
      if (error) throw error;

      await updateSettings.mutateAsync({
        mfa_enabled: false,
        mfa_factor_id: null,
      });

      await logSecurityEvent({ eventType: "mfa_disabled", severity: "warning" });

      toast.success("2FA désactivé");
      qc.invalidateQueries({ queryKey: ["mfa-factors"] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur";
      toast.error(msg);
    }
  };

  const handleChangePassword = async () => {
    if (!newPwd || !confirmPwd) {
      toast.error("Remplis tous les champs");
      return;
    }
    if (newPwd !== confirmPwd) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    if (newPwd.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    setPwdLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;

      await logSecurityEvent({ eventType: "password_changed", severity: "info" });

      toast.success("Mot de passe mis à jour avec succès");
      setPwdOpen(false);
      setNewPwd("");
      setConfirmPwd("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors du changement de mot de passe";
      toast.error(msg);
    } finally {
      setPwdLoading(false);
    }
  };

  const handleTimeoutChange = async (value: string) => {
    const minutes = parseInt(value, 10);
    if (isNaN(minutes) || minutes < 5 || minutes > 480) {
      toast.error("Entre 5 et 480 minutes");
      return;
    }
    try {
      await updateSettings.mutateAsync({ session_timeout_minutes: minutes });
      toast.success("Timeout de session mis à jour");
    } catch {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  if (isLoading) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="p-6 text-center text-muted-foreground">Chargement…</CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Sécurité du compte
          </CardTitle>
          <CardDescription>
            Protège ton compte avec l'authentification à deux facteurs et configure tes préférences de sécurité.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* MFA Section */}
          <div className="p-4 rounded-2xl bg-muted/40 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="p-2 rounded-xl bg-background">
                  <KeyRound className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold">Authentification à deux facteurs (2FA)</h4>
                    {verifiedFactor ? (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Activée
                      </Badge>
                    ) : (
                      <Badge variant="outline">Désactivée</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ajoute un code à 6 chiffres généré par ton téléphone à chaque connexion. Compatible Google Authenticator, Authy, 1Password.
                  </p>
                </div>
              </div>
            </div>
            {verifiedFactor ? (
              <Button variant="outline" onClick={handleDisableMfa} className="w-full sm:w-auto">
                Désactiver le 2FA
              </Button>
            ) : (
              <Button onClick={handleEnableMfa} className="w-full sm:w-auto">
                <ShieldCheck className="h-4 w-4 mr-2" />
                Activer le 2FA
              </Button>
            )}
          </div>

          {/* Change Password */}
          <div className="p-4 rounded-2xl bg-muted/40 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="p-2 rounded-xl bg-background">
                  <Lock className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold">Mot de passe</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Change ton mot de passe pour sécuriser ton compte.
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={() => setPwdOpen(true)} className="w-full sm:w-auto">
                Modifier
              </Button>
            </div>
          </div>

          {/* Session timeout */}
          <div className="p-4 rounded-2xl bg-muted/40 space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-background">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <h4 className="font-semibold">Déconnexion automatique</h4>
                  <p className="text-sm text-muted-foreground">
                    Après combien de minutes d'inactivité veux-tu être déconnecté ? (5-480 min)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={5}
                    max={480}
                    defaultValue={settings?.session_timeout_minutes ?? 30}
                    className="w-24 rounded-xl bg-background"
                    onBlur={(e) => handleTimeoutChange(e.target.value)}
                  />
                  <Label className="text-sm text-muted-foreground">minutes</Label>
                </div>
              </div>
            </div>
          </div>

          {/* Recent security events */}
          <div className="space-y-2">
            <h4 className="font-semibold flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Activité récente du compte
            </h4>
            <ScrollArea className="h-[240px] rounded-2xl border bg-muted/20">
              <div className="p-3 space-y-2">
                {myEvents && myEvents.length > 0 ? myEvents.map((ev) => (
                  <div key={ev.id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-background text-sm">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {ev.severity === "critical" ? (
                        <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                      ) : ev.severity === "warning" ? (
                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      )}
                      <span className="truncate">{ev.event_type}</span>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(ev.created_at), "dd/MM HH:mm", { locale: fr })}
                    </span>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground text-center py-6">Aucune activité enregistrée.</p>
                )}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      {/* MFA enrollment dialog */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Configuration du 2FA
            </DialogTitle>
            <DialogDescription>
              Scanne ce QR code avec ton application d'authentification, puis entre le code à 6 chiffres pour valider.
            </DialogDescription>
          </DialogHeader>
          {enrollData && (
            <div className="space-y-4">
              <div className="flex justify-center p-4 bg-white rounded-2xl">
                <img src={enrollData.qr} alt="QR Code 2FA" className="w-48 h-48" />
              </div>
              <Alert className="rounded-xl">
                <AlertDescription className="text-xs font-mono break-all">
                  Code manuel : {enrollData.secret}
                </AlertDescription>
              </Alert>
              <div>
                <Label>Code à 6 chiffres</Label>
                <Input
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  maxLength={6}
                  className="text-center text-2xl tracking-widest font-mono rounded-xl bg-muted/40 mt-2"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollOpen(false)}>Annuler</Button>
            <Button onClick={handleVerifyMfa} disabled={verifying}>
              {verifying ? "Vérification…" : "Valider"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password change dialog */}
      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Modifier le mot de passe
            </DialogTitle>
            <DialogDescription>
              Choisis un nouveau mot de passe sécurisé pour ton compte.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nouveau mot de passe</Label>
              <Input
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="••••••••"
                className="rounded-xl bg-muted/40 mt-2"
              />
            </div>
            <div>
              <Label>Confirmer le mot de passe</Label>
              <Input
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                placeholder="••••••••"
                className="rounded-xl bg-muted/40 mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdOpen(false)}>Annuler</Button>
            <Button onClick={handleChangePassword} disabled={pwdLoading}>
              {pwdLoading ? "Mise à jour…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
