import { useState } from "react";
import { Bell, Trash2, BarChart3, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { isIndividualSport } from "@/lib/constants/sportTypes";
import { getCompetitionColor } from "@/lib/constants/competitionColors";

interface Match {
  id: string;
  match_date: string;
  match_time: string | null;
  opponent: string;
  location: string | null;
  is_home: boolean | null;
  competition?: string | null;
}


interface MatchVignetteProps {
  match: Match;
  sportType: string | undefined;
  isViewer: boolean;
  creatorName?: string | null;
  onClick: () => void;
  onNotify?: () => void;
  onStats?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
}

export function MatchVignette({
  match,
  sportType,
  isViewer,
  creatorName,
  onClick,
  onNotify,
  onStats,
  onDelete,
  onEdit,
}: MatchVignetteProps) {
  const [isHovered, setIsHovered] = useState(false);

  const formatTime = (time: string | null) => {
    if (!time) return "";
    return time.substring(0, 5);
  };

  const handleNotifyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onNotify?.();
  };

  const handleStatsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onStats?.();
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onEdit?.();
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (confirm("Supprimer ce match ?")) {
      onDelete?.();
    }
  };

  const color = getCompetitionColor(match.competition);
  const compLabel = match.competition?.trim() || null;

  return (
    <div
      className={cn(
        "relative group",
        isHovered && "z-50"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <div
        className={cn(
          "text-white text-[11px] px-2 py-1.5 rounded-lg truncate font-medium cursor-pointer transition-colors relative overflow-hidden",
          color.bg,
          color.bgHover
        )}
        title={`${match.match_time ? formatTime(match.match_time) + " - " : ""}${compLabel ? compLabel + " · " : ""}${match.opponent}${creatorName ? " · créé par " + creatorName : ""}`}
      >
        {/* Match content - hidden when hovered to show action buttons */}
        <div className={cn(
          "flex items-center gap-1 transition-opacity",
          isHovered && !isViewer && (onEdit || onNotify || onStats || onDelete) && "opacity-0"
        )}>
          {match.match_time && (
            <>
              <span className="font-bold mr-1">{formatTime(match.match_time)}</span>
              <span className="opacity-70">•</span>
            </>
          )}
          <span className="ml-1 opacity-95 truncate">
            {compLabel
              ? compLabel
              : isIndividualSport(sportType || "")
                ? (creatorName || match.opponent || "Compét.")
                : match.opponent}
          </span>
        </div>

        {/* Hover Actions Overlay */}
        {isHovered && !isViewer && (onEdit || onNotify || onStats || onDelete) && (
          <div className={cn(
            "absolute inset-0 flex items-center justify-center gap-2 rounded-lg z-[100] animate-fade-in",
            color.bgSolidDark
          )}>

            {onEdit && (
              <button
                onClick={handleEditClick}
                className="p-1.5 rounded-md hover:bg-white/20 transition-colors"
                title="Modifier / convoquer les athlètes"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {onNotify && (
              <button
                onClick={handleNotifyClick}
                className="p-1.5 rounded-md hover:bg-white/20 transition-colors"
                title="Notifier les athlètes"
              >
                <Bell className="h-4 w-4" />
              </button>
            )}
            {onStats && (
              <button
                onClick={handleStatsClick}
                className="p-1.5 rounded-md hover:bg-white/20 transition-colors"
                title="Statistiques du match"
              >
                <BarChart3 className="h-4 w-4" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={handleDeleteClick}
                className="p-1.5 rounded-md hover:bg-white/20 transition-colors flex items-center gap-1"
                title="Supprimer le match"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

