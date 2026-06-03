// Visualisation des stats avancées d'un bloc bowling (technique + objectifs résultat).
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import {
  computeTechnicalBlockStats,
  type ThrowResultRow,
  type CombinationStat,
} from "@/lib/bowling/technicalBlockStats";

interface Props {
  throws: ThrowResultRow[];
  selectedParams: string[];
  selectedOutcomes: string[];
}

function qualityColor(q: number): string {
  if (q === 100) return "bg-emerald-500/70";
  if (q >= 75) return "bg-emerald-500/50";
  if (q >= 50) return "bg-amber-500/60";
  return "bg-rose-500/60";
}

const InfoHint = ({ text }: { text: string }) => (
  <TooltipProvider delayDuration={150}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label="Explication" className="text-muted-foreground hover:text-foreground transition-colors">
          <Info className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[260px] text-[11px] leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const Kpi = ({
  label,
  value,
  hint,
  accent,
  info,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
  info?: string;
}) => (
  <Card className={cn("p-3", accent)}>
    <div className="flex items-center gap-1">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
      {info && <InfoHint text={info} />}
    </div>
    <p className="text-2xl font-bold">{value}</p>
    {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
  </Card>
);

export function BowlingTechnicalBlockStats({ throws, selectedParams, selectedOutcomes }: Props) {
  const stats = computeTechnicalBlockStats(throws, selectedParams, selectedOutcomes);
  if (stats.totalThrows === 0 || stats.criteria.length === 0) return null;

  const techCrit = stats.perCriterion.filter((c) => c.category === "technical");
  const resCrit = stats.perCriterion.filter((c) => c.category === "result");

  // Sort combinations to show the most relevant (size desc then pct desc)
  const combos: CombinationStat[] = [...stats.combinations].sort((a, b) => {
    if (b.ids.length !== a.ids.length) return b.ids.length - a.ids.length;
    return b.pct - a.pct;
  });

  return (
    <Card className="p-3 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Statistiques du bloc
        </p>
        <Badge variant="outline" className="text-[10px]">{stats.totalThrows} lancers</Badge>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed -mt-2">
        Chaque lancer est noté sur <span className="font-medium text-foreground">{stats.criteria.length} critère{stats.criteria.length > 1 ? "s" : ""}</span> ({techCrit.length} technique{techCrit.length > 1 ? "s" : ""} + {resCrit.length} objectif{resCrit.length > 1 ? "s" : ""} de résultat). Les pourcentages ci-dessous indiquent la part de lancers du bloc qui remplissent chaque condition.
      </p>

      {/* A. Cartes principales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Kpi
          label="Réussite parfaite"
          value={`${stats.perfectPct}%`}
          hint="Critères tech. + objectifs"
          accent="bg-emerald-500/5 border-emerald-500/20"
          info="% de lancers où TOUS les critères techniques ET TOUS les objectifs de résultat sont validés. C'est le score le plus exigeant."
        />
        <Kpi
          label="Tech. complète"
          value={`${stats.fullTechnicalPct}%`}
          hint={`${techCrit.length} critères`}
          accent="bg-primary/5"
          info="% de lancers où tous les critères TECHNIQUES sont validés (peu importe le résultat de la quille)."
        />
        <Kpi
          label="Objectifs OK"
          value={`${stats.fullResultPct}%`}
          hint={`${resCrit.length} objectif${resCrit.length > 1 ? "s" : ""}`}
          accent="bg-amber-500/5"
          info="% de lancers où tous les objectifs de RÉSULTAT sont atteints (ex : boule en poche, strike…), peu importe la technique."
        />
        <Kpi
          label="Score qualité moyen"
          value={`${stats.averageQuality}%`}
          hint={`Min ${stats.worstQuality}% · Max ${stats.bestQuality}%`}
          info="Moyenne, sur tous les lancers, du % de critères validés par lancer. 100% = tout coché, 0% = rien coché."
        />
      </div>

      {/* Répartition qualité */}
      <div>
        <div className="flex items-center gap-1 mb-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Répartition des lancers par qualité</p>
          <InfoHint text="Nombre de lancers tombant dans chaque tranche de score qualité (% de critères validés sur le lancer)." />
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-center">
            <p className="text-lg font-bold">{stats.qualityBuckets.perfect}</p>
            <p className="text-[10px] text-muted-foreground">à 100%</p>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 text-center">
            <p className="text-lg font-bold">{stats.qualityBuckets.high}</p>
            <p className="text-[10px] text-muted-foreground">75-99%</p>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-center">
            <p className="text-lg font-bold">{stats.qualityBuckets.mid}</p>
            <p className="text-[10px] text-muted-foreground">50-74%</p>
          </div>
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-2 text-center">
            <p className="text-lg font-bold">{stats.qualityBuckets.low}</p>
            <p className="text-[10px] text-muted-foreground">&lt; 50%</p>
          </div>
        </div>
      </div>

      {/* B. Barres par critère */}
      {techCrit.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
              Par critère technique
            </p>
            <InfoHint text="Pour chaque critère technique (vitesse, axe, rotation…), % de lancers du bloc où ce critère est validé. Tu vois lequel te pose problème." />
          </div>
          {techCrit.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-xs">
              <span className="w-32 sm:w-40 truncate">{s.label}</span>
              <div className="flex-1 h-4 bg-muted rounded relative overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-emerald-500/60" style={{ width: `${s.pct}%` }} />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold">
                  {s.pct}% · {s.ok}/{s.total}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      {resCrit.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
              Par objectif de résultat
            </p>
            <InfoHint text="Pour chaque objectif (ex : boule en poche, strike, spare…), % de lancers du bloc qui l'ont atteint." />
          </div>
          {resCrit.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-xs">
              <span className="w-32 sm:w-40 truncate">{s.label}</span>
              <div className="flex-1 h-4 bg-muted rounded relative overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-amber-500/60" style={{ width: `${s.pct}%` }} />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold">
                  {s.pct}% · {s.ok}/{s.total}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* F. Matrice de combinaison */}
      {combos.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
              Matrice de combinaison
            </p>
            <InfoHint text="Combinaisons de critères validés ensemble. Exemple : « Vitesse − + Axe 0° + Boule en poche · 50% · 1/2 » signifie que 1 lancer sur 2 (50%) du bloc a validé ces 3 critères en même temps. Aide à identifier les combos gagnants et ceux à travailler." />
          </div>
          <div className="rounded-lg border border-border/60 overflow-hidden max-h-56 overflow-y-auto">
            <table className="w-full text-xs">
              <tbody>
                {combos.map((c) => (
                  <tr key={c.ids.join("|")} className="border-b last:border-b-0 border-border/40">
                    <td className="p-1.5 align-top">
                      <div className="flex flex-wrap gap-1">
                        {c.labels.map((l, i) => (
                          <Badge key={i} variant="outline" className="text-[10px]">{l}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="p-1.5 text-right whitespace-nowrap font-semibold">
                      {c.pct}% <span className="text-muted-foreground font-normal">· {c.ok}/{stats.totalThrows}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* C. Tableau lancer par lancer */}
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
          Détail lancer par lancer
        </p>
        <div className="rounded-lg border border-border/60 overflow-x-auto max-h-72 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-[10px]">#</TableHead>
                {stats.criteria.map((c) => (
                  <TableHead key={c.id} className="text-[10px] whitespace-nowrap">
                    {c.label}
                  </TableHead>
                ))}
                <TableHead className="text-[10px]">Qualité</TableHead>
                <TableHead className="text-[10px]">Parfait</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.perThrow.map((t) => (
                <TableRow key={t.throw_number}>
                  <TableCell className="text-[11px] font-semibold">{t.throw_number}</TableCell>
                  {stats.criteria.map((c) => {
                    const v = t.results[c.id];
                    return (
                      <TableCell key={c.id} className="text-center">
                        {v === true && <span className="text-emerald-600 font-bold">✓</span>}
                        {v === false && <span className="text-rose-600 font-bold">✗</span>}
                        {v === null && <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    );
                  })}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <div className="w-12 h-2 bg-muted rounded overflow-hidden">
                        <div className={cn("h-full", qualityColor(t.quality_score))} style={{ width: `${t.quality_score}%` }} />
                      </div>
                      <span className="text-[10px] font-semibold">{t.quality_score}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {t.perfect_success ? (
                      <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 border-emerald-500/30">Oui</Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Non</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* D. Analyse automatique */}
      {stats.insight && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5">
          <p className="text-[10px] uppercase tracking-wide text-primary font-semibold mb-1">Analyse</p>
          <p className="text-xs text-foreground/90 leading-relaxed">{stats.insight}</p>
        </div>
      )}
    </Card>
  );
}
