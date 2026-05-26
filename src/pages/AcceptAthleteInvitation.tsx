import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle, Eye, EyeOff } from "lucide-react";
import { getAppBaseUrl } from "@/lib/appUrl";

interface InvitationData {
  id: string;
  email: string;
  player_id: string;
  category_id: string;
  club_id: string;
  status: string;
  player_name: string;
  player_first_name: string | null;
  club_name: string;
  category_name: string;
}

export default function AcceptAthleteInvitation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (token) {
      validateToken();
    } else {
      setError("Lien d'invitation invalide");
      setLoading(false);
    }
  }, [token]);

  // Auto-accept if user is already logged in with the matching email
  useEffect(() => {
    const autoAccept = async () => {
      if (!invitation || !token) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) return;

      setSubmitting(true);
      try {
        const { data, error: rpcErr } = await supabase.rpc(
          "accept_athlete_invitation_signup",
          { _token: token, _user_id: user.id }
        );
        if (rpcErr) throw rpcErr;
        const result = data as any;
        if (!result?.success) throw new Error(result?.error || "Erreur");
        toast.success("Invitation acceptée ! Bienvenue dans l'équipe 🏆");
        navigate("/athlete-space");
      } catch (e: any) {
        toast.error(e.message || "Erreur lors de l'acceptation");
        setSubmitting(false);
      }
    };
    autoAccept();
  }, [invitation, token, navigate]);

  const validateToken = async () => {
    try {
      const { data, error: rpcError } = await supabase.rpc("validate_athlete_invitation", {
        _token: token!,
      });

      if (rpcError) {
        console.error("RPC error:", rpcError);
        setError("Erreur lors de la validation de l'invitation");
        return;
      }

      const result = data as any;

      if (!result?.success) {
        setError(result?.error || "Lien d'invitation invalide");
        return;
      }

      setInvitation({
        id: result.id,
        email: result.email,
        player_id: result.player_id,
        category_id: result.category_id,
        club_id: result.club_id,
        status: result.status,
        player_name: result.player_name,
        player_first_name: result.player_first_name,
        club_name: result.club_name,
        category_name: result.category_name,
      });
    } catch (err) {
      console.error("Error validating invitation:", err);
      setError("Une erreur est survenue lors de la validation de l'invitation");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }

    if (!invitation) return;

    setSubmitting(true);

    try {
      // Single server-side call: creates a confirmed user, links player,
      // adds category membership, and marks the invitation as accepted.
      const { data, error: fnError } = await supabase.functions.invoke(
        "accept-athlete-invitation-signup",
        { body: { token, password } }
      );

      if (fnError) throw fnError;
      const result = data as any;
      if (!result?.success) {
        throw new Error(result?.error || "Erreur lors de la création du compte");
      }

      // Auto sign-in with the freshly-confirmed credentials
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: invitation.email,
        password,
      });

      if (signInError) {
        toast.success("Compte créé ! Connecte-toi pour accéder à ton espace.");
        navigate(`/auth?email=${encodeURIComponent(invitation.email)}`);
        return;
      }

      toast.success("Bienvenue dans l'équipe 🏆");
      navigate("/athlete-space");
    } catch (err: any) {
      console.error("Error creating account:", err);
      toast.error(err.message || "Erreur lors de la création du compte");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Vérification de l'invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Invitation invalide</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => navigate("/auth")}>Se connecter</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitation) return null;

  const displayName = invitation.player_first_name
    ? `${invitation.player_first_name} ${invitation.player_name}`
    : invitation.player_name;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl">Bienvenue {displayName} ! 🏆</CardTitle>
            <CardDescription className="mt-2">
              Tu as été invité(e) à rejoindre{" "}
              <span className="font-semibold text-foreground">{invitation.club_name}</span>{" "}
              dans la catégorie{" "}
              <span className="font-semibold text-foreground">{invitation.category_name}</span>
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={invitation.email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Cet email ne peut pas être modifié
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 caractères"
                  required
                  minLength={6}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Répète ton mot de passe"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Création du compte...
                </>
              ) : (
                "Créer mon compte"
              )}
            </Button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Ou</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              const params = new URLSearchParams();
              params.set("redirect", `/accept-athlete-invitation?token=${token}`);
              params.set("tab", "login");
              if (invitation.email) params.set("email", invitation.email);
              navigate(`/auth?${params.toString()}`);
            }}
          >
            J'ai déjà un compte — Se connecter
          </Button>

          <p className="text-xs text-muted-foreground text-center mt-4">
            En créant ton compte, tu acceptes de recevoir des notifications de ton club.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
