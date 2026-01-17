import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type ErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
};

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo });
    // Keep a console log for debugging in preview environments.
    // eslint-disable-next-line no-console
    console.error("Unhandled UI error:", error, errorInfo);
  }

  private copyDetails = async () => {
    const { error, errorInfo } = this.state;
    const details = [
      "RugbyStrength Planner - erreur UI",
      `URL: ${window.location.href}`,
      `Date: ${new Date().toISOString()}`,
      "",
      error ? `Error: ${error.name}: ${error.message}` : "Error: unknown",
      error?.stack ? `\nStack:\n${error.stack}` : "",
      errorInfo?.componentStack ? `\nComponent stack:\n${errorInfo.componentStack}` : "",
    ].join("\n");

    await navigator.clipboard.writeText(details);
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Une erreur est survenue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTitle>Écran bloqué</AlertTitle>
              <AlertDescription>
                L’application a rencontré une erreur. Vous pouvez recharger la page ou copier les détails
                pour que je puisse identifier la cause exacte.
              </AlertDescription>
            </Alert>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => window.location.reload()}>
                Recharger
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  this.copyDetails()
                    .then(() => {})
                    .catch(() => {});
                }}
              >
                Copier les détails
              </Button>
              <Button variant="ghost" onClick={() => (window.location.href = "/auth")}>
                Retour connexion
              </Button>
            </div>

            <div className="text-sm text-muted-foreground">
              Astuce: si cela arrive juste après connexion, c’est souvent lié à une donnée manquante ou à un droit
              d’accès sur une requête.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}
