import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useAthleteAttributes,
  useAddAthleteAttribute,
  useUpdateAthleteAttribute,
  useDeleteAthleteAttribute,
  type AthleteDimension,
} from "@/hooks/useAthleteAttributes";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Star, Loader2, User, Cake, Footprints, Trophy } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { isRugbyType } from "@/lib/constants/sportTypes";
import { toast } from "sonner";
import {
  ATHLETISME_DISCIPLINES,
  ATHLETISME_SPECIALTIES,
  isAthletismeCategory,
  isJudoCategory,
  isTeamSport,
  JUDO_WEIGHT_CATEGORIES,
} from "@/lib/constants/sportTypes";
import { getPositionsForSport } from "@/lib/constants/sportPositions";
import { getAgeCategoriesForSport, getAgeCategoryLabel } from "@/lib/constants/ageCategories";

function computeAge(birthDate: string | null, birthYear: number | null): number | null {
  if (birthDate) {
    const d = new Date(birthDate);
    if (!isNaN(d.getTime())) {
      const diff = Date.now() - d.getTime();
      return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
    }
  }
  if (birthYear) return new Date().getFullYear() - birthYear;
  return null;
}

function genderInfo(g: string | null): { label: string; emoji: string } {
  if (!g) return { label: "Non renseigné", emoji: "❓" };
  const v = g.toLowerCase();
  if (v.startsWith("f") || v === "female" || v === "feminin" || v === "féminin") return { label: "Féminin", emoji: "♀️" };
  if (v.startsWith("m") || v === "male" || v === "masculin") return { label: "Masculin", emoji: "♂️" };
  return { label: g, emoji: "•" };
}

type DimensionConfig = {
  dimension: AthleteDimension;
  label: string;
  description: string;
  options: { value: string; label: string }[];
  allowFreeText?: boolean;
};

interface Props {
  playerId: string;
  sportType: string;
}

const LATERALITY_OPTIONS: { value: string; label: string }[] = [
  { value: "droitier", label: "Droitier" },
  { value: "gaucher", label: "Gaucher" },
  { value: "ambidextre", label: "Ambidextre" },
];

const LATERALITY_OPTIONS_BOWLING: { value: string; label: string }[] = [
  { value: "droitier_1main", label: "Droitier 1 main" },
  { value: "droitier_2mains", label: "Droitier 2 mains" },
  { value: "gaucher_1main", label: "Gaucher 1 main" },
  { value: "gaucher_2mains", label: "Gaucher 2 mains" },
  { value: "ambidextre", label: "Ambidextre" },
];

function getLateralityOptions(sportType: string) {
  return sportType?.startsWith("bowling") ? LATERALITY_OPTIONS_BOWLING : LATERALITY_OPTIONS;
}

const STYLES_BY_SPORT: Record<string, { value: string; label: string }[]> = {
  bowling: [
    { value: "stroker", label: "Stroker" },
    { value: "cranker", label: "Cranker" },
    { value: "tweener", label: "Tweener" },
  ],
  tennis: [
    { value: "revers_1main", label: "Revers 1 main" },
    { value: "revers_2mains", label: "Revers 2 mains" },
    { value: "service_volley", label: "Service-volée" },
    { value: "fond_court", label: "Fond de court" },
    { value: "contre_attaquant", label: "Contre-attaquant" },
  ],
  padel: [
    { value: "cote_droit", label: "Côté droit (revers)" },
    { value: "cote_gauche", label: "Côté gauche (coup droit)" },
    { value: "polyvalent", label: "Polyvalent" },
  ],
  judo: [
    { value: "offensif", label: "Profil offensif" },
    { value: "defensif", label: "Profil défensif" },
    { value: "equilibre", label: "Profil équilibré" },
    { value: "tachi_waza", label: "Tachi-waza (debout)" },
    { value: "ne_waza", label: "Ne-waza (sol)" },
    { value: "migi", label: "Garde droite (migi)" },
    { value: "hidari", label: "Garde gauche (hidari)" },
  ],
  ski: [
    { value: "technicien", label: "Technicien" },
    { value: "vitesse", label: "Skieur de vitesse" },
    { value: "polyvalent", label: "Polyvalent" },
  ],
  snowboard: [
    { value: "regular", label: "Regular" },
    { value: "goofy", label: "Goofy" },
    { value: "switch", label: "Switch confirmé" },
  ],
  surf: [
    { value: "regular", label: "Regular" },
    { value: "goofy", label: "Goofy" },
    { value: "shortboard", label: "Shortboard" },
    { value: "longboard", label: "Longboard" },
  ],
};

/**
 * Éditeur unifié de l'identité athlète.
 * Pilote toutes les dimensions multi-valeurs : positions, disciplines,
 * styles techniques, profils de performance — avec primaire + pondération.
 */
export function AthleteIdentityEditor({ playerId, sportType }: Props) {
  const { data: attributes = [], isLoading } = useAthleteAttributes(playerId);
  const addMut = useAddAthleteAttribute(playerId);
  const updateMut = useUpdateAthleteAttribute(playerId);
  const deleteMut = useDeleteAthleteAttribute(playerId);

  const { data: playerCore } = useQuery({
    queryKey: ["player-core-identity", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players_safe")
        .select("gender, birth_date, birth_year")
        .eq("id", playerId)
        .maybeSingle();
      if (error) {
        console.error("[AthleteIdentityEditor] players_safe error", error);
        throw error;
      }
      console.log("[AthleteIdentityEditor] playerCore loaded", { playerId, data });
      return data;
    },
    enabled: !!playerId,
  });

  const queryClient = useQueryClient();
  const isRugby = isRugbyType(sportType);
  const { data: kickingFlag } = useQuery({
    queryKey: ["player-kicking-work", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("kicking_work_enabled")
        .eq("id", playerId)
        .maybeSingle();
      if (error) throw error;
      return (data as any)?.kicking_work_enabled ?? false;
    },
    enabled: !!playerId && isRugby,
  });
  const toggleKicking = useMutation({
    mutationFn: async (val: boolean) => {
      const { error } = await supabase
        .from("players")
        .update({ kicking_work_enabled: val } as any)
        .eq("id", playerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player-kicking-work", playerId] });
      toast.success("Préférence enregistrée");
    },
    onError: (e: any) => toast.error("Erreur : " + e.message),
  });

  const isAthletics = isAthletismeCategory(sportType);

  const isJudo = isJudoCategory(sportType);

  const isBowling = (sportType || "").toLowerCase().startsWith("bowling");

  const { data: bowlingTech } = useQuery({
    queryKey: ["player-bowling-tech", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("bowling_axe_deg, bowling_tilt_deg, bowling_ball_speed")
        .eq("id", playerId)
        .maybeSingle();
      if (error) throw error;
      return data as {
        bowling_axe_deg: number | null;
        bowling_tilt_deg: number | null;
        bowling_ball_speed: number | null;
      } | null;
    },
    enabled: !!playerId && isBowling,
  });
  const updateBowlingTech = useMutation({
    mutationFn: async (patch: {
      bowling_axe_deg?: number | null;
      bowling_tilt_deg?: number | null;
      bowling_ball_speed?: number | null;
    }) => {
      const { error } = await supabase
        .from("players")
        .update(patch as any)
        .eq("id", playerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player-bowling-tech", playerId] });
    },
    onError: (e: any) => toast.error("Erreur : " + e.message),
  });

  const { data: judoWeight } = useQuery({
    queryKey: ["player-judo-weight", playerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("discipline")
        .eq("id", playerId)
        .maybeSingle();
      if (error) throw error;
      return (data as any)?.discipline ?? null;
    },
    enabled: !!playerId && isJudo,
  });
  const updateJudoWeight = useMutation({
    mutationFn: async (val: string | null) => {
      const { error } = await supabase
        .from("players")
        .update({ discipline: val } as any)
        .eq("id", playerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player-judo-weight", playerId] });
      toast.success("Catégorie de poids enregistrée");
    },
    onError: (e: any) => toast.error("Erreur : " + e.message),
  });

  const age = computeAge(playerCore?.birth_date ?? null, playerCore?.birth_year ?? null);
  const gInfo = genderInfo(playerCore?.gender ?? null);

  const dimensions: DimensionConfig[] = useMemo(() => {
    const list: DimensionConfig[] = [];

    // 1) Positions (sports collectifs)
    const positions = getPositionsForSport(sportType as any);
    if (positions.length > 0 && !isAthletics) {
      const teamSport = isTeamSport(sportType);
      list.push({
        dimension: "position",
        label: teamSport ? "Poste" : "Postes",
        description: teamSport
          ? "Un seul poste par athlète."
          : "Postes occupés (cochez le principal, ajoutez des secondaires).",
        options: positions.map((p) => ({ value: p.name, label: `${p.id}. ${p.name}` })),
      });
    }

    // 2) Disciplines (athlétisme et assimilés)
    if (isAthletics) {
      list.push({
        dimension: "discipline",
        label: "Disciplines",
        description: "L'athlète peut s'aligner sur plusieurs disciplines.",
        options: ATHLETISME_DISCIPLINES.map((d) => ({ value: d.value, label: d.label })),
      });
    }

    // 3) Styles techniques
    const styleOptions = STYLES_BY_SPORT[sportType];
    if (styleOptions) {
      list.push({
        dimension: "style",
        label: "Styles techniques",
        description: "Caractéristiques techniques principales.",
        options: styleOptions,
      });
    }

    // 4) Latéralité — universelle, valeur unique : on cache le bloc d'ajout si déjà renseignée
    const hasLaterality = attributes.some((a) => a.dimension === "laterality");
    if (!hasLaterality) {
      list.push({
        dimension: "laterality",
        label: "Latéralité",
        description: "Main / pied dominant.",
        options: getLateralityOptions(sportType),
      });
    }

    // 5) Catégorie d'âge — officielle par sport, valeur unique
    const hasAgeCategory = attributes.some((a) => a.dimension === "age_category");
    if (!hasAgeCategory) {
      list.push({
        dimension: "age_category" as AthleteDimension,
        label: "Catégorie d'âge",
        description: "Catégorie officielle de la fédération.",
        options: getAgeCategoriesForSport(sportType),
      });
    }

    return list;
  }, [sportType, isAthletics, attributes]);

  const lateralityAttr = attributes.find((a) => a.dimension === "laterality");
  const lateralityOpts = getLateralityOptions(sportType);
  const lateralityLabel = lateralityAttr
    ? lateralityOpts.find((o) => o.value === lateralityAttr.value)?.label ?? lateralityAttr.value
    : null;

  const ageCategoryAttr = attributes.find((a) => a.dimension === ("age_category" as AthleteDimension));
  const ageCategoryOpts = getAgeCategoriesForSport(sportType);
  const ageCategoryLabel = ageCategoryAttr
    ? getAgeCategoryLabel(sportType, ageCategoryAttr.value)
    : null;

  // Poste (sport collectif uniquement) — affiché aussi dans la barre "Identité de base"
  const isTeam = isTeamSport(sportType);
  const positionAttr = isTeam
    ? (attributes.find((a) => a.dimension === "position" && a.is_primary) ??
       attributes.find((a) => a.dimension === "position"))
    : undefined;
  const positionOpts = isTeam
    ? getPositionsForSport(sportType as any).map((p) => ({
        value: p.name,
        label: `${p.id}. ${p.name}`,
      }))
    : [];
  const positionLabel = positionAttr
    ? positionOpts.find((o) => o.value === positionAttr.value)?.label ?? positionAttr.value
    : null;

  const requestEditPersonalInfo = () => {
    window.dispatchEvent(
      new CustomEvent("player:edit-personal-info", { detail: { playerId } }),
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Chargement de l'identité…
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-background p-4 shadow-lg shadow-primary/10 ring-1 ring-primary/20 backdrop-blur-sm relative overflow-hidden">
      <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary text-primary-foreground shadow-md">
            <Star className="h-4 w-4 fill-current" />
          </div>
          <Label className="text-base font-bold tracking-tight">Identité athlète</Label>
          <Badge variant="default" className="ml-1 text-[10px] uppercase tracking-wider">Essentiel</Badge>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          ⭐ = valeur principale. Adapte tests, barèmes et analyses à cet athlète.
        </p>
        <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
          <p className="text-[11px] leading-relaxed text-foreground/90">
            <span className="font-semibold text-primary">⚠️ PRIMORDIAL —</span> Sans cette identité,
            l'application ne peut pas personnaliser les <strong>barèmes de tests</strong>,
            les <strong>recommandations d'entraînement</strong>, les <strong>alertes de charge</strong>,
            ni les <strong>comparaisons par poste/discipline</strong>. Une identité bien renseignée
            est la <strong>condition #1</strong> pour obtenir des analyses fiables et un suivi
            réellement individualisé.
          </p>
        </div>
      </div>

      {/* Identité de base — éditable depuis la fiche joueur */}
      <div className="rounded-xl border bg-background/60 p-3">
        <div className="flex items-center gap-2 mb-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Identité de base
          </span>
          <span className="text-[10px] text-muted-foreground/70 ml-auto">
            (cliquez pour modifier)
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={requestEditPersonalInfo} className="focus:outline-none focus:ring-2 focus:ring-ring rounded-md">
            <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-secondary/80 transition-colors">
              <span>{gInfo.emoji}</span>
              <span>{gInfo.label}</span>
            </Badge>
          </button>
          <button type="button" onClick={requestEditPersonalInfo} className="focus:outline-none focus:ring-2 focus:ring-ring rounded-md">
            <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-secondary/80 transition-colors">
              <Cake className="h-3 w-3" />
              {age != null ? `${age} ans` : "Âge non renseigné"}
            </Badge>
          </button>
          {ageCategoryAttr && (
            <Select
              value={ageCategoryAttr.value}
              onValueChange={(v) => updateMut.mutate({ id: ageCategoryAttr.id, patch: { value: v } })}
            >
              <SelectTrigger className="h-7 w-auto gap-1 px-2 py-0 text-xs bg-secondary border-transparent hover:bg-secondary/80 rounded-md">
                <Cake className="h-3 w-3" />
                <SelectValue>{ageCategoryLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-background border z-[200] max-h-[300px]">
                {ageCategoryOpts.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
                <button
                  type="button"
                  onClick={() => deleteMut.mutate(ageCategoryAttr.id)}
                  className="w-full text-left text-xs text-destructive px-2 py-1.5 hover:bg-muted border-t mt-1"
                >
                  Retirer
                </button>
              </SelectContent>
            </Select>
          )}
          {lateralityAttr && (
            <Select
              value={lateralityAttr.value}
              onValueChange={(v) => updateMut.mutate({ id: lateralityAttr.id, patch: { value: v } })}
            >
              <SelectTrigger className="h-7 w-auto gap-1 px-2 py-0 text-xs bg-secondary border-transparent hover:bg-secondary/80 rounded-md">
                <Star className="h-3 w-3" />
                <SelectValue>{lateralityLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-background border z-[200]">
                {lateralityOpts.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
                <button
                  type="button"
                  onClick={() => deleteMut.mutate(lateralityAttr.id)}
                  className="w-full text-left text-xs text-destructive px-2 py-1.5 hover:bg-muted border-t mt-1"
                >
                  Retirer
                </button>
              </SelectContent>
            </Select>
          )}
          {isTeam && positionOpts.length > 0 && (
            <Select
              value={positionAttr?.value ?? ""}
              onValueChange={(v) => {
                if (!v) return;
                if (positionAttr) {
                  if (v === positionAttr.value) return;
                  updateMut.mutate({ id: positionAttr.id, patch: { value: v, is_primary: true } });
                } else {
                  addMut.mutate({
                    dimension: "position",
                    value: v,
                    is_primary: true,
                    weight: null,
                    metadata: {},
                  });
                }
              }}
            >
              <SelectTrigger className="h-7 w-auto gap-1 px-2 py-0 text-xs bg-secondary border-transparent hover:bg-secondary/80 rounded-md">
                <Trophy className="h-3 w-3" />
                <SelectValue placeholder="Choisir un poste…">
                  {positionLabel}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-background border z-[200] max-h-[300px]">
                {positionOpts.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
                {positionAttr && (
                  <button
                    type="button"
                    onClick={() => deleteMut.mutate(positionAttr.id)}
                    className="w-full text-left text-xs text-destructive px-2 py-1.5 hover:bg-muted border-t mt-1"
                  >
                    Retirer
                  </button>
                )}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {isJudo && (
        <div className="rounded-xl border bg-background/60 p-3 space-y-2">
          <Label className="text-sm font-semibold">Catégorie de poids (judo)</Label>
          <Select
            value={judoWeight ?? ""}
            onValueChange={(v) => updateJudoWeight.mutate(v || null)}
          >
            <SelectTrigger className="w-full bg-background">
              <SelectValue placeholder="Sélectionner une catégorie de poids" />
            </SelectTrigger>
            <SelectContent className="bg-background border z-[200] max-h-[300px]">
              {JUDO_WEIGHT_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Utilisée pour les filtres, les comparaisons et la sélection automatique des adversaires.
          </p>
        </div>
      )}

      {isRugby && (
        <div className="rounded-xl border bg-background/60 p-3 flex items-start gap-3">
          <Checkbox
            id="kicking-work"
            checked={!!kickingFlag}
            onCheckedChange={(v) => toggleKicking.mutate(!!v)}
          />
          <div className="space-y-0.5">
            <label htmlFor="kicking-work" className="text-sm font-semibold flex items-center gap-1.5 cursor-pointer">
              <Footprints className="h-4 w-4 text-primary" />
              Travail du jeu au pied
            </label>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Active un sous-onglet "Data d'entraînement" dans l'espace athlète permettant à ce joueur de saisir lui-même ses séances de jeu au pied (uniquement pour lui).
            </p>
          </div>
        </div>
      )}

      {dimensions.map((dim) => {
        const items = attributes.filter((a) => a.dimension === dim.dimension);
        const singleValue =
          dim.dimension === "position" && isTeamSport(sportType);
        return (
          <DimensionBlock
            key={dim.dimension}
            config={dim}
            items={items}
            sportType={sportType}
            singleValue={singleValue}
            onAdd={(payload) => addMut.mutate(payload)}
            onUpdateValue={(id, value) => updateMut.mutate({ id, patch: { value } })}
            onTogglePrimary={(id) => updateMut.mutate({ id, patch: { is_primary: true } })}
            onUpdateWeight={(id, weight) =>
              updateMut.mutate({ id, patch: { weight } })
            }
            onUpdateMetadata={(id, metadata) =>
              updateMut.mutate({ id, patch: { metadata } })
            }
            onDelete={(id) => deleteMut.mutate(id)}
            pending={addMut.isPending || updateMut.isPending || deleteMut.isPending}
          />
        );
      })}
    </div>
  );
}

interface DimensionBlockProps {
  config: DimensionConfig;
  items: ReturnType<typeof useAthleteAttributes>["data"] extends Array<infer T> | undefined
    ? T[]
    : never;
  sportType: string;
  /** Si true : une seule valeur autorisée pour la dimension (sport collectif → poste unique). */
  singleValue?: boolean;
  onAdd: (payload: {
    dimension: AthleteDimension;
    value: string;
    is_primary?: boolean;
    weight?: number | null;
    metadata?: any;
  }) => void;
  onUpdateValue: (id: string, value: string) => void;
  onTogglePrimary: (id: string) => void;
  onUpdateWeight: (id: string, weight: number | null) => void;
  onUpdateMetadata: (id: string, metadata: any) => void;
  onDelete: (id: string) => void;
  pending: boolean;
}

function DimensionBlock({
  config,
  items,
  sportType,
  singleValue = false,
  onAdd,
  onUpdateValue,
  onTogglePrimary,
  onUpdateWeight,
  onUpdateMetadata,
  onDelete,
  pending,
}: DimensionBlockProps) {
  const [draft, setDraft] = useState("");
  const [draftSpecialty, setDraftSpecialty] = useState("");

  const isAthleticsDiscipline = config.dimension === "discipline";
  const draftSpecialties = isAthleticsDiscipline && draft
    ? ATHLETISME_SPECIALTIES[draft] || []
    : [];

  const usedValues = new Set(
    items.map((i) => `${i.value}|${(i.metadata as any)?.specialty ?? ""}`),
  );

  const handleAdd = () => {
    if (!draft) return;
    const compoundKey = `${draft}|${draftSpecialty}`;
    if (usedValues.has(compoundKey)) return;
    onAdd({
      dimension: config.dimension,
      value: draft,
      is_primary: items.length === 0, // 1ère valeur = principale par défaut
      weight: null,
      metadata: draftSpecialty ? { specialty: draftSpecialty } : {},
    });
    setDraft("");
    setDraftSpecialty("");
  };

  const labelFor = (val: string): string => {
    const opt = config.options.find((o) => o.value === val);
    return opt?.label ?? val;
  };

  // === Mode mono-valeur (sport collectif → un seul poste, pas d'étoile/poids) ===
  if (singleValue) {
    const current = items[0];
    const singleLabel = config.label.replace(/s$/, "");
    return (
      <div className="space-y-2 rounded-xl border bg-background/60 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <Label className="text-sm font-medium">{singleLabel}</Label>
          <span className="text-[11px] text-muted-foreground">
            Un seul {singleLabel.toLowerCase()} par athlète.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={current?.value ?? ""}
            onValueChange={(v) => {
              if (!v) return;
              if (current) {
                // Remplacer la valeur existante (UPDATE pour respecter le trigger "un seul poste")
                if (v === current.value) return;
                onUpdateValue(current.id, v);
              } else {
                onAdd({
                  dimension: config.dimension,
                  value: v,
                  is_primary: true,
                  weight: null,
                  metadata: {},
                });
              }
            }}
            disabled={pending}
          >
            <SelectTrigger className="w-full bg-background">
              <SelectValue placeholder={`Choisir un ${singleLabel.toLowerCase()}…`} />
            </SelectTrigger>
            <SelectContent className="bg-background border z-[200] max-h-[300px]">
              {config.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {current && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onDelete(current.id)}
              disabled={pending}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border bg-background/60 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-sm font-medium">{config.label}</Label>
        <span className="text-[11px] text-muted-foreground">{config.description}</span>
      </div>

      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {items.map((it) => {
            const meta = (it.metadata as any) || {};
            const specialtyLabel = meta.specialty
              ? (ATHLETISME_SPECIALTIES[it.value] || []).find(
                  (s) => s.value === meta.specialty,
                )?.label || meta.specialty
              : null;
            return (
              <div
                key={it.id}
                className={`group flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${
                  it.is_primary
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "bg-muted text-foreground"
                }`}
              >
                <button
                  type="button"
                  onClick={() => !it.is_primary && onTogglePrimary(it.id)}
                  title={it.is_primary ? "Principal" : "Définir comme principal"}
                  className="opacity-90 hover:opacity-100"
                >
                  <Star
                    className={`h-3 w-3 ${it.is_primary ? "fill-current" : ""}`}
                  />
                </button>
                <span className="font-medium">
                  {labelFor(it.value)}
                  {specialtyLabel ? ` · ${specialtyLabel}` : ""}
                </span>
                {!it.is_primary && config.dimension !== "discipline" && (
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={it.weight ?? ""}
                    placeholder="%"
                    onChange={(e) => {
                      const v = e.target.value;
                      onUpdateWeight(it.id, v === "" ? null : Number(v));
                    }}
                    className="h-5 w-12 px-1 text-[10px] text-foreground bg-background"
                  />
                )}
                <button
                  type="button"
                  onClick={() => onDelete(it.id)}
                  disabled={pending}
                  className="ml-0.5 rounded-sm hover:bg-foreground/10 p-0.5"
                  aria-label="Retirer"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <Select
          value={draft}
          onValueChange={(v) => {
            setDraft(v);
            setDraftSpecialty("");
            const needsSpecialty = isAthleticsDiscipline && (ATHLETISME_SPECIALTIES[v] || []).length > 0;
            if (!needsSpecialty) {
              const compoundKey = `${v}|`;
              if (usedValues.has(compoundKey)) return;
              onAdd({
                dimension: config.dimension,
                value: v,
                is_primary: items.length === 0,
                weight: null,
                metadata: {},
              });
              setDraft("");
            }
          }}
        >
          <SelectTrigger className="w-full bg-background">
            <SelectValue placeholder={`Ajouter ${config.label.toLowerCase()}…`} />
          </SelectTrigger>
          <SelectContent className="bg-background border z-[200] max-h-[300px]">
            {config.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {draftSpecialties.length > 0 && (
          <Select
            value={draftSpecialty}
            onValueChange={(v) => {
              setDraftSpecialty(v);
              const compoundKey = `${draft}|${v}`;
              if (usedValues.has(compoundKey)) return;
              onAdd({
                dimension: config.dimension,
                value: draft,
                is_primary: items.length === 0,
                weight: null,
                metadata: { specialty: v },
              });
              setDraft("");
              setDraftSpecialty("");
            }}
          >
            <SelectTrigger className="w-full bg-background">
              <SelectValue placeholder="Spécialité" />
            </SelectTrigger>
            <SelectContent className="bg-background border z-[200] max-h-[300px]">
              {draftSpecialties.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

      </div>
    </div>
  );
}
