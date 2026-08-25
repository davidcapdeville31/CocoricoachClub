import { getDateLocale } from "@/lib/i18n/dateLocale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Dumbbell, 
  Stethoscope, 
  Video, 
  ClipboardList, 
  Users, 
  Calendar,
  Swords,
  Brain,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface AddEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  onAddSession: () => void;
  onAddMatch: () => void;
  onAddMedical?: () => void;
  onAddVideoAnalysis?: () => void;
  sportType?: string;
}

const EVENT_TYPE_META = [
  {
    id: "session",
    icon: Dumbbell,
    iconColor: "text-emerald-700 dark:text-emerald-300",
    iconBgColor: "bg-emerald-100 dark:bg-emerald-500/15",
    accentBorderColor: "border-l-emerald-500",
    hoverBorderColor: "hover:border-emerald-400 dark:hover:border-emerald-500",
  },
  {
    id: "match",
    icon: Swords,
    iconColor: "text-rose-700 dark:text-rose-300",
    iconBgColor: "bg-rose-100 dark:bg-rose-500/15",
    accentBorderColor: "border-l-rose-500",
    hoverBorderColor: "hover:border-rose-400 dark:hover:border-rose-500",
  },
  {
    id: "medical",
    icon: Stethoscope,
    iconColor: "text-sky-700 dark:text-sky-300",
    iconBgColor: "bg-sky-100 dark:bg-sky-500/15",
    accentBorderColor: "border-l-sky-500",
    hoverBorderColor: "hover:border-sky-400 dark:hover:border-sky-500",
  },
  {
    id: "video",
    icon: Video,
    iconColor: "text-purple-700 dark:text-purple-300",
    iconBgColor: "bg-purple-100 dark:bg-purple-500/15",
    accentBorderColor: "border-l-purple-500",
    hoverBorderColor: "hover:border-purple-400 dark:hover:border-purple-500",
  },
  {
    id: "test",
    icon: ClipboardList,
    iconColor: "text-amber-700 dark:text-amber-300",
    iconBgColor: "bg-amber-100 dark:bg-amber-500/15",
    accentBorderColor: "border-l-amber-500",
    hoverBorderColor: "hover:border-amber-400 dark:hover:border-amber-500",
  },
  {
    id: "team",
    icon: Users,
    iconColor: "text-indigo-700 dark:text-indigo-300",
    iconBgColor: "bg-indigo-100 dark:bg-indigo-500/15",
    accentBorderColor: "border-l-indigo-500",
    hoverBorderColor: "hover:border-indigo-400 dark:hover:border-indigo-500",
  },
  {
    id: "mental",
    icon: Brain,
    iconColor: "text-fuchsia-700 dark:text-fuchsia-300",
    iconBgColor: "bg-fuchsia-100 dark:bg-fuchsia-500/15",
    accentBorderColor: "border-l-fuchsia-500",
    hoverBorderColor: "hover:border-fuchsia-400 dark:hover:border-fuchsia-500",
  },
];

export function AddEventDialog({
  open,
  onOpenChange,
  date,
  onAddSession,
  onAddMatch,
  onAddMedical,
  onAddVideoAnalysis,
  sportType,
}: AddEventDialogProps) {
  const { t } = useTranslation();
  const isBowling = (sportType || "").toLowerCase().includes("bowling");
  const eventTypes = EVENT_TYPE_META.map((e) =>
    e.id === "match" && isBowling
      ? {
          ...e,
          label: t("planning.calendarDialogs.addEvent.types.matchBowling.label"),
          description: t("planning.calendarDialogs.addEvent.types.matchBowling.description"),
        }
      : {
          ...e,
          label: t(`planning.calendarDialogs.addEvent.types.${e.id}.label`),
          description: t(`planning.calendarDialogs.addEvent.types.${e.id}.description`),
        }
  );
  const handleEventClick = (eventType: string) => {
    switch (eventType) {
      case "session":
        onAddSession();
        break;
      case "match":
        onAddMatch();
        break;
      case "medical":
        if (onAddMedical) onAddMedical();
        break;
      case "video":
        if (onAddVideoAnalysis) onAddVideoAnalysis();
        break;
      case "test":
        // Opens session dialog with test type pre-selected
        onAddSession();
        break;
      case "team":
        onAddSession();
        break;
      case "mental":
        onAddSession();
        break;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-border/70 bg-background/95 shadow-2xl backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Calendar className="h-5 w-5 text-primary" />
            {t("planning.calendarDialogs.addEvent.title")}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {format(date, "EEEE d MMMM yyyy", { locale: getDateLocale() })}
          </p>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 mt-2">
          {eventTypes.map((event) => {
            const Icon = event.icon;
            return (
              <Card
                key={event.id}
                className={cn(
                  "cursor-pointer border border-border/70 border-l-4 bg-card/95 transition-all duration-200 hover:bg-accent/50 hover:shadow-lg hover:scale-[1.02]",
                  "dark:bg-card dark:hover:bg-muted/70",
                  event.accentBorderColor,
                  event.hoverBorderColor,
                )}
                onClick={() => handleEventClick(event.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn("rounded-lg p-2", event.iconBgColor)}>
                      <Icon className={cn("h-5 w-5", event.iconColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-tight text-foreground">
                        {event.label}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground dark:text-foreground/80 line-clamp-2">
                        {event.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
