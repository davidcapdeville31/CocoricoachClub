import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Apple, Smartphone, Share, Plus, MoreVertical, Download, Monitor, Check } from "lucide-react";

/**
 * Always-visible PWA installation guide for iOS and Android.
 * Shown permanently in Settings (staff + athlete) so users can refer to it anytime.
 */
export function PWAInstallGuide() {
  const isInstalled =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true);

  return (
    <Card className="rounded-2xl shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5 text-primary" />
          Installer l'application sur votre téléphone
        </CardTitle>
        <CardDescription>
          Ajoutez CocoriCoach Club à votre écran d'accueil pour un accès rapide,
          des notifications fiables et une utilisation hors ligne.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isInstalled && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/30">
            <Check className="h-5 w-5 text-green-600" />
            <p className="text-sm font-medium text-green-700 dark:text-green-300">
              L'application est déjà installée sur cet appareil.
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {/* iOS */}
          <div className="rounded-2xl border bg-muted/40 p-4 space-y-3">
            <div className="flex items-center gap-2 font-semibold">
              <Apple className="h-5 w-5" />
              iPhone / iPad (Safari)
            </div>
            <ol className="space-y-2 text-sm">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">1</span>
                <span>
                  Ouvrez le site dans <strong>Safari</strong> (pas Chrome).
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">2</span>
                <span className="flex flex-wrap items-center gap-1">
                  Touchez l'icône <Share className="inline h-4 w-4" /> <strong>Partager</strong> en bas de l'écran.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">3</span>
                <span className="flex flex-wrap items-center gap-1">
                  Sélectionnez <Plus className="inline h-4 w-4" /> <strong>« Sur l'écran d'accueil »</strong>.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">4</span>
                <span>
                  Confirmez en touchant <strong>Ajouter</strong>.
                </span>
              </li>
            </ol>
          </div>

          {/* Android */}
          <div className="rounded-2xl border bg-muted/40 p-4 space-y-3">
            <div className="flex items-center gap-2 font-semibold">
              <Smartphone className="h-5 w-5" />
              Android (Chrome)
            </div>
            <ol className="space-y-2 text-sm">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">1</span>
                <span>
                  Ouvrez le site dans <strong>Chrome</strong>.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">2</span>
                <span className="flex flex-wrap items-center gap-1">
                  Touchez le menu <MoreVertical className="inline h-4 w-4" /> en haut à droite.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">3</span>
                <span>
                  Choisissez <strong>« Installer l'application »</strong> ou <strong>« Ajouter à l'écran d'accueil »</strong>.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">4</span>
                <span>
                  Validez en touchant <strong>Installer</strong>.
                </span>
              </li>
            </ol>
          </div>
        </div>

        {/* Desktop bonus */}
        <div className="rounded-2xl border bg-muted/30 p-4">
          <div className="flex items-center gap-2 font-semibold mb-1.5">
            <Monitor className="h-5 w-5" />
            Sur ordinateur (Chrome / Edge)
          </div>
          <p className="text-sm text-muted-foreground">
            Cliquez sur l'icône d'installation <Download className="inline h-3.5 w-3.5" /> dans la barre d'adresse,
            ou ouvrez le menu du navigateur et sélectionnez <strong>« Installer CocoriCoach Club »</strong>.
          </p>
        </div>

        <p className="text-xs text-muted-foreground italic">
          Astuce : une fois installée, l'application se lance comme une vraie app native, sans la barre du navigateur.
        </p>
      </CardContent>
    </Card>
  );
}

export default PWAInstallGuide;
