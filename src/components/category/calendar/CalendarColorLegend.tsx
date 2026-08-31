import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Palette } from "lucide-react";
import {
  ATHLETE_SESSION_COLOR_CLASS,
  TRAINING_TYPE_COLORS,
  getTrainingTypeLabel,
} from "@/lib/constants/trainingTypes";

interface CalendarColorLegendProps {
  sessions?: any[];
  matches?: any[];
  trainingTypeLabels?: Record<string, string>;
}

/**
 * Légende du code couleur du calendrier.
 * Générique : fonctionne pour toutes les disciplines et catégories.
 */
export function CalendarColorLegend({
  sessions = [],
  matches = [],
  trainingTypeLabels,
}: CalendarColorLegendProps) {
  const { t } = useTranslation();

  const items = useMemo(() => {
    const entries: { key: string; label: string; colorClass: string }[] = [];

    // Rose : séances ajoutées par un athlète (marqueur spécifique du calendrier)
    entries.push({
      key: "__athlete__",
      label: t("planning.calendarViews.legend.athlete"),
      colorClass: ATHLETE_SESSION_COLOR_CLASS,
    });

    // Exactement les 8 types d'événements créables depuis "Ajouter un événement"
    const baseTypes = [
      "musculation",
      "collectif",
      "video",
      "test",
      "reunion",
      "medical",
      "mental",
    ];

    baseTypes.forEach((type) => {
      entries.push({
        key: type,
        label: trainingTypeLabels?.[type] || getTrainingTypeLabel(type),
        colorClass:
          type === "mental"
            ? "bg-violet-500"
            : TRAINING_TYPE_COLORS[type] || "bg-primary",
      });
    });

    entries.push({
      key: "__match__",
      label: t("planning.calendarViews.legend.competition"),
      colorClass: TRAINING_TYPE_COLORS.match || "bg-rose-500",
    });

    // Déduplication par libellé pour éviter les doublons visuels
    const seen = new Set<string>();
    const unique = entries.filter((e) => {
      const k = `${e.label}|${e.colorClass}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    return unique;

  }, [trainingTypeLabels, t]);


  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border bg-surface-sunken/60 px-3 py-2">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Palette className="h-3.5 w-3.5" />
        {t("planning.calendarViews.legend.title")}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-1.5 text-[11px] sm:text-xs">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.colorClass}`} />
            <span className="text-foreground/80">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
