import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { signUpSchema, loginSchema } from "@/lib/validations";
import { BrandLogo } from "@/components/BrandLogo";
import { getAppBaseUrl } from "@/lib/appUrl";

async function getPostLoginRedirect(userId: string): Promise<string> {
  // Check if user has only athlete role and no clubs
  const { data: categoryRoles } = await supabase
    .from("category_members")
    .select("role")
    .eq("user_id", userId);

  const { data: ownedClubs } = await supabase
    .from("clubs")
    .select("id")
    .eq("user_id", userId)
    .limit(1);

  const { data: memberClubs } = await supabase
    .from("club_members")
    .select("club_id")
    .eq("user_id", userId)
    .limit(1);

  const hasOnlyAthleteRole = categoryRoles && categoryRoles.length > 0 && categoryRoles.every(r => r.role === "athlete");
  const hasNoClubs = (!ownedClubs || ownedClubs.length === 0) && (!memberClubs || memberClubs.length === 0);

  if (hasOnlyAthleteRole && hasNoClubs) {
    return "/athlete-space";
  }
  return "/";
}

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectUrl = searchParams.get("redirect");
  const isRecoveryMode = searchParams.get("mode") === "recovery";
  const initialTab = searchParams.get("tab") === "signup" ? "signup" : "login";
  const prefillEmail = searchParams.get("email") || "";
  const [isLoading, setIsLoading] = useState(false);

  // Redirect authenticated users away from auth page
  const { user, loading: authLoading } = useAuth();
  useEffect(() => {
    if (!authLoading && user && !isRecoveryMode) {
      if (redirectUrl) {
        navigate(redirectUrl, { replace: true });
        return;
      }
      // Compute the correct landing page based on the user's role
      // (athletes-only → /athlete-space, otherwise → /)
      let cancelled = false;
      getPostLoginRedirect(user.id).then((dest) => {
        if (!cancelled) navigate(dest, { replace: true });
      }).catch(() => {
        if (!cancelled) navigate("/", { replace: true });
      });
      return () => { cancelled = true; };
    }
  }, [user, authLoading, navigate, redirectUrl, isRecoveryMode]);
  const [forgotStep, setForgotStep] = useState<"hidden" | "email" | "reset" | "sent" | "success">(isRecoveryMode ? "reset" : "hidden");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [loginEmail, setLoginEmail] = useState(prefillEmail);
  const [loginPassword, setLoginPassword] = useState("");
  
  const [signupEmail, setSignupEmail] = useState(prefillEmail);
  const [signupPassword, setSignupPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [signupPhone, setSignupPhone] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validated = loginSchema.parse({ email: loginEmail, password: loginPassword });
      
      const { error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) {
        // Log failed login attempt (security audit)
        try {
          await supabase.rpc("log_security_event", {
            _event_type: "login_failed",
            _severity: "warning",
            _ip_address: null,
            _user_agent: navigator.userAgent,
            _device_fingerprint: null,
            _club_id: null,
            _metadata: { email: validated.email, reason: error.message } as never,
          });
        } catch { /* non-blocking */ }

        if (error.message.includes("Invalid login credentials")) {
          toast.error("Email ou mot de passe incorrect");
        } else {
          toast.error(error.message);
        }
        return;
      }

      // Log successful login (security audit)
      try {
        const { logSecurityEvent, getDeviceFingerprint } = await import("@/lib/security/securityLogger");
        await logSecurityEvent({
          eventType: "login_success",
          severity: "info",
          metadata: { method: "password", fingerprint: getDeviceFingerprint() },
        });
      } catch { /* non-blocking */ }

      toast.success("Connexion réussie");
      
      // If there's a redirect URL (e.g. from invitation link), use it
      if (redirectUrl) {
        navigate(redirectUrl);
        return;
      }
      
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (uid) {
        const dest = await getPostLoginRedirect(uid);
        navigate(dest);
      } else {
        navigate("/");
      }
    } catch (error: any) {
      if (error.errors) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Erreur lors de la connexion");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      const email = forgotEmail.trim().toLowerCase();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getAppBaseUrl()}/auth?mode=recovery`,
      });

      if (error) throw error;

      setForgotEmail(email);
      setForgotStep("sent");
      toast.success("Si un compte existe, un email de réinitialisation a été envoyé.");
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de l'envoi de l'email");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      await supabase.auth.signOut();
      
      setForgotStep("success");
      toast.success("Mot de passe mis à jour avec succès !");
      setTimeout(() => {
        navigate("/auth", { replace: true });
        setForgotStep("hidden");
        setForgotEmail("");
        setNewPassword("");
        setConfirmPassword("");
      }, 2000);
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la mise à jour");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validated = signUpSchema.parse({ 
        email: signupEmail, 
        password: signupPassword, 
        fullName,
        phone: signupPhone,
      });

      const { error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          emailRedirectTo: `${getAppBaseUrl()}/`,
          data: {
            full_name: validated.fullName,
            phone: validated.phone || undefined,
          },
        },
      });

      if (error) {
        if (error.message.includes("User already registered")) {
          toast.error("Un compte existe déjà avec cet email");
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success("Compte créé avec succès");
      
      // If there's a redirect URL (e.g. from invitation link), use it
      if (redirectUrl) {
        navigate(redirectUrl);
        return;
      }
      
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (uid) {
        const dest = await getPostLoginRedirect(uid);
        navigate(dest);
      } else {
        navigate("/");
      }
    } catch (error: any) {
      if (error.errors) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Erreur lors de l'inscription");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="pb-2 space-y-1">
          <div className="flex justify-center -mb-2">
            <BrandLogo className="h-28 sm:h-32 w-auto" />
          </div>
          <CardDescription className="text-center">
            Connectez-vous pour gérer vos clubs et athlètes
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <Tabs defaultValue="login" className="w-full">
            {/* Inscription publique désactivée : comptes créés sur devis personnalisé. */}
            <TabsList className="hidden">
              <TabsTrigger value="login">Connexion</TabsTrigger>
              <TabsTrigger value="signup">Inscription</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              {forgotStep === "email" ? (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Entrez votre adresse email pour réinitialiser votre mot de passe.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Email</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="votre@email.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      disabled={forgotLoading}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={forgotLoading}>
                    {forgotLoading ? "Envoi..." : "Envoyer le lien"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => setForgotStep("hidden")}
                  >
                    Retour à la connexion
                  </Button>
                </form>
              ) : forgotStep === "sent" ? (
                <div className="text-center space-y-3 py-4">
                  <p className="text-sm font-medium text-primary">Email envoyé</p>
                  <p className="text-xs text-muted-foreground">
                    Si un compte existe pour <span className="font-medium text-foreground">{forgotEmail}</span>, vous recevrez un lien pour réinitialiser votre mot de passe.
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => setForgotStep("hidden")}
                  >
                    Retour à la connexion
                  </Button>
                </div>
              ) : forgotStep === "reset" ? (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Choisissez votre nouveau mot de passe.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nouveau mot de passe</Label>
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="Minimum 6 caractères"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      disabled={forgotLoading}
                      minLength={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Répétez le mot de passe"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={forgotLoading}
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={forgotLoading}>
                    {forgotLoading ? "Mise à jour..." : "Mettre à jour le mot de passe"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => { setForgotStep("hidden"); setNewPassword(""); setConfirmPassword(""); }}
                  >
                    Annuler
                  </Button>
                </form>
              ) : forgotStep === "success" ? (
                <div className="text-center space-y-3 py-4">
                  <p className="text-sm font-medium text-primary">✓ Mot de passe mis à jour avec succès !</p>
                  <p className="text-xs text-muted-foreground">Vous pouvez maintenant vous connecter.</p>
                </div>
              ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="votre@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Mot de passe</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Connexion..." : "Se connecter"}
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="w-full text-sm text-muted-foreground"
                  onClick={() => setForgotStep("email")}
                >
                  Mot de passe oublié ?
                </Button>
              </form>
              )}
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Nom complet</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Jean Dupont"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    disabled={isLoading}
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="votre@email.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                    disabled={isLoading}
                    maxLength={255}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-phone">Téléphone</Label>
                  <Input
                    id="signup-phone"
                    type="tel"
                    placeholder="+33 6 12 34 56 78"
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(e.target.value)}
                    disabled={isLoading}
                    maxLength={20}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Mot de passe</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Minimum 6 caractères"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    minLength={6}
                    maxLength={72}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Création..." : "Créer un compte"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

        </CardContent>
      </Card>
    </div>
  );
}

