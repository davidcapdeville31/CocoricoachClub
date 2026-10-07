import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, History } from "lucide-react";

interface Props {
  injuries: any[];
  illnesses: any[];
  to: Date;
}

type Row = {
  id: string;
  kind: "injury" | "illness";
  player: string;
  playerId: string;
  zone: string;
  start: string;
  end: string | null;
  days: number;
  ongoing: boolean;
};

const DAY = 1000 * 60 * 60 * 24;
const bucketOf = (d: number) => (d <= 10 ? "short" : d <= 30 ? "medium" : "long");

export function InjuryHistoryPanel({ injuries, illnesses, to }: Props) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<"all" | "injury" | "illness">("all");
  const [player, setPlayer] = useState("all");
  const [zone, setZone] = useState("all");
  const [bucket, setBucket] = useState("all");

  const rows = useMemo<Row[]>(() => {
    const mk = (i: any, k: Row["kind"]): Row => {
      const start = k === "injury" ? i.injury_date : i.illness_date;
      const endD = i.actual_return_date ? new Date(i.actual_return_date) : to;
      return {
        id: i.id,
        kind: k,
        player: i.players?.name || "Athlète",
        playerId: i.player_id,
        zone: ((k === "injury" ? i.injury_type : i.illness_type) || "—").trim(),
        start,
        end: i.actual_return_date,
        days: Math.max(0, Math.round((endD.getTime() - new Date(start).getTime()) / DAY)),
        ongoing: !i.actual_return_date,
      };
    };
    return [...injuries.map((i) => mk(i, "injury")), ...illnesses.map((i) => mk(i, "illness"))].sort((a, b) =>
      b.start.localeCompare(a.start),
    );
  }, [injuries, illnesses, to]);

  const buckets = (k: Row["kind"]) => {
    const r = { short: 0, medium: 0, long: 0 };
    rows.filter((x) => x.kind === k).forEach((x) => r[bucketOf(x.days)]++);
    return r;
  };
  const inj = buckets("injury");
  const ill = buckets("illness");

  const players = useMemo(
    () => Array.from(new Map(rows.map((r) => [r.playerId, r.player])).entries()).sort((a, b) => a[1].localeCompare(b[1])),
    [rows],
  );
  const zones = useMemo(
    () =>
      Array.from(new Set(rows.filter((r) => kind === "all" || r.kind === kind).map((r) => r.zone))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [rows, kind],
  );

  const filtered = rows.filter(
    (r) =>
      (kind === "all" || r.kind === kind) &&
      (player === "all" || r.playerId === player) &&
      (zone === "all" || r.zone === zone) &&
      (bucket === "all" || bucketOf(r.days) === bucket),
  );

  const byZone = useMemo(() => {
    const m = new Map<string, { n: number; days: number }>();
    filtered.forEach((r) => {
      const c = m.get(r.zone) || { n: 0, days: 0 };
      c.n++;
      c.days += r.days;
      m.set(r.zone, c);
    });
    return Array.from(m.entries()).sort((a, b) => b[1].n - a[1].n);
  }, [filtered]);

  const BUCKETS = [
    { key: "short", label: t("health.injuryHistory.short", "≤ 10 j") },
    { key: "medium", label: t("health.injuryHistory.medium", "11 à 30 j") },
    { key: "long", label: t("health.injuryHistory.long", "+ de 30 j") },
  ] as const;

  const BucketBlock = ({ title, data, tone }: { title: string; data: Record<string, number>; tone: string }) => (
    <div className="rounded-2xl border bg-surface p-4">
      <div className="text-sm font-semibold mb-3">{title}</div>
      <div className="grid grid-cols-3 gap-2">
        {BUCKETS.map((b) => (
          <div key={b.key} className="rounded-xl bg-surface-sunken p-2 text-center">
            <div className={`text-xl font-bold ${tone}`}>{data[b.key]}</div>
            <div className="text-[11px] text-muted-foreground">{b.label}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Clock className="h-4 w-4" />
        {t("health.injuryHistory.durationTitle", "Répartition par durée d'indisponibilité")}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BucketBlock title={t("health.injuryHistory.injuries", "Blessures")} data={inj} tone="text-destructive" />
        <BucketBlock title={t("health.injuryHistory.illnesses", "Maladies")} data={ill} tone="text-orange-500" />
      </div>

      <h3 className="text-sm font-semibold flex items-center gap-2 pt-2">
        <History className="h-4 w-4" />
        {t("health.injuryHistory.historyTitle", "Historique détaillé")}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Select value={kind} onValueChange={(v: any) => { setKind(v); setZone("all"); }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("health.injuryHistory.allKinds", "Blessures + maladies")}</SelectItem>
            <SelectItem value="injury">{t("health.injuryHistory.injuries", "Blessures")}</SelectItem>
            <SelectItem value="illness">{t("health.injuryHistory.illnesses", "Maladies")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={player} onValueChange={setPlayer}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("health.injuryHistory.allAthletes", "Tous les athlètes")}</SelectItem>
            {players.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={zone} onValueChange={setZone}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("health.injuryHistory.allZones", "Toutes les zones / types")}</SelectItem>
            {zones.map((z) => <SelectItem key={z} value={z}>{z}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={bucket} onValueChange={setBucket}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("health.injuryHistory.allDurations", "Toutes les durées")}</SelectItem>
            {BUCKETS.map((b) => <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {byZone.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {byZone.map(([z, v]) => (
            <Badge key={z} variant="secondary" className="cursor-pointer" onClick={() => setZone(z)}>
              {z} · {v.n} · {v.days} j
            </Badge>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("health.injuryHistory.empty", "Aucun élément pour ces filtres.")}</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <div key={`${r.kind}-${r.id}`} className="flex items-center justify-between gap-3 p-3 rounded-xl border bg-surface">
              <div className="min-w-0">
                <div className="font-medium truncate">{r.player}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {r.kind === "injury" ? "🩹" : "🤒"} {r.zone} · {format(new Date(r.start), "dd/MM/yyyy")} →{" "}
                  {r.end ? format(new Date(r.end), "dd/MM/yyyy") : t("health.injuryHistory.ongoing", "en cours")}
                </div>
              </div>
              <Badge variant={r.days > 30 ? "destructive" : "outline"} className="shrink-0">{r.days} j</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
