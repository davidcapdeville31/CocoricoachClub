// ============================================================
// OpponentScoutingSheet — Fiche scouting Judo haut niveau
// Dialog plein écran, 6+ sections accordéon, autosave debouncé
// ============================================================
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity,
  Brain,
  Dumbbell,
  Flame,
  Hand,
  Layers,
  Move,
  Shield,
  Swords,
  Target,
  Trash2,
  Plus,
  X,
  Sparkles,
  AlertTriangle,
  Eye,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOpponentScouting, type ScoutingProfile } from "./useOpponentScouting";
import {
  ChipGroup,
  DangerStars,
  MiniStat,
  SaveIndicator,
  SectionCard,
  SliderWithLabels,
} from "./scoutingWidgets";
import {
  CARDIO_LEVELS,
  COMMON_SHIDOS,
  COMMON_TECHNIQUES,
  DANGER_PHASES,
  DISPLACEMENTS,
  DISTANCES,
  END_GAME_BEHAVIOR,
  GLOBAL_STYLES,
  GRIP_ZONES,
  INTENSITIES,
  KUMIKATA_BEHAVIOR,
  KUMIKATA_OBJECTIVES,
  KUMIKATA_STYLES,
  MENTAL_BEHAVIORS,
  NEWAZA_BEHAVIOR,
  NEWAZA_EXITS,
  NEWAZA_STYLES,
  PHYSICAL_TYPES,
  POSTURES,
  REFEREE_BEHAVIOR,
  RHYTHMS,
  SCORE_MANAGEMENT,
  TIMINGS,
  WAZA_CATEGORIES,
  TONE_ACTIVE,
} from "./scoutingConstants";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  opponentId: string | null;
}

// ============================================================
// Tokui-waza row component
// ============================================================
interface TokuiWazaItem {
  name: string;
  category: string;
  danger: number;
  frequency: number;
  success_rate: number;
  direction?: string;
  trigger?: string;
  ground_transition?: boolean;
  is_favorite?: boolean;
  is_surprise?: boolean;
  notes?: string;
}

function TokuiWazaEditor({
  items,
  onChange,
}: {
  items: TokuiWazaItem[];
  onChange: (items: TokuiWazaItem[]) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<string>("te_waza");

  const add = () => {
    if (!newName.trim()) return;
    onChange([
      ...items,
      {
        name: newName.trim(),
        category: newCategory,
        danger: 3,
        frequency: 50,
        success_rate: 50,
      },
    ]);
    setNewName("");
  };

  const update = (i: number, patch: Partial<TokuiWazaItem>) => {
    const next = items.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };

  const remove = (i: number) => onChange(items.filter((_, j) => j !== i));

  return (
    <div className="space-y-3">
      {/* Ajout rapide */}
      <div className="flex flex-wrap items-end gap-2 p-3 rounded-xl bg-muted/40 border border-dashed">
        <div className="flex-1 min-w-[180px] space-y-1">
          <Label className="text-[10px] uppercase text-muted-foreground">Nouvelle technique</Label>
          <Input
            list="judo-techniques-list"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ex: Uchi-mata"
            className="h-9"
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <datalist id="judo-techniques-list">
            {COMMON_TECHNIQUES.map((t) => <option key={t} value={t} />)}
          </datalist>
        </div>
        <div className="w-[140px] space-y-1">
          <Label className="text-[10px] uppercase text-muted-foreground">Catégorie</Label>
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
          >
            {WAZA_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </div>
        <Button size="sm" className="h-9" onClick={add} disabled={!newName.trim()}>
          <Plus className="h-4 w-4 mr-1" />
          Ajouter
        </Button>
      </div>

      {/* Liste */}
      {items.length === 0 ? (
        <div className="text-center py-6 text-xs text-muted-foreground italic">
          Aucune technique enregistrée. Ajoute les tokui-waza de cet adversaire.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it, i) => {
            const cat = WAZA_CATEGORIES.find((c) => c.key === it.category);
            return (
              <div
                key={i}
                className="rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b">
                  <Badge variant="secondary" className="text-[10px]">{cat?.label || it.category}</Badge>
                  <Input
                    value={it.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                    className="h-7 flex-1 min-w-[120px] font-semibold border-0 bg-transparent px-1 focus-visible:bg-background"
                  />
                  <DangerStars
                    value={it.danger}
                    onChange={(v) => update(i, { danger: v ?? 0 })}
                    size="sm"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() =>
                      update(i, { is_favorite: !it.is_favorite })
                    }
                    title="Favori"
                  >
                    <Sparkles
                      className={cn(
                        "h-3.5 w-3.5",
                        it.is_favorite ? "fill-amber-400 text-amber-500" : "text-muted-foreground",
                      )}
                    />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => remove(i)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3">
                  <SliderWithLabels
                    label="Fréquence"
                    value={it.frequency}
                    onChange={(v) => update(i, { frequency: v })}
                    unit="%"
                    leftLabel="Rare"
                    rightLabel="Permanente"
                    tone="control"
                  />
                  <SliderWithLabels
                    label="Réussite"
                    value={it.success_rate}
                    onChange={(v) => update(i, { success_rate: v })}
                    unit="%"
                    leftLabel="Faible"
                    rightLabel="Élite"
                    tone="physical"
                  />
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">Déclencheur</Label>
                    <Input
                      value={it.trigger || ""}
                      onChange={(e) => update(i, { trigger: e.target.value })}
                      placeholder="Ex: prise revers haute"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground">Direction</Label>
                    <Input
                      value={it.direction || ""}
                      onChange={(e) => update(i, { direction: e.target.value })}
                      placeholder="avant gauche"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 px-3 pb-3">
                  <label className="inline-flex items-center gap-1.5 text-[11px] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!!it.ground_transition}
                      onChange={(e) => update(i, { ground_transition: e.target.checked })}
                      className="rounded accent-violet-500"
                    />
                    Transition sol immédiate
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-[11px] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!!it.is_surprise}
                      onChange={(e) => update(i, { is_surprise: e.target.checked })}
                      className="rounded accent-orange-500"
                    />
                    Technique surprise
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// HEADER STICKY
// ============================================================
function ScoutingHeader({
  profile,
  saving,
  dirty,
  onClose,
}: {
  profile: ScoutingProfile;
  saving: boolean;
  dirty: boolean;
  onClose: () => void;
}) {
  const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
  return (
    <div className="sticky top-0 z-10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white border-b border-white/10">
      <div className="flex items-center gap-4 px-4 sm:px-6 py-4">
        {profile.photo_url ? (
          <img
            src={profile.photo_url}
            alt=""
            className="h-16 w-16 rounded-2xl object-cover ring-2 ring-white/20 shadow-xl"
          />
        ) : (
          <div className="h-16 w-16 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center ring-2 ring-white/20 shadow-xl">
            <span className="text-2xl font-bold">
              {(profile.last_name?.[0] || "?").toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{fullName || "Sans nom"}</h2>
            <SaveIndicator saving={saving} dirty={dirty} />
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-white/80">
            {profile.weight_category && (
              <Badge className="bg-white/15 text-white border-0 backdrop-blur">
                {profile.weight_category.replace(/^judo_/, "")}
              </Badge>
            )}
            {profile.age_category && (
              <Badge className="bg-white/15 text-white border-0 backdrop-blur">{profile.age_category}</Badge>
            )}
            {profile.handedness && profile.handedness !== "unknown" && (
              <Badge className="bg-white/15 text-white border-0 backdrop-blur">
                {profile.handedness === "left" ? "Gaucher" : profile.handedness === "right" ? "Droitier" : "Ambidextre"}
              </Badge>
            )}
            {profile.club_origin && <span>· {profile.club_origin}</span>}
            {profile.country && <span>· {profile.country}</span>}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wider">Danger</span>
            <DangerStars
              value={profile.danger_level ?? null}
              onChange={() => {}}
              readonly
              size="sm"
            />
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/15 shrink-0"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export function OpponentScoutingSheet({ open, onOpenChange, opponentId }: Props) {
  const { profile, isLoading, saving, dirty, update, flush } = useOpponentScouting(
    open ? opponentId : null,
  );

  const handleClose = async () => {
    await flush();
    onOpenChange(false);
  };

  // Helpers de patch par sous-bloc
  const patchGeneral = (k: string, v: any) =>
    update({ general_profile: { ...(profile?.general_profile || {}), [k]: v } });
  const patchKumikata = (k: string, v: any) =>
    update({ kumikata_profile: { ...(profile?.kumikata_profile || {}), [k]: v } });
  const patchAttack = (k: string, v: any) =>
    update({ attack_systems: { ...(profile?.attack_systems || {}), [k]: v } });
  const patchNewaza = (k: string, v: any) =>
    update({ newaza_profile: { ...(profile?.newaza_profile || {}), [k]: v } });
  const patchTactical = (k: string, v: any) =>
    update({ tactical_profile: { ...(profile?.tactical_profile || {}), [k]: v } });
  const patchPhysical = (k: string, v: any) =>
    update({ physical_profile: { ...(profile?.physical_profile || {}), [k]: v } });

  // Synthèse top 3 techniques (par danger × fréquence)
  const top3 = useMemo(() => {
    if (!profile?.tokui_waza) return [];
    return [...profile.tokui_waza]
      .sort((a: any, b: any) => (b.danger * b.frequency) - (a.danger * a.frequency))
      .slice(0, 3);
  }, [profile?.tokui_waza]);

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : handleClose())}>
      <DialogContent className="max-w-6xl w-[95vw] h-[92vh] p-0 gap-0 overflow-hidden flex flex-col">
        {isLoading || !profile ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Chargement du profil…
          </div>
        ) : (
          <>
            <ScoutingHeader profile={profile} saving={saving} dirty={dirty} onClose={handleClose} />

            <ScrollArea className="flex-1">
              <div className="p-4 sm:p-6 space-y-4 max-w-5xl mx-auto">
                {/* ============ STATS RAPIDES ============ */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <MiniStat
                    label="Techniques"
                    value={profile.tokui_waza?.length || 0}
                    tone="danger"
                  />
                  <MiniStat
                    label="Top arme"
                    value={top3[0]?.name || "—"}
                    tone="opportunism"
                  />
                  <MiniStat
                    label="Ne-waza"
                    value={
                      profile.newaza_profile?.ground_pct != null
                        ? `${100 - (profile.newaza_profile.ground_pct as number)}% sol`
                        : "—"
                    }
                    tone="newaza"
                  />
                  <MiniStat
                    label="Vidéos"
                    value={profile.video_sequences?.length || 0}
                    tone="control"
                  />
                </div>

                {/* ============ DANGER GLOBAL ============ */}
                <SectionCard
                  id="danger"
                  title="Niveau de danger global"
                  subtitle="Évaluation synthétique pour le coach"
                  icon={<AlertTriangle className="h-4 w-4" />}
                  tone="danger"
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <div>
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Danger
                      </Label>
                      <DangerStars
                        value={profile.danger_level ?? null}
                        onChange={(v) => update({ danger_level: v })}
                        size="lg"
                      />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <SliderWithLabels
                        label="Niveau de l'adversaire"
                        value={Number(profile.general_profile?.tactical_difficulty ?? 50)}
                        onChange={(v) => patchGeneral("tactical_difficulty", v)}
                        leftLabel="Adversaire abordable"
                        rightLabel="Adversaire redoutable"
                        unit=""
                        tone="danger"
                      />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <SliderWithLabels
                        label="Fiabilité des informations"
                        value={Number(profile.general_profile?.analysis_confidence ?? 50)}
                        onChange={(v) => patchGeneral("analysis_confidence", v)}
                        leftLabel="Hypothèse / peu de données"
                        rightLabel="Confirmé par vidéo"
                        unit=""
                        tone="control"
                      />
                    </div>
                  </div>
                </SectionCard>

                {/* ============ 1. PROFIL GÉNÉRAL ============ */}
                <SectionCard
                  id="general"
                  title="1. Profil général"
                  subtitle="Style global, intensité, rythme, mental, gestion du score"
                  icon={<Brain className="h-4 w-4" />}
                  tone="control"
                >
                  <ChipGroup
                    label="Style global"
                    options={GLOBAL_STYLES}
                    value={profile.general_profile?.global_style ?? null}
                    onChange={(v) => patchGeneral("global_style", v)}
                  />
                  <ChipGroup
                    label="Intensité"
                    multi
                    options={INTENSITIES}
                    value={profile.general_profile?.intensities ?? []}
                    onChange={(v) => patchGeneral("intensities", v)}
                  />
                  <ChipGroup
                    label="Rythme de combat"
                    multi
                    options={RHYTHMS}
                    value={profile.general_profile?.rhythms ?? []}
                    onChange={(v) => patchGeneral("rhythms", v)}
                  />
                  <ChipGroup
                    label="Comportement mental"
                    multi
                    options={MENTAL_BEHAVIORS}
                    value={profile.general_profile?.mental ?? []}
                    onChange={(v) => patchGeneral("mental", v)}
                  />
                  <ChipGroup
                    label="Gestion du score"
                    multi
                    options={SCORE_MANAGEMENT}
                    value={profile.general_profile?.score_mgmt ?? []}
                    onChange={(v) => patchGeneral("score_mgmt", v)}
                  />
                </SectionCard>

                {/* ============ 2. KUMIKATA ============ */}
                <SectionCard
                  id="kumikata"
                  title="2. Kumikata"
                  subtitle="Prises, garde, comportement mains"
                  icon={<Hand className="h-4 w-4" />}
                  tone="opportunism"
                >
                  <ChipGroup
                    label="Styles de garde"
                    multi
                    options={KUMIKATA_STYLES}
                    value={profile.kumikata_profile?.styles ?? []}
                    onChange={(v) => patchKumikata("styles", v)}
                  />
                  <ChipGroup
                    label="Objectifs de garde"
                    multi
                    options={KUMIKATA_OBJECTIVES}
                    value={profile.kumikata_profile?.objectives ?? []}
                    onChange={(v) => patchKumikata("objectives", v)}
                  />
                  <ChipGroup
                    label="Comportement mains"
                    multi
                    options={KUMIKATA_BEHAVIOR}
                    value={profile.kumikata_profile?.behavior ?? []}
                    onChange={(v) => patchKumikata("behavior", v)}
                  />
                  <ChipGroup
                    label="Zones de prise favorites"
                    multi
                    options={GRIP_ZONES}
                    value={profile.kumikata_profile?.zones ?? []}
                    onChange={(v) => patchKumikata("zones", v)}
                  />
                  <SliderWithLabels
                    label="Domination kumikata"
                    value={Number(profile.kumikata_profile?.domination ?? 50)}
                    onChange={(v) => patchKumikata("domination", v)}
                    leftLabel="Faible"
                    rightLabel="Extrêmement dominant"
                    unit="%"
                    tone="danger"
                  />
                </SectionCard>

                {/* ============ 3. TOKUI-WAZA ============ */}
                <SectionCard
                  id="tokui"
                  title="3. Tokui-waza / Arsenal offensif"
                  subtitle="Techniques préférées, dangerosité, fréquence, contexte"
                  icon={<Swords className="h-4 w-4" />}
                  tone="danger"
                  rightSlot={
                    top3.length > 0 && (
                      <div className="hidden md:flex items-center gap-1 mr-2">
                        {top3.map((t: any, i: number) => (
                          <Badge
                            key={i}
                            className={cn(
                              "text-[10px] border-0 text-white",
                              i === 0 ? "bg-rose-500" : i === 1 ? "bg-orange-500" : "bg-amber-500",
                            )}
                          >
                            {t.name}
                          </Badge>
                        ))}
                      </div>
                    )
                  }
                >
                  <TokuiWazaEditor
                    items={(profile.tokui_waza || []) as TokuiWazaItem[]}
                    onChange={(items) => update({ tokui_waza: items })}
                  />
                </SectionCard>

                {/* ============ 4. SYSTÈMES D'ATTAQUE ============ */}
                <SectionCard
                  id="attack"
                  title="4. Systèmes d'attaque"
                  subtitle="Enchaînements, timings, distances, phases dangereuses"
                  icon={<Target className="h-4 w-4" />}
                  tone="opportunism"
                  defaultOpen={false}
                >
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Enchaînements favoris (un par ligne)
                    </Label>
                    <Textarea
                      value={profile.attack_systems?.chains || ""}
                      onChange={(e) => patchAttack("chains", e.target.value)}
                      rows={4}
                      placeholder={"Ko-uchi → Uchi-mata\nOuchi → Harai\nSeoi → Ko-uchi"}
                      className="font-mono text-xs"
                    />
                  </div>
                  <ChipGroup
                    label="Timings favoris"
                    multi
                    options={TIMINGS}
                    value={profile.attack_systems?.timings ?? []}
                    onChange={(v) => patchAttack("timings", v)}
                  />
                  <ChipGroup
                    label="Distance favorite"
                    multi
                    options={DISTANCES}
                    value={profile.attack_systems?.distances ?? []}
                    onChange={(v) => patchAttack("distances", v)}
                  />
                  <ChipGroup
                    label="Phases dangereuses"
                    multi
                    options={DANGER_PHASES}
                    value={profile.attack_systems?.danger_phases ?? []}
                    onChange={(v) => patchAttack("danger_phases", v)}
                  />
                </SectionCard>

                {/* ============ 5. NE-WAZA ============ */}
                <SectionCard
                  id="newaza"
                  title="5. Ne-waza"
                  subtitle="Sol : style, comportement, sorties"
                  icon={<Layers className="h-4 w-4" />}
                  tone="newaza"
                >
                  <SliderWithLabels
                    label="Répartition debout / sol"
                    value={Number(profile.newaza_profile?.ground_pct ?? 50)}
                    onChange={(v) => patchNewaza("ground_pct", v)}
                    leftLabel="100% debout"
                    rightLabel="100% sol"
                    unit="% sol"
                    tone="newaza"
                  />
                  <ChipGroup
                    label="Style sol"
                    multi
                    options={NEWAZA_STYLES}
                    value={profile.newaza_profile?.styles ?? []}
                    onChange={(v) => patchNewaza("styles", v)}
                  />
                  <ChipGroup
                    label="Comportement transition"
                    multi
                    options={NEWAZA_BEHAVIOR}
                    value={profile.newaza_profile?.behavior ?? []}
                    onChange={(v) => patchNewaza("behavior", v)}
                  />
                  <ChipGroup
                    label="Sorties"
                    multi
                    options={NEWAZA_EXITS}
                    value={profile.newaza_profile?.exits ?? []}
                    onChange={(v) => patchNewaza("exits", v)}
                  />
                  <div className="flex items-center gap-3">
                    <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Danger sol
                    </Label>
                    <DangerStars
                      value={profile.newaza_profile?.danger ?? null}
                      onChange={(v) => patchNewaza("danger", v)}
                    />
                  </div>
                </SectionCard>

                {/* ============ 6. TACTIQUE ============ */}
                <SectionCard
                  id="tactical"
                  title="6. Tactique & gestion combat"
                  subtitle="Shidos, comportement arbitrage, gestion fin de combat"
                  icon={<Shield className="h-4 w-4" />}
                  tone="control"
                >
                  <ChipGroup
                    label="Shidos fréquents"
                    multi
                    options={COMMON_SHIDOS}
                    value={profile.tactical_profile?.common_shidos ?? []}
                    onChange={(v) => patchTactical("common_shidos", v)}
                  />
                  <ChipGroup
                    label="Comportement arbitrage"
                    multi
                    options={REFEREE_BEHAVIOR}
                    value={profile.tactical_profile?.referee_behavior ?? []}
                    onChange={(v) => patchTactical("referee_behavior", v)}
                  />
                  <ChipGroup
                    label="Gestion fin de combat"
                    multi
                    options={END_GAME_BEHAVIOR}
                    value={profile.tactical_profile?.end_game ?? []}
                    onChange={(v) => patchTactical("end_game", v)}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Réaction après score
                      </Label>
                      <Input
                        value={profile.tactical_profile?.after_score || ""}
                        onChange={(e) => patchTactical("after_score", e.target.value)}
                        placeholder="Ex: bloque immédiatement"
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Réaction après shido reçu
                      </Label>
                      <Input
                        value={profile.tactical_profile?.after_shido || ""}
                        onChange={(e) => patchTactical("after_shido", e.target.value)}
                        placeholder="Ex: cherche fausse attaque"
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                </SectionCard>

                {/* ============ 7. PHYSIQUE & DÉPLACEMENTS ============ */}
                <SectionCard
                  id="physical"
                  title="7. Profil physique & déplacements"
                  subtitle="Type, posture, déplacements, cardio"
                  icon={<Dumbbell className="h-4 w-4" />}
                  tone="physical"
                >
                  <ChipGroup
                    label="Posture"
                    options={POSTURES}
                    value={profile.physical_profile?.posture ?? null}
                    onChange={(v) => patchPhysical("posture", v)}
                  />
                  <ChipGroup
                    label="Déplacements"
                    multi
                    options={DISPLACEMENTS}
                    value={profile.physical_profile?.displacements ?? []}
                    onChange={(v) => patchPhysical("displacements", v)}
                  />
                  <ChipGroup
                    label="Cardio"
                    options={CARDIO_LEVELS}
                    value={profile.physical_profile?.cardio ?? null}
                    onChange={(v) => patchPhysical("cardio", v)}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SliderWithLabels
                      label="Puissance"
                      value={Number(profile.physical_profile?.power ?? 50)}
                      onChange={(v) => patchPhysical("power", v)}
                      leftLabel="Faible"
                      rightLabel="Élite"
                      unit="%"
                      tone="physical"
                    />
                    <SliderWithLabels
                      label="Explosivité"
                      value={Number(profile.physical_profile?.explosiveness ?? 50)}
                      onChange={(v) => patchPhysical("explosiveness", v)}
                      leftLabel="Faible"
                      rightLabel="Élite"
                      unit="%"
                      tone="danger"
                    />
                  </div>
                </SectionCard>

                {/* ============ NOTES DE SCOUTING ============ */}
                <SectionCard
                  id="notes"
                  title="Notes scouting libres"
                  subtitle="Observations coach, points clés, anecdotes vidéo"
                  icon={<Eye className="h-4 w-4" />}
                  tone="neutral"
                  defaultOpen={false}
                >
                  <Textarea
                    value={profile.scouting_notes || ""}
                    onChange={(e) => update({ scouting_notes: e.target.value })}
                    rows={6}
                    placeholder="Notes libres pour le coach…"
                  />
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Palmarès
                    </Label>
                    <Textarea
                      value={profile.palmares || ""}
                      onChange={(e) => update({ palmares: e.target.value })}
                      rows={3}
                      placeholder="Champion régional 2023, 3e France Junior 2024…"
                    />
                  </div>
                </SectionCard>

                {/* ============ PLAN TACTIQUE (Phase 2 – preview) ============ */}
                <SectionCard
                  id="plan"
                  title="8. Plan tactique recommandé"
                  subtitle="Bientôt : génération automatique par IA"
                  icon={<Sparkles className="h-4 w-4" />}
                  tone="opportunism"
                  defaultOpen={false}
                >
                  <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-center text-xs text-muted-foreground">
                    <Sparkles className="h-5 w-5 mx-auto mb-2 text-amber-500" />
                    La génération automatique du plan tactique par IA (points forts,
                    faiblesses, danger principal, plan A/B, checklist) arrive dans la prochaine
                    livraison.
                  </div>
                  <Textarea
                    value={profile.tactical_plan?.manual_plan || ""}
                    onChange={(e) =>
                      update({
                        tactical_plan: { ...(profile.tactical_plan || {}), manual_plan: e.target.value },
                      })
                    }
                    rows={6}
                    placeholder="Plan tactique rédigé par le coach…"
                  />
                </SectionCard>

                <div className="h-4" />
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
