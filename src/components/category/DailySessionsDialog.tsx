import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Calendar, Pencil, ArrowRight, Printer, Clock, Dumbbell, Target, Swords, MapPin, Users } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface Session {
  id: string;
  session_date: string;
  session_start_time: string | null;
  session_end_time: string | null;
  training_type: string;
  intensity: number | null;
  notes: string | null;
}

interface Match {
  id: string;
  match_date: string;
  match_time: string | null;
  opponent: string;
  location: string | null;
  competition: string | null;
  is_home: boolean | null;
}

interface PlanningItem {
  id: string;
  day_of_week: number;
  time_slot: string | null;
  notes: string | null;
  template?: {
    name: string;
    session_type: string;
    duration_minutes: number | null;
    intensity: number | string | null;
  } | null;
}

interface DailySessionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  sessions: Session[];
  matches: Match[];
  planning: PlanningItem[];
  onEditSession: (session: Session) => void;
  onRescheduleSession: (sessionId: string, newDate: Date) => void;
  onViewMatch: (match: Match) => void;
  onViewSession: (session: Session) => void;
  trainingTypeLabels: Record<string, string>;
  trainingTypeColors: Record<string, string>;
  isViewer?: boolean;
}

export function DailySessionsDialog({
  open,
  onOpenChange,
  date,
  sessions,
  matches,
  planning,
  onEditSession,
  onRescheduleSession,
  onViewMatch,
  onViewSession,
  trainingTypeLabels,
  trainingTypeColors,
  isViewer = false,
}: DailySessionsDialogProps) {
  const [rescheduleSessionId, setRescheduleSessionId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(undefined);

  const handlePrint = () => {
    const printContent = document.getElementById("daily-sessions-print");
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Séances du ${format(date, "d MMMM yyyy", { locale: fr })}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .session { border: 1px solid #ddd; padding: 16px; margin-bottom: 12px; border-radius: 8px; }
            .session-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
            .badge { background: #e5e7eb; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
            .notes { color: #666; font-size: 14px; margin-top: 8px; }
            h1 { color: #333; }
            h2 { color: #555; font-size: 18px; margin-top: 24px; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleReschedule = (sessionId: string) => {
    if (rescheduleDate) {
      onRescheduleSession(sessionId, rescheduleDate);
      setRescheduleSessionId(null);
      setRescheduleDate(undefined);
    }
  };

  const totalEvents = sessions.length + matches.length + planning.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Calendar className="h-5 w-5 text-primary" />
              {format(date, "EEEE d MMMM yyyy", { locale: fr })}
            </DialogTitle>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimer
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {totalEvents} événement{totalEvents > 1 ? "s" : ""} prévu{totalEvents > 1 ? "s" : ""}
          </p>
        </DialogHeader>

        <div id="daily-sessions-print" className="space-y-6">
          {/* Matches */}
          {matches.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <Swords className="h-4 w-4" />
                Matchs ({matches.length})
              </h3>
              <div className="space-y-3">
                {matches.map((match) => (
                  <Card 
                    key={match.id} 
                    className="cursor-pointer hover:bg-accent/5 transition-colors"
                    onClick={() => onViewMatch(match)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-1.5 rounded-full bg-rose-500" />
                          <div>
                            <p className="font-medium">
                              {match.is_home ? "vs" : "@"} {match.opponent}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {match.match_time && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {match.match_time}
                                </span>
                              )}
                              {match.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {match.location}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {match.competition && (
                          <Badge variant="outline">{match.competition}</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {matches.length > 0 && (sessions.length > 0 || planning.length > 0) && (
            <Separator />
          )}

          {/* Sessions */}
          {sessions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <Dumbbell className="h-4 w-4" />
                Séances ({sessions.length})
              </h3>
              <div className="space-y-3">
                {sessions.map((session) => (
                  <Card 
                    key={session.id} 
                    className="cursor-pointer hover:bg-accent/5 transition-colors"
                    onClick={() => onViewSession(session)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <div className={cn(
                            "h-10 w-1.5 rounded-full",
                            trainingTypeColors[session.training_type] || "bg-muted"
                          )} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="secondary" className="font-normal">
                                {trainingTypeLabels[session.training_type] || session.training_type}
                              </Badge>
                              {session.intensity && (
                                <Badge variant="outline" className="text-xs">
                                  <Target className="h-3 w-3 mr-1" />
                                  Intensité {session.intensity}/10
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              {(session.session_start_time || session.session_end_time) && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {session.session_start_time?.slice(0, 5)}
                                  {session.session_end_time && ` - ${session.session_end_time.slice(0, 5)}`}
                                </span>
                              )}
                            </div>
                            {session.notes && (
                              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                {session.notes}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {!isViewer && (
                          <div className="flex items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                            {/* Reschedule button */}
                            <Popover 
                              open={rescheduleSessionId === session.id} 
                              onOpenChange={(open) => {
                                if (open) {
                                  setRescheduleSessionId(session.id);
                                } else {
                                  setRescheduleSessionId(null);
                                  setRescheduleDate(undefined);
                                }
                              }}
                            >
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" title="Décaler">
                                  <ArrowRight className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="end">
                                <div className="p-3 border-b">
                                  <p className="text-sm font-medium">Décaler la séance</p>
                                  <p className="text-xs text-muted-foreground">Choisissez une nouvelle date</p>
                                </div>
                                <CalendarPicker
                                  mode="single"
                                  selected={rescheduleDate}
                                  onSelect={setRescheduleDate}
                                  locale={fr}
                                  className="p-3 pointer-events-auto"
                                />
                                <div className="p-3 border-t flex justify-end gap-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => {
                                      setRescheduleSessionId(null);
                                      setRescheduleDate(undefined);
                                    }}
                                  >
                                    Annuler
                                  </Button>
                                  <Button 
                                    size="sm"
                                    disabled={!rescheduleDate}
                                    onClick={() => handleReschedule(session.id)}
                                  >
                                    Confirmer
                                  </Button>
                                </div>
                              </PopoverContent>
                            </Popover>
                            
                            {/* Edit button */}
                            <Button 
                              variant="ghost" 
                              size="icon"
                              title="Modifier"
                              onClick={() => onEditSession(session)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {(sessions.length > 0 && planning.length > 0) && <Separator />}

          {/* Planning */}
          {planning.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Planification ({planning.length})
              </h3>
              <div className="space-y-3">
                {planning.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-10 w-1.5 rounded-full",
                          item.template?.session_type 
                            ? trainingTypeColors[item.template.session_type] || "bg-primary"
                            : "bg-primary"
                        )} />
                        <div>
                          <p className="font-medium">
                            {item.template?.name || "Séance planifiée"}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {item.time_slot && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {item.time_slot}
                              </span>
                            )}
                            {item.template?.duration_minutes && (
                              <span>{item.template.duration_minutes} min</span>
                            )}
                          </div>
                          {item.notes && (
                            <p className="text-sm text-muted-foreground mt-1">{item.notes}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {totalEvents === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Aucun événement prévu ce jour</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
