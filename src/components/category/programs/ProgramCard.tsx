import { getDateLocale } from "@/lib/i18n/dateLocale";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Copy, Eye, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface ProgramCardProps {
  program: any;
  onEdit: (programId: string) => void;
  onDuplicate: (programId: string) => void;
  onAssign: (programId: string) => void;
  onDelete: (programId: string) => void;
  onViewDetails: (programId: string) => void;
  isViewer?: boolean;
}

export function ProgramCard({
  program,
  onEdit,
  onDuplicate,
  onAssign,
  onDelete,
  onViewDetails,
  isViewer = false,
}: ProgramCardProps) {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);

  const totalWeeks = program.program_weeks?.length || 0;
  const totalSessions = program.program_weeks?.reduce(
    (sum: number, week: any) => sum + (week.program_sessions?.length || 0),
    0
  ) || 0;
  const assignedPlayers = program.program_assignments?.filter((a: any) => a.is_active)?.length || 0;

  const getLevelLabel = (level: string) => {
    switch (level) {
      case "beginner": return t("programmation.card.level.beginner");
      case "intermediate": return t("programmation.card.level.intermediate");
      case "advanced": return t("programmation.card.level.advanced");
      default: return level;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "beginner": return "bg-green-500/20 text-green-700 dark:text-green-400";
      case "intermediate": return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400";
      case "advanced": return "bg-red-500/20 text-red-700 dark:text-red-400";
      default: return "bg-muted";
    }
  };

  return (
    <Card 
      className={cn(
        "relative transition-all duration-200 group",
        program.is_active && "border-primary/50",
        isHovered && "shadow-lg"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Hover overlay with action buttons */}
      <div 
        className={cn(
          "absolute inset-0 bg-background/90 backdrop-blur-sm rounded-lg z-10 flex flex-col items-center justify-center gap-3 transition-opacity duration-200",
          isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {!isViewer && (
          <>
            <div className="grid grid-cols-2 gap-2 w-full max-w-[240px] px-4">
              <Button 
                onClick={() => onAssign(program.id)}
                className="gap-2"
              >
                <Play className="h-4 w-4" />
                {t("programmation.card.apply")}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => onViewDetails(program.id)}
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                {t("programmation.card.details")}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => onDuplicate(program.id)}
                className="gap-2"
              >
                <Copy className="h-4 w-4" />
                {t("programmation.card.copy")}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => onEdit(program.id)}
                className="gap-2"
              >
                <Edit className="h-4 w-4" />
                {t("programmation.card.edit")}
              </Button>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(program.id)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {t("programmation.card.delete")}
            </Button>
          </>
        )}
        {isViewer && (
          <Button 
            variant="outline" 
            onClick={() => onViewDetails(program.id)}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            {t("programmation.card.viewDetails")}
          </Button>
        )}
      </div>

      {/* Card content */}
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{program.name}</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={getLevelColor(program.level)}>
                {getLevelLabel(program.level)}
              </Badge>
              {program.is_active && (
                <Badge variant="default" className="bg-green-500">{t("programmation.card.active")}</Badge>
              )}
              {program.theme && (
                <Badge variant="outline" className="capitalize">
                  {program.theme}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {program.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {program.description}
          </p>
        )}

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{t("programmation.card.weeks", { count: totalWeeks })}</span>
          <span>{t("programmation.card.sessions", { count: totalSessions })}</span>
          <span>{t("programmation.card.athletes", { count: assignedPlayers })}</span>
        </div>

        <p className="text-xs text-muted-foreground">
          {t("programmation.card.createdOn", { date: format(new Date(program.created_at), "dd MMM yyyy", { locale: getDateLocale() }) })}
        </p>
      </CardContent>
    </Card>
  );
}
