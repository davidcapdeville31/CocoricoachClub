import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, MailCheck, MailX, AlertCircle } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

export default function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "valid" | "error" | "success">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  // Validate token on load via GET to handle-email-unsubscribe
  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("Aucun token de désinscription trouvé dans l'URL.");
      return;
    }

    const validateToken = async () => {
      try {
        const response = await fetch(
          `${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          {
            headers: {
              apikey: supabaseAnonKey,
            },
          }
        );

        if (response.ok) {
          setStatus("valid");
        } else {
          const data = await response.json().catch(() => ({}));
          setStatus("error");
          setErrorMessage(data.error || "Ce lien de désinscription est invalide ou a déjà été utilisé.");
        }
      } catch {
        setStatus("error");
        setErrorMessage("Erreur de connexion. Vérifie ta connexion internet.");
      }
    };

    validateToken();
  }, [token, supabaseUrl, supabaseAnonKey]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setStatus("loading");

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({ token }),
      });

      if (response.ok) {
        setStatus("success");
      } else {
        const data = await response.json().catch(() => ({}));
        setStatus("error");
        setErrorMessage(data.error || "La désinscription a échoué.");
      }
    } catch {
      setStatus("error");
      setErrorMessage("Erreur de connexion lors de la désinscription.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <BrandLogo className="h-12 w-auto" />
          </div>
          <CardTitle className="text-2xl">Gérer tes emails</CardTitle>
          <CardDescription>
            {status === "loading" && "Vérification du lien en cours…"}
            {status === "valid" && "Confirme ta désinscription aux emails de CocoriCoach Club."}
            {status === "success" && "Tu es désinscrit des emails."}
            {status === "error" && "Problème avec le lien de désinscription."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {status === "loading" && (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          )}

          {status === "valid" && (
            <>
              <MailX className="h-12 w-12 text-muted-foreground" />
              <p className="text-center text-sm text-muted-foreground">
                Tu ne recevras plus d'emails de notification de la part de CocoriCoach Club.
                <br /><br />
                <strong>Tu peux toujours te reconnecter à l'application à tout moment.</strong>
              </p>
              <Button onClick={handleUnsubscribe} className="w-full">
                Se désinscrire
              </Button>
            </>
          )}

          {status === "success" && (
            <>
              <MailCheck className="h-12 w-12 text-green-500" />
              <p className="text-center text-sm text-muted-foreground">
                Tu as été désinscrit avec succès. Tu ne recevras plus d'emails de notification.
              </p>
              <Button variant="outline" onClick={() => window.location.href = "/"} className="w-full">
                Retour à l'accueil
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <AlertCircle className="h-12 w-12 text-destructive" />
              <p className="text-center text-sm text-muted-foreground">
                {errorMessage}
              </p>
              <Button variant="outline" onClick={() => window.location.href = "/"} className="w-full">
                Retour à l'accueil
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
