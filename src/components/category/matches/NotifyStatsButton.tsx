import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Bell, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface NotifyStatsButtonProps {
  matchId: string;
  categoryId: string;
  /** Optional override for button label */
  label?: string;
  /** Show as small/icon variant inside footers */
  size?: "default" | "sm";
  variant?: "default" | "outline" | "secondary";
  className?: string;
  /** Disable the button (e.g. while saving) */
  disabled?: boolean;
}

/**
 * Bouton "Notifier" — envoie une push + email à tous les athlètes ET au staff
 * d'une catégorie pour les prévenir que les stats d'une compétition sont disponibles.
 * Insère également une notification in-app pour chaque destinataire.
 */
export function NotifyStatsButton({
  matchId,
  categoryId,
  label = "Notifier",
  size = "default",
  variant = "outline",
  className,
  disabled,
}: NotifyStatsButtonProps) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const handleNotify = async () => {
    setSending(true);
    try {
      // 1) Récupérer les infos du match (date, opponent, sport, club)
      const { data: match, error: matchError } = await supabase
        .from("matches")
        .select("id, match_date, opponent, competition, event_type, category_id, categories!inner(name, club_id, rugby_type, clubs!inner(name))")
        .eq("id", matchId)
        .maybeSingle();

      if (matchError || !match) throw new Error("Compétition introuvable");

      const cat = (match.categories as any) || {};
      const club = cat.clubs || {};
      const matchDateLabel = match.match_date
        ? format(new Date(match.match_date), "EEEE d MMMM yyyy", { locale: fr })
        : "";
      const opponentLabel = match.opponent ? ` vs ${match.opponent}` : "";
      const competitionLabel = match.competition ? ` (${match.competition})` : "";

      const title = "📊 Stats de compétition disponibles";
      const message = `Les statistiques de la compétition${opponentLabel}${competitionLabel} du ${matchDateLabel} sont disponibles. Consulte-les dès maintenant !`;
      const url = `https://cocoricoachclub.com/categories/${categoryId}?tab=matches&match=${matchId}`;

      // 2) Récupérer les destinataires (athlètes + staff) via category_members + clubs
      // Athlètes: players.user_id de la catégorie
      const { data: players } = await supabase
        .from("players")
        .select("user_id")
        .eq("category_id", categoryId)
        .not("user_id", "is", null);
      const athleteUserIds = (players || []).map((p: any) => p.user_id).filter(Boolean) as string[];

      // Staff: club_members du club avec rôle staff (admin/coach/physio/doctor/viewer)
      const { data: staffMembers } = await supabase
        .from("club_members")
        .select("user_id, role")
        .eq("club_id", cat.club_id)
        .in("role", ["admin", "coach", "physio", "doctor", "viewer", "prepa_physique", "administratif"]);
      // Owner du club aussi
      const { data: clubOwner } = await supabase
        .from("clubs")
        .select("user_id")
        .eq("id", cat.club_id)
        .maybeSingle();
      const staffUserIds = [
        ...((staffMembers || []).map((m: any) => m.user_id).filter(Boolean) as string[]),
        ...(clubOwner?.user_id ? [clubOwner.user_id] : []),
      ];

      const allUserIds = Array.from(new Set([...athleteUserIds, ...staffUserIds]));

      if (allUserIds.length === 0) {
        toast.warning("Aucun destinataire à notifier dans cette catégorie.");
        setSending(false);
        setOpen(false);
        return;
      }

      // 3) Envoyer push + email via send-targeted-notification
      const { error: notifError } = await supabase.functions.invoke(
        "send-targeted-notification",
        {
          body: {
            title,
            message,
            channels: ["push", "email"],
            event_type: "match",
            target_user_ids: allUserIds,
            url,
            event_details: {
              date: matchDateLabel,
            },
          },
        }
      );

      if (notifError) {
        console.error("[NotifyStats] push/email error:", notifError);
        // On continue quand même pour les notifs in-app
      }

      // 4) Insérer une notification in-app pour chaque destinataire (centre cloche)
      const notifRows = allUserIds.map((uid) => ({
        user_id: uid,
        category_id: categoryId,
        notification_type: "match_stats_published",
        title,
        message,
        priority: "normal",
        metadata: {
          match_id: matchId,
          opponent: match.opponent,
          match_date: match.match_date,
          competition: match.competition,
          url,
        },
      }));
      const { error: insertError } = await supabase
        .from("notifications")
        .insert(notifRows);
      if (insertError) {
        console.warn("[NotifyStats] in-app insert error:", insertError);
      }

      toast.success(
        `Notification envoyée à ${athleteUserIds.length} athlète(s) et ${staffUserIds.length} membre(s) du staff.`
      );
      setOpen(false);
    } catch (e: any) {
      console.error("[NotifyStats] error:", e);
      toast.error(e?.message || "Erreur lors de l'envoi de la notification");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <Bell className="h-4 w-4 mr-1" />
        {label}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="rounded-2xl backdrop-blur-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Notifier les athlètes et le staff ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Une notification <strong>push</strong> et un <strong>email</strong>{" "}
              vont être envoyés à tous les athlètes et au staff de la catégorie
              pour leur indiquer que les statistiques de cette compétition sont
              disponibles. Ils pourront consulter leurs stats directement depuis
              leur espace.
              <br />
              <br />
              <span className="text-xs text-muted-foreground">
                Chaque destinataire reçoit selon ses préférences personnelles.
                La notification apparaît également dans le centre de notifications.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleNotify();
              }}
              disabled={sending}
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Envoi…
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4 mr-1" />
                  Envoyer la notification
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
