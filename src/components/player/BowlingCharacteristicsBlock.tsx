import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Save, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface BowlingTechValues {
  bowling_axe_deg: number | null;
  bowling_tilt_deg: number | null;
  bowling_ball_speed: number | null;
  bowling_ball_weight_lbs: number | null;
  bowling_rpm: number | null;
  bowling_pap_h_inch: number | null;
  bowling_pap_v_inch: number | null;
  bowling_perso_num_left: number | null;
  bowling_perso_num_center: number | null;
  bowling_perso_num_right: number | null;
}

type Draft = Record<keyof BowlingTechValues, string>;

const EMPTY_DRAFT: Draft = {
  bowling_axe_deg: "",
  bowling_tilt_deg: "",
  bowling_ball_speed: "",
  bowling_ball_weight_lbs: "",
  bowling_rpm: "",
  bowling_pap_h_inch: "",
  bowling_pap_v_inch: "",
  bowling_perso_num_left: "",
  bowling_perso_num_center: "",
  bowling_perso_num_right: "",
};

function toDraft(tech: BowlingTechValues | null): Draft {
  if (!tech) return EMPTY_DRAFT;
  const out: Partial<Draft> = {};
  (Object.keys(EMPTY_DRAFT) as (keyof Draft)[]).forEach((k) => {
    const v = tech[k];
    out[k] = v == null ? "" : String(v);
  });
  return out as Draft;
}

function parseNum(raw: string): number | null {
  if (raw.trim() === "") return null;
  const v = Number(raw);
  return Number.isFinite(v) ? v : NaN;
}
function parseInteger(raw: string): number | null {
  if (raw.trim() === "") return null;
  const v = parseInt(raw, 10);
  return Number.isFinite(v) ? v : NaN;
}

function formatDisplayValue(value: number | null, options?: { decimals?: number; suffix?: string }) {
  if (value == null) return null;
  const { decimals, suffix } = options || {};
  const formatted = typeof decimals === "number"
    ? value.toLocaleString("fr-FR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  return suffix ? `${formatted} ${suffix}` : formatted;
}

interface Props {
  tech: BowlingTechValues | null;
  onSave: (patch: Partial<BowlingTechValues>) => Promise<unknown>;
  saving: boolean;
}

export function BowlingCharacteristicsBlock({ tech, onSave, saving }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(tech));

  // Resync draft when leaving edit mode or when fresh data arrives while viewing
  useEffect(() => {
    if (!editing) setDraft(toDraft(tech));
  }, [tech, editing]);

  const set = (k: keyof Draft, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const handleCancel = () => {
    setDraft(toDraft(tech));
    setEditing(false);
  };

  const handleSave = async () => {
    // Validate
    const axe = parseNum(draft.bowling_axe_deg);
    if (axe !== null && (Number.isNaN(axe) || axe < 0 || axe > 90)) {
      return toast.error("Axe : valeur entre 0 et 90°");
    }
    const tilt = parseNum(draft.bowling_tilt_deg);
    if (tilt !== null && (Number.isNaN(tilt) || tilt < -30 || tilt > 30)) {
      return toast.error("Tilt : valeur entre -30 et +30°");
    }
    const speed = parseNum(draft.bowling_ball_speed);
    if (speed !== null && (Number.isNaN(speed) || speed < 0)) {
      return toast.error("Vitesse : valeur numérique positive");
    }
    const weight = parseInteger(draft.bowling_ball_weight_lbs);
    if (weight !== null && (Number.isNaN(weight) || weight < 12 || weight > 16)) {
      return toast.error("Poids : entre 12 et 16 lbs");
    }
    const rpm = parseInteger(draft.bowling_rpm);
    if (rpm !== null && (Number.isNaN(rpm) || rpm < 0 || rpm > 1000)) {
      return toast.error("RPM : valeur entre 0 et 1000");
    }
    const papH = parseNum(draft.bowling_pap_h_inch);
    if (papH !== null && (Number.isNaN(papH) || papH < -10 || papH > 10)) {
      return toast.error("PAP H : valeur entre -10 et 10 pouces");
    }
    const papV = parseNum(draft.bowling_pap_v_inch);
    if (papV !== null && (Number.isNaN(papV) || papV < -10 || papV > 10)) {
      return toast.error("PAP V : valeur entre -10 et 10 pouces");
    }
    const numL = parseInteger(draft.bowling_perso_num_left);
    if (numL !== null && Number.isNaN(numL)) {
      return toast.error("Numéro perso Gauche : valeur entière");
    }
    const numC = parseInteger(draft.bowling_perso_num_center);
    if (numC !== null && Number.isNaN(numC)) {
      return toast.error("Numéro perso Centre : valeur entière");
    }
    const numR = parseInteger(draft.bowling_perso_num_right);
    if (numR !== null && Number.isNaN(numR)) {
      return toast.error("Numéro perso Droit : valeur entière");
    }

    const patch: Partial<BowlingTechValues> = {
      bowling_axe_deg: axe,
      bowling_tilt_deg: tilt,
      bowling_ball_speed: speed,
      bowling_ball_weight_lbs: weight,
      bowling_rpm: rpm,
      bowling_pap_h_inch: papH,
      bowling_pap_v_inch: papV,
      bowling_perso_num_left: numL,
      bowling_perso_num_center: numC,
      bowling_perso_num_right: numR,
    };

    try {
      await onSave(patch);
      toast.success("Caractéristiques enregistrées");
      setEditing(false);
    } catch (e: any) {
      toast.error("Erreur : " + (e?.message || "impossible d'enregistrer"));
    }
  };

  const disabled = !editing;

  return (
    <div className="rounded-xl border bg-background/60 p-3 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <Label className="text-sm font-semibold">Caractéristiques de l'athlète</Label>
          <p className="text-[11px] text-muted-foreground">
            Poids de boule, axe, tilt, RPM, PAP, vitesse et numéros perso.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
              className="h-8 gap-1"
            >
              <Pencil className="h-3.5 w-3.5" />
              Modifier
            </Button>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleCancel}
                disabled={saving}
                className="h-8 gap-1"
              >
                <X className="h-3.5 w-3.5" />
                Annuler
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="h-8 gap-1"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Enregistrer
              </Button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor="bowling-weight" className="text-xs">Poids de la boule (lbs)</Label>
            <Select
              value={draft.bowling_ball_weight_lbs || ""}
              onValueChange={(v) => set("bowling_ball_weight_lbs", v)}
              disabled={disabled}
            >
              <SelectTrigger id="bowling-weight" className="bg-background">
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                {[12, 13, 14, 15, 16].map((w) => (
                  <SelectItem key={w} value={String(w)}>{w} lbs</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <NumField label="Axe (°)" id="bowling-axe" placeholder="0 – 90" step={1}
            value={draft.bowling_axe_deg} onChange={(v) => set("bowling_axe_deg", v)} disabled={disabled} />

          <NumField label="Tilt (°)" id="bowling-tilt" placeholder="-30 – +30" step={1}
            value={draft.bowling_tilt_deg} onChange={(v) => set("bowling_tilt_deg", v)} disabled={disabled} />

          <NumField label="RPM" id="bowling-rpm" placeholder="ex. 350" step={1}
            value={draft.bowling_rpm} onChange={(v) => set("bowling_rpm", v)} disabled={disabled} />

          <NumField label="PAP Horizontal (pouce)" id="bowling-pap-h" placeholder="ex. 4.75" step={0.01}
            value={draft.bowling_pap_h_inch} onChange={(v) => set("bowling_pap_h_inch", v)} disabled={disabled} />

          <NumField label="PAP Vertical (pouce)" id="bowling-pap-v" placeholder="ex. 0.50" step={0.01}
            value={draft.bowling_pap_v_inch} onChange={(v) => set("bowling_pap_v_inch", v)} disabled={disabled} />

          <NumField label="Vitesse de boule (km/h)" id="bowling-speed" placeholder="ex. 28.5" step={0.1}
            value={draft.bowling_ball_speed} onChange={(v) => set("bowling_ball_speed", v)} disabled={disabled} />

          <NumField label="Numéro perso Gauche" id="bowling-num-left" placeholder="ex. -5" step={1}
            value={draft.bowling_perso_num_left} onChange={(v) => set("bowling_perso_num_left", v)} disabled={disabled} />

          <NumField label="Numéro perso Centre" id="bowling-num-center" placeholder="ex. 0" step={1}
            value={draft.bowling_perso_num_center} onChange={(v) => set("bowling_perso_num_center", v)} disabled={disabled} />

          <NumField label="Numéro perso Droit" id="bowling-num-right" placeholder="ex. 3" step={1}
            value={draft.bowling_perso_num_right} onChange={(v) => set("bowling_perso_num_right", v)} disabled={disabled} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ReadOnlyField label="Poids de la boule (lbs)" value={formatDisplayValue(tech?.bowling_ball_weight_lbs ?? null, { suffix: "lbs" })} />
          <ReadOnlyField label="Axe (°)" value={formatDisplayValue(tech?.bowling_axe_deg ?? null, { suffix: "°" })} />
          <ReadOnlyField label="Tilt (°)" value={formatDisplayValue(tech?.bowling_tilt_deg ?? null, { suffix: "°" })} />
          <ReadOnlyField label="RPM" value={formatDisplayValue(tech?.bowling_rpm ?? null)} />
          <ReadOnlyField label="PAP Horizontal (pouce)" value={formatDisplayValue(tech?.bowling_pap_h_inch ?? null, { decimals: 2 })} />
          <ReadOnlyField label="PAP Vertical (pouce)" value={formatDisplayValue(tech?.bowling_pap_v_inch ?? null, { decimals: 2 })} />
          <ReadOnlyField label="Vitesse de boule (km/h)" value={formatDisplayValue(tech?.bowling_ball_speed ?? null, { decimals: 1 })} />
          <ReadOnlyField label="Numéro perso Gauche" value={formatDisplayValue(tech?.bowling_perso_num_left ?? null)} />
          <ReadOnlyField label="Numéro perso Centre" value={formatDisplayValue(tech?.bowling_perso_num_center ?? null)} />
          <ReadOnlyField label="Numéro perso Droit" value={formatDisplayValue(tech?.bowling_perso_num_right ?? null)} />
        </div>
      )}
    </div>
  );
}

interface NumFieldProps {
  label: string;
  id: string;
  placeholder?: string;
  step?: number;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}
function NumField({ label, id, placeholder, step, value, onChange, disabled }: NumFieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input
        id={id}
        type="number"
        step={step ?? 1}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="bg-background"
      />
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="space-y-1 rounded-lg border border-border/60 bg-surface-sunken/40 px-3 py-2.5 min-h-[72px]">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={value ? "text-sm font-medium text-foreground" : "text-sm text-muted-foreground"}>
        {value || "Non renseigné"}
      </p>
    </div>
  );
}
