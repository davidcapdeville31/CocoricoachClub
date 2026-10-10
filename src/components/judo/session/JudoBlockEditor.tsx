import { Plus, Trash2 } from "lucide-react";
import {
  COOLDOWN_OPTIONS, JUDO_FAMILIES, JUDO_MODALITIES, NE_WAZA_SITUATIONS, OPPOSITION_TYPES, PHYSICAL_QUALITIES,
  RANDORI_EVALUATION_FIELDS, RANDORI_TYPES, TACTICAL_AXES, TACTICAL_EXAMPLES, WARMUP_OPTIONS, type JudoPosition,
} from "@/lib/judo/nomenclature";
import { newExercise, newModality, randoriDurations, type JudoBlock, type ModalityEntry } from "@/lib/judo/sessionModel";
import { AutoText, Chip, IntensityPicker, NumField, TechniquePicker, TextField } from "./JudoFields";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[13px] font-semibold text-judo-ink">{title}</p>
      {children}
    </div>
  );
}

function Secondary({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="rounded-xl border border-border/40 bg-judo-canvas/60">
      <CollapsibleTrigger className="group flex min-h-11 w-full items-center justify-between px-3 text-left text-sm font-medium text-judo-ink">
        {title}
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 px-3 pb-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function ModalityCard({ m, onChange, onRemove }: { m: ModalityEntry; onChange: (m: ModalityEntry) => void; onRemove: () => void }) {
  const meta = JUDO_MODALITIES.find((x) => x.key === m.key);
  const f = new Set(meta?.fields ?? []);
  return (
    <div className="space-y-3 rounded-xl border border-judo-technique/25 bg-judo-soft/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-judo-ink">{meta?.label ?? m.key} <span className="font-normal text-muted-foreground">· {meta?.hint}</span></p>
        <button type="button" onClick={onRemove} className="rounded-full p-2 text-muted-foreground hover:text-destructive" aria-label="Retirer la modalité"><Trash2 className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {f.has("duration") && <NumField label="Durée" suffix="min" value={m.duration_min} onChange={(v) => onChange({ ...m, duration_min: v })} />}
        {f.has("sets") && <NumField label="Séries" value={m.sets} onChange={(v) => onChange({ ...m, sets: v })} />}
        {f.has("reps") && <NumField label="Répétitions" value={m.reps} onChange={(v) => onChange({ ...m, reps: v })} />}
        {f.has("rest") && <NumField label="Récupération" suffix="s" value={m.rest_s} onChange={(v) => onChange({ ...m, rest_s: v })} />}
      </div>
      {f.has("partner") && <TextField label="Partenaire ou groupe" value={m.partner} onChange={(v) => onChange({ ...m, partner: v })} />}
      <TextField label="Consignes techniques" value={m.instructions} onChange={(v) => onChange({ ...m, instructions: v })} />
    </div>
  );
}

export function JudoBlockEditor({ block, onChange }: { block: JudoBlock; onChange: (b: JudoBlock) => void }) {
  const set = <K extends keyof JudoBlock>(k: K, v: JudoBlock[K]) => onChange({ ...block, [k]: v });
  const b = block;

  const durationField = (
    <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
      <NumField label="Durée du bloc" suffix="min" value={b.duration_min} onChange={(v) => set("duration_min", v)} />
    </div>
  );

  if (b.kind === "technique") {
    const families = JUDO_FAMILIES.filter((f) => b.positions.includes(f.position));
    return (
      <div className="space-y-4">
        <Section title="Travail">
          <div className="grid grid-cols-2 gap-2">
            {([["tachi", "🥋 Tachi-waza", "Travail debout"], ["ne", "🟦 Ne-waza", "Travail au sol"]] as Array<[JudoPosition, string, string]>).map(([k, l, h]) => {
              const on = b.positions.includes(k);
              return (
                <button key={k} type="button" aria-pressed={on} onClick={() => {
                  const positions = toggleIn(b.positions, k);
                  const allowed = new Set(JUDO_FAMILIES.filter((f) => positions.includes(f.position)).map((f) => f.key));
                  onChange({ ...b, positions, families: b.families.filter((f) => allowed.has(f)) });
                }}
                  className={`min-h-16 rounded-2xl border p-3 text-left transition-all active:scale-[0.98] ${on ? "border-judo-technique bg-judo-technique/10" : "border-border/60 bg-card"}`}>
                  <p className="text-sm font-semibold text-judo-ink">{l}</p>
                  <p className="text-xs text-muted-foreground">{h}</p>
                </button>
              );
            })}
          </div>
        </Section>
        {families.length > 0 && (
          <Section title="Familles techniques">
            <div className="flex flex-wrap gap-2">
              {families.map((f) => <Chip key={f.key} active={b.families.includes(f.key)} onClick={() => set("families", toggleIn(b.families, f.key))}>{f.label}</Chip>)}
            </div>
          </Section>
        )}
        {b.positions.length > 0 && (
          <Section title="Techniques travaillées">
            <TechniquePicker positions={b.positions} families={b.families} selected={b.techniques} onChange={(v) => set("techniques", v)} />
          </Section>
        )}
        {b.positions.includes("ne") && (
          <Section title="Situations pédagogiques au sol">
            <div className="flex flex-wrap gap-2">
              {NE_WAZA_SITUATIONS.map((s) => <Chip key={s.key} active={b.situations.includes(s.key)} onClick={() => set("situations", toggleIn(b.situations, s.key))}>{s.label}</Chip>)}
            </div>
          </Section>
        )}
        <Section title="Modalités de travail">
          <div className="flex flex-wrap gap-2">
            {JUDO_MODALITIES.map((m) => {
              const on = b.modalities.some((x) => x.key === m.key);
              return <Chip key={m.key} active={on} onClick={() => set("modalities", on ? b.modalities.filter((x) => x.key !== m.key) : [...b.modalities, newModality(m.key)])}>{m.label}</Chip>;
            })}
          </div>
          {b.modalities.map((m, i) => (
            <ModalityCard key={m.key} m={m} onChange={(next) => set("modalities", b.modalities.map((x, j) => (j === i ? next : x)))} onRemove={() => set("modalities", b.modalities.filter((_, j) => j !== i))} />
          ))}
        </Section>
        {durationField}
        <AutoText label="Travail effectué" value={b.description} onChange={(v) => set("description", v)} placeholder="Décris les exercices, les consignes et les corrections réalisées." />
        <Secondary title="Observations techniques et intensité">
          <AutoText value={b.observations} onChange={(v) => set("observations", v)} placeholder="Observations techniques (facultatif)" />
          <IntensityPicker value={b.intensity} onChange={(v) => set("intensity", v)} />
        </Secondary>
      </div>
    );
  }

  if (b.kind === "tactic") {
    return (
      <div className="space-y-4">
        <Section title="Axes tactiques">
          <div className="flex flex-wrap gap-2">
            {TACTICAL_AXES.map((a) => <Chip key={a.key} tone="tactic" active={b.axes.includes(a.key)} onClick={() => set("axes", toggleIn(b.axes, a.key))}>{a.label}</Chip>)}
          </div>
        </Section>
        <AutoText label="Situation de départ" value={b.start_situation} onChange={(v) => set("start_situation", v)} placeholder="Ex. garde croisée, adversaire gaucher…" />
        <div className="space-y-2">
          <TextField label="Objectif tactique" value={b.tactical_goal} onChange={(v) => set("tactical_goal", v)} />
          <div className="flex flex-wrap gap-1.5">
            {TACTICAL_EXAMPLES.map((ex) => (
              <button key={ex} type="button" onClick={() => set("tactical_goal", ex)} className="min-h-9 rounded-full border border-dashed border-judo-tactic/50 px-3 text-xs text-muted-foreground hover:text-judo-ink">+ {ex}</button>
            ))}
          </div>
        </div>
        <AutoText label="Consignes" value={b.description} onChange={(v) => set("description", v)} />
        {durationField}
        <Secondary title="Contraintes, observations et intensité">
          <AutoText label="Contraintes imposées" value={b.constraints} onChange={(v) => set("constraints", v)} />
          <AutoText label="Observations" value={b.observations} onChange={(v) => set("observations", v)} />
          <IntensityPicker value={b.intensity} onChange={(v) => set("intensity", v)} />
        </Secondary>
      </div>
    );
  }

  if (b.kind === "randori") {
    const r = randoriDurations(b);
    return (
      <div className="space-y-4">
        <Section title="Type de randori">
          <div className="flex flex-wrap gap-2">
            {RANDORI_TYPES.map((t) => <Chip key={t.key} tone="randori" active={b.randori_type === t.key} onClick={() => set("randori_type", b.randori_type === t.key ? null : t.key)}>{t.label}</Chip>)}
          </div>
        </Section>
        <Section title="Type d'opposition">
          <div className="flex flex-wrap gap-2">
            {OPPOSITION_TYPES.map((t) => <Chip key={t.key} tone="randori" active={b.opposition_type === t.key} onClick={() => set("opposition_type", b.opposition_type === t.key ? null : t.key)}>{t.label}</Chip>)}
          </div>
        </Section>
        <div className="grid grid-cols-3 gap-2">
          <NumField label="Nombre" value={b.randori_count} onChange={(v) => set("randori_count", v)} />
          <NumField label="Durée unitaire" suffix="min" value={b.randori_unit_min} onChange={(v) => set("randori_unit_min", v)} />
          <NumField label="Récup." suffix="min" value={b.randori_rest_min} onChange={(v) => set("randori_rest_min", v)} />
        </div>
        {r ? (
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-judo-randori/10 p-3 text-center">
            <div><p className="text-lg font-bold text-judo-ink">{r.opposition} min</p><p className="text-[11px] text-muted-foreground">Opposition</p></div>
            <div><p className="text-lg font-bold text-judo-ink">{r.recovery} min</p><p className="text-[11px] text-muted-foreground">Récupération</p></div>
            <div><p className="text-lg font-bold text-judo-ink">{r.total} min</p><p className="text-[11px] text-muted-foreground">Total du bloc</p></div>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">Renseigne le nombre et la durée d'un randori pour calculer la durée du bloc, ou saisis-la directement.</p>
            {durationField}
          </>
        )}
        <IntensityPicker value={b.intensity} onChange={(v) => set("intensity", v)} />
        <Secondary title="Contraintes et observations">
          <AutoText label="Contraintes éventuelles" value={b.constraints} onChange={(v) => set("constraints", v)} />
          <AutoText label="Observations" value={b.observations} onChange={(v) => set("observations", v)} />
        </Secondary>
        <Secondary title="Évaluation facultative (texte libre)">
          <p className="text-xs text-muted-foreground">Observations qualitatives, jamais converties en score.</p>
          {RANDORI_EVALUATION_FIELDS.map((f) => (
            <TextField key={f.key} label={f.label} value={b.evaluation[f.key] ?? ""} onChange={(v) => set("evaluation", { ...b.evaluation, [f.key]: v })} />
          ))}
        </Secondary>
      </div>
    );
  }

  if (b.kind === "physical") {
    return (
      <div className="space-y-4">
        <Section title="Qualités travaillées">
          <div className="flex flex-wrap gap-2">
            {PHYSICAL_QUALITIES.map((q) => <Chip key={q.key} tone="physical" active={b.qualities.includes(q.key)} onClick={() => set("qualities", toggleIn(b.qualities, q.key))}>{q.label}</Chip>)}
          </div>
        </Section>
        <Section title="Exercices">
          {b.exercises.map((e, i) => {
            const up = (patch: Partial<typeof e>) => set("exercises", b.exercises.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <div key={e.id} className="space-y-2 rounded-xl border border-judo-physical/25 bg-judo-physical/5 p-3">
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1"><TextField label={`Exercice ${i + 1}`} value={e.name} onChange={(v) => up({ name: v })} placeholder="Ex. tirage élastique" /></div>
                  <button type="button" onClick={() => set("exercises", b.exercises.filter((_, j) => j !== i))} className="mb-1 rounded-full p-2.5 text-muted-foreground hover:text-destructive" aria-label="Supprimer l'exercice"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <NumField label="Séries" value={e.sets} onChange={(v) => up({ sets: v })} />
                  <NumField label="Répétitions" value={e.reps} onChange={(v) => up({ reps: v })} />
                  <NumField label="Durée" suffix="min" value={e.duration_min} onChange={(v) => up({ duration_min: v })} />
                  <NumField label="Récup." suffix="s" value={e.rest_s} onChange={(v) => up({ rest_s: v })} />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <TextField label="Charge" value={e.load} onChange={(v) => up({ load: v })} placeholder="Ex. 20 kg, poids du corps" />
                  <TextField label="Consignes" value={e.instructions} onChange={(v) => up({ instructions: v })} />
                </div>
              </div>
            );
          })}
          <button type="button" onClick={() => set("exercises", [...b.exercises, newExercise()])} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-judo-physical/50 text-sm font-medium text-judo-ink hover:bg-judo-physical/5">
            <Plus className="h-4 w-4" /> Ajouter un exercice
          </button>
        </Section>
        {durationField}
        <Secondary title="Observations et intensité">
          <AutoText value={b.observations} onChange={(v) => set("observations", v)} placeholder="Observations (facultatif)" />
          <IntensityPicker value={b.intensity} onChange={(v) => set("intensity", v)} />
        </Secondary>
      </div>
    );
  }

  const list = b.kind === "warmup" ? WARMUP_OPTIONS : COOLDOWN_OPTIONS;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {list.map((o) => <Chip key={o.key} tone={b.kind === "warmup" ? "tactic" : "mental"} active={b.options.includes(o.key)} onClick={() => set("options", toggleIn(b.options, o.key))}>{o.label}</Chip>)}
      </div>
      {durationField}
      <AutoText label="Observations (facultatif)" value={b.observations} onChange={(v) => set("observations", v)} />
    </div>
  );
}
