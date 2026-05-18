import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, CheckCircle, XCircle, LogIn, UserPlus, Building2, Users } from "lucide-react";
import InstallInstructions from "@/components/InstallInstructions";

interface InvitationInfo {
  success: boolean;
  error?: string;
  kind?: "club" | "category";
  email?: string;
  club_name?: string;
  category_name?: string;
  category_names?: string[];
  status?: string;
}

export default function AcceptInvitation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<"loading" | "choose" | "accepting" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [redirectPath, setRedirectPath] = useState<string>("/");
  const [showInstallInfo, setShowInstallInfo] = useState(false);
  const [info, setInfo] = useState<InvitationInfo | null>(null);

  const token = searchParams.get("token");
  const invitationType = (searchParams.get("type") || "club") as "club" | "category";
  const returnUrl = `/accept-invitation?token=${token}${invitationType === "category" ? "&type=category" : ""}`;

  // Fetch invitation info (public RPC)
  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Lien d'invitation invalide");
      return;
    }
    (async () => {
      const { data, error } = await (supabase as any).rpc("get_invitation_info", {
        _token: token,
        _kind: invitationType,
      });
      if (error || !data?.success) {
        setStatus("error");
        setMessage(data?.error || "Invitation introuvable ou expirée");
        return;
      }
      setInfo(data as InvitationInfo);
      // Wait for auth resolution to decide next step
    })();
  }, [token, invitationType]);

  // Decide: if signed in → auto-accept; otherwise show chooser
  useEffect(() => {
    if (!info || authLoading || !token) return;
    if (status !== "loading") return;
    if (user) {
      setStatus("accepting");
      if (invitationType === "category") acceptCategoryInvitation(token);
      else acceptClubInvitation(token);
    } else {
      setStatus("choose");
    }
  }, [info, user, authLoading, token, invitationType, status]);

  const acceptClubInvitation = async (token: string) => {
    try {
      const { data, error } = await (supabase as any).rpc("accept_club_invitation", { _token: token });
      if (error) throw error;
      const result = data as { success: boolean; error?: string; club_id?: string };
      if (result.success && result.club_id) {
        setStatus("success");
        setMessage("Invitation acceptée avec succès !");
        setRedirectPath(`/clubs/${result.club_id}`);
        setShowInstallInfo(true);
      } else {
        setStatus("error");
        setMessage(result.error || "Erreur lors de l'acceptation de l'invitation");
      }
    } catch (e: any) {
      setStatus("error");
      setMessage(e.message || "Une erreur est survenue");
    }
  };

  const acceptCategoryInvitation = async (token: string) => {
    try {
      const { data, error } = await (supabase as any).rpc("accept_category_invitation", { _token: token });
      if (error) throw error;
      const result = data as { success: boolean; error?: string; category_id?: string };
      if (result.success && result.category_id) {
        setStatus("success");
        setMessage("Invitation acceptée avec succès !");
        const { data: categoryData } = await supabase
          .from("categories")
          .select("club_id")
          .eq("id", result.category_id)
          .single();
        const path = categoryData?.club_id
          ? `/clubs/${categoryData.club_id}/categories/${result.category_id}`
          : "/";
        setRedirectPath(path);
        setShowInstallInfo(true);
      } else {
        setStatus("error");
        setMessage(result.error || "Erreur lors de l'acceptation de l'invitation");
      }
    } catch (e: any) {
      setStatus("error");
      setMessage(e.message || "Une erreur est survenue");
    }
  };

  const goAuth = (tab: "login" | "signup") => {
    const params = new URLSearchParams();
    params.set("redirect", returnUrl);
    params.set("tab", tab);
    if (info?.email) params.set("email", info.email);
    navigate(`/auth?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <Card className="bg-gradient-card shadow-md">
          <CardHeader>
            <CardTitle className="text-center">Invitation</CardTitle>
            {info?.club_name && (
              <CardDescription className="text-center pt-2 space-y-1">
                <div className="flex items-center justify-center gap-2 text-foreground">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{info.club_name}</span>
                </div>
                {info.category_name && (
                  <div className="flex items-center justify-center gap-2 text-foreground">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="font-medium">{info.category_name}</span>
                  </div>
                )}
                {info.category_names && info.category_names.length > 0 && (
                  <div className="flex items-center justify-center gap-2 text-foreground flex-wrap">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="font-medium">{info.category_names.join(", ")}</span>
                  </div>
                )}
                {info.email && (
                  <div className="text-xs text-muted-foreground pt-1">
                    Invitation envoyée à <span className="font-medium text-foreground">{info.email}</span>
                  </div>
                )}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            {(status === "loading" || status === "accepting") && (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-center text-muted-foreground">
                  {status === "accepting" ? "Acceptation de votre invitation..." : "Chargement..."}
                </p>
              </>
            )}

            {status === "choose" && (
              <div className="w-full space-y-3">
                <p className="text-sm text-center text-muted-foreground">
                  Pour rejoindre {info?.club_name || "le club"}, choisissez :
                </p>
                <Button className="w-full gap-2" onClick={() => goAuth("signup")}>
                  <UserPlus className="h-4 w-4" />
                  Première connexion — Créer mon compte
                </Button>
                <Button variant="outline" className="w-full gap-2" onClick={() => goAuth("login")}>
                  <LogIn className="h-4 w-4" />
                  J'ai déjà un compte — Se connecter
                </Button>
                <p className="text-xs text-center text-muted-foreground pt-2">
                  Utilisez bien l'adresse <span className="font-medium text-foreground">{info?.email}</span> pour que l'invitation se valide automatiquement.
                </p>
              </div>
            )}

            {status === "success" && (
              <>
                <CheckCircle className="h-12 w-12 text-green-500" />
                <p className="text-center font-medium">{message}</p>
                {!showInstallInfo && <p className="text-sm text-muted-foreground">Redirection...</p>}
              </>
            )}

            {status === "error" && (
              <>
                <XCircle className="h-12 w-12 text-destructive" />
                <p className="text-center font-medium text-destructive">{message}</p>
                <Button onClick={() => navigate("/")}>Retour à l'accueil</Button>
              </>
            )}
          </CardContent>
        </Card>

        {showInstallInfo && (
          <InstallInstructions redirectPath={redirectPath} showDismiss={false} />
        )}
      </div>
    </div>
  );
}
