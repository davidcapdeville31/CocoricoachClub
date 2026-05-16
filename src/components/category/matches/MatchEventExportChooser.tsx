import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, User, UsersRound, Loader2, FileSpreadsheet, Download } from "lucide-react";
import { toast } from "sonner";
import {
  exportTeamSportEventPdf,
  exportTeamSportEventExcel,
  type ExportMatchInfo,
} from "@/lib/teamSports/teamSportsEventExport";
import type { MatchEvent } from "@/components/category/matches/live/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "pdf" or "excel" */
  format: "pdf" | "excel";
  categoryId: string;
  match: ExportMatchInfo;
  ourTeamName: string;
}

type Scope = "team" | "all_players" | "single_player";

export function MatchEventExportChooser({
  open,
  onOpenChange,
  format,
  categoryId,
  match,
  ourTeamName,
}: Props) {
  const [scope, setScope] = useState<Scope>("team");
  const [playerId, setPlayerId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setScope("team");
      setPlayerId("");
    }
  }, [open]);

  // Fetch events + players in parallel when dialog opens
  const { data: events = [], isLoading: loadingEvents } = useQuery({
    queryKey: ["match_export_events", match.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_events" as any)
        .select("*")
        .eq("match_id", match.id);
      if (error) throw error;
      return (data ?? []) as unknown as MatchEvent[];
    },
  });

  const { data: players = [], isLoading: loadingPlayers } = useQuery({
    queryKey: ["match_export_players", categoryId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, first_name, name, position, avatar_url")
        .eq("category_id", categoryId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const playersWithEvents = useMemo(() => {
    const ids = new Set(events.map((e) => e.player_id).filter(Boolean));
    return (players as any[]).filter((p) => ids.has(p.id));
  }, [events, players]);

  const playersToShow = playersWithEvents.length > 0 ? playersWithEvents : (players as any[]);

  const handleExport = async () => {
    if (scope === "single_player" && !playerId) {
      toast.error("Sélectionne un joueur");
      return;
    }
    setSubmitting(true);
    try {
      const args = {
        categoryId,
        match,
        events,
        players: players as any[],
        ourTeamName,
        mode: scope,
        playerId: scope === "single_player" ? playerId : undefined,
      } as const;
      if (format === "pdf") await exportTeamSportEventPdf(args);
      else await exportTeamSportEventExcel(args);
      toast.success("Export généré");
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(`Erreur lors de l'export : ${e?.message || "inconnue"}`);
    } finally {
      setSubmitting(false);
    }
  };

  const loading = loadingEvents || loadingPlayers;
  const noEvents = !loading && events.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {format === "pdf" ? <Download className="h-5 w-5" /> : <FileSpreadsheet className="h-5 w-5" />}
            Exporter le rapport {format === "pdf" ? "PDF" : "Excel"}
          </DialogTitle>
          <DialogDescription>
            {match.is_home ? "vs" : "@"} {match.opponent}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement des données…
          </div>
        )}

        {!loading && noEvents && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Aucun événement enregistré sur ce match. Le rapport sera vide.
          </p>
        )}

        {!loading && (
          <div className="space-y-3 py-2">
            <ScopeButton
              icon={<Users className="h-5 w-5" />}
              title="Rapport d'équipe"
              description="Toutes les stats globales de l'équipe + tableau des contributions par joueur"
              selected={scope === "team"}
              onSelect={() => setScope("team")}
            />
            <ScopeButton
              icon={<UsersRound className="h-5 w-5" />}
              title="Tous les joueurs"
              description="Un rapport individuel détaillé pour chaque joueur ayant participé"
              selected={scope === "all_players"}
              onSelect={() => setScope("all_players")}
            />
            <ScopeButton
              icon={<User className="h-5 w-5" />}
              title="Un joueur en particulier"
              description="Rapport détaillé pour un seul athlète"
              selected={scope === "single_player"}
              onSelect={() => setScope("single_player")}
            />

            {scope === "single_player" && (
              <Select value={playerId} onValueChange={setPlayerId}>
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder="Sélectionne un joueur" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {playersToShow.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                      Aucun joueur disponible
                    </div>
                  ) : (
                    playersToShow.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {`${p.first_name ?? ""} ${p.name ?? ""}`.trim() || "Athlète"}
                        {p.position ? ` — ${p.position}` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={handleExport} disabled={submitting || loading}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Génération…
              </>
            ) : (
              <>
                {format === "pdf" ? <Download className="h-4 w-4 mr-2" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                Télécharger
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScopeButton({
  icon,
  title,
  description,
  selected,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-start gap-3 p-3 rounded-2xl border text-left transition-all ${
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/30 shadow-sm"
          : "border-border hover:border-primary/40 hover:bg-accent/40"
      }`}
    >
      <div className={`mt-0.5 shrink-0 ${selected ? "text-primary" : "text-muted-foreground"}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
      </div>
    </button>
  );
}
