import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Target, 
  User, 
  PlayCircle, 
  ShieldAlert,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExerciseDescriptionData } from "./ExerciseDescriptionCard";

interface ExerciseVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  exerciseName: string;
  category: string;
  videoUrl?: string | null;
  data: ExerciseDescriptionData;
  sets?: number;
  reps?: string;
  percentage?: number;
  tempo?: string;
  rpe?: number;
  restSeconds?: number;
}

const SectionHeader = ({ 
  icon: Icon, 
  title, 
  color 
}: { 
  icon: React.ElementType; 
  title: string; 
  color: string;
}) => (
  <div className={`flex items-center gap-2 font-semibold text-sm ${color}`}>
    <Icon className="h-4 w-4" />
    <span>{title}</span>
  </div>
);

// Video URL helpers
const getYouTubeVideoId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

const getYouTubeEmbedUrl = (url: string) => {
  const videoId = getYouTubeVideoId(url);
  return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : null;
};

const getVimeoVideoId = (url: string) => {
  const regExp = /(?:vimeo.com\/|player.vimeo.com\/video\/)(\d+)/;
  const match = url.match(regExp);
  return match ? match[1] : null;
};

const getVimeoEmbedUrl = (url: string) => {
  const videoId = getVimeoVideoId(url);
  return videoId ? `https://player.vimeo.com/video/${videoId}?autoplay=1` : null;
};

const getVideoType = (url: string | null | undefined): 'youtube' | 'vimeo' | 'direct' | null => {
  if (!url) return null;
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('vimeo.com')) return 'vimeo';
  return 'direct';
};

export const ExerciseVideoModal = ({
  isOpen,
  onClose,
  exerciseName,
  category,
  videoUrl,
  data,
  sets,
  reps,
  percentage,
  tempo,
  rpe,
  restSeconds,
}: ExerciseVideoModalProps) => {
  const videoType = getVideoType(videoUrl);
  
  const positioning = data.positioning_criteria || {};
  const execution = data.execution_criteria || {};
  const safety = data.safety_prevention || {};

  const hasPositioning = Object.values(positioning).some(v => v);
  const hasExecution = execution.movement_flow || execution.range_of_motion || 
    execution.speed_control || execution.breathing || 
    (execution.key_points && execution.key_points.length > 0);
  const hasSafety = (safety.common_errors && safety.common_errors.length > 0) ||
    (safety.risk_zones && safety.risk_zones.length > 0) ||
    safety.safety_instructions;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} modal={false}>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      )}
      <DialogContent className="max-w-4xl h-[90vh] p-0 flex flex-col overflow-hidden z-50">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold">{exerciseName}</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{category}</Badge>
                {(sets || reps || percentage) && (
                  <div className="flex gap-1.5">
                    {sets && reps && (
                      <Badge variant="secondary" className="text-xs">
                        {sets}×{reps}
                      </Badge>
                    )}
                    {percentage && (
                      <Badge variant="secondary" className="text-xs">
                        @{percentage}%
                      </Badge>
                    )}
                    {tempo && (
                      <Badge variant="secondary" className="text-xs">
                        Tempo {tempo}
                      </Badge>
                    )}
                    {rpe && (
                      <Badge variant="secondary" className="text-xs">
                        RPE {rpe}
                      </Badge>
                    )}
                    {restSeconds && (
                      <Badge variant="secondary" className="text-xs">
                        {restSeconds}s repos
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
            {videoUrl && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => window.open(videoUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
                Ouvrir en externe
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-scroll px-6 pb-6 scrollbar-custom">
          {/* Large Video Player */}
          {videoUrl && videoType && (
            <div className="aspect-video bg-black rounded-lg overflow-hidden mb-6 max-h-[50vh]">
              {videoType === 'youtube' && (
                <iframe
                  key={videoUrl}
                  src={getYouTubeEmbedUrl(videoUrl) || ''}
                  className="w-full h-full"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              )}
              {videoType === 'vimeo' && (
                <iframe
                  key={videoUrl}
                  src={getVimeoEmbedUrl(videoUrl) || ''}
                  className="w-full h-full"
                  allowFullScreen
                  allow="autoplay; fullscreen; picture-in-picture"
                />
              )}
              {videoType === 'direct' && (
                <video
                  key={videoUrl}
                  src={videoUrl}
                  className="w-full h-full"
                  controls
                  autoPlay
                  playsInline
                  preload="auto"
                />
              )}
            </div>
          )}

          {/* No video message */}
          {!videoUrl && (
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center mb-6">
              <p className="text-muted-foreground">Aucune vidéo disponible pour cet exercice</p>
            </div>
          )}

          {/* Exercise Details */}
          <div className="space-y-4">
            {data.general_description && (
              <div className="space-y-2">
                <SectionHeader icon={Target} title="Description générale" color="text-primary" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {data.general_description}
                </p>
              </div>
            )}

            {hasPositioning && (
              <>
                <Separator />
                <div className="space-y-2">
                  <SectionHeader icon={User} title="Critères de positionnement" color="text-blue-600 dark:text-blue-400" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    {positioning.body_placement && (
                      <div><span className="font-medium">Placement du corps:</span> <span className="text-muted-foreground">{positioning.body_placement}</span></div>
                    )}
                    {positioning.feet_position && (
                      <div><span className="font-medium">Position des pieds:</span> <span className="text-muted-foreground">{positioning.feet_position}</span></div>
                    )}
                    {positioning.hands_grip && (
                      <div><span className="font-medium">Prise/mains:</span> <span className="text-muted-foreground">{positioning.hands_grip}</span></div>
                    )}
                    {positioning.joint_alignment && (
                      <div><span className="font-medium">Alignement:</span> <span className="text-muted-foreground">{positioning.joint_alignment}</span></div>
                    )}
                    {positioning.initial_posture && (
                      <div><span className="font-medium">Posture initiale:</span> <span className="text-muted-foreground">{positioning.initial_posture}</span></div>
                    )}
                  </div>
                </div>
              </>
            )}

            {hasExecution && (
              <>
                <Separator />
                <div className="space-y-2">
                  <SectionHeader icon={PlayCircle} title="Critères de réalisation" color="text-emerald-600 dark:text-emerald-400" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    {execution.movement_flow && (
                      <div><span className="font-medium">Déroulement:</span> <span className="text-muted-foreground">{execution.movement_flow}</span></div>
                    )}
                    {execution.range_of_motion && (
                      <div><span className="font-medium">Amplitude:</span> <span className="text-muted-foreground">{execution.range_of_motion}</span></div>
                    )}
                    {execution.speed_control && (
                      <div><span className="font-medium">Vitesse/contrôle:</span> <span className="text-muted-foreground">{execution.speed_control}</span></div>
                    )}
                    {execution.breathing && (
                      <div><span className="font-medium">Respiration:</span> <span className="text-muted-foreground">{execution.breathing}</span></div>
                    )}
                  </div>
                  {execution.key_points && execution.key_points.length > 0 && (
                    <div className="pt-1">
                      <span className="font-medium text-sm">Points clés:</span>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-0.5 text-sm">
                        {execution.key_points.map((point: string, idx: number) => (
                          <li key={idx}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </>
            )}

            {hasSafety && (
              <>
                <Separator />
                <div className="space-y-2">
                  <SectionHeader icon={ShieldAlert} title="Sécurité / prévention" color="text-amber-600 dark:text-amber-400" />
                  <div className="space-y-2 text-sm">
                    {safety.common_errors && safety.common_errors.length > 0 && (
                      <div>
                        <span className="font-medium text-destructive">Erreurs à éviter:</span>
                        <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-0.5">
                          {safety.common_errors.map((error: string, idx: number) => (
                            <li key={idx}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {safety.risk_zones && safety.risk_zones.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="font-medium">Zones à risque:</span>
                        {safety.risk_zones.map((zone: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-xs border-amber-500 text-amber-600">
                            {zone}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {safety.safety_instructions && (
                      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-2">
                        <span className="font-medium text-amber-800 dark:text-amber-300">⚠️ Important:</span>
                        <p className="text-amber-700 dark:text-amber-400 mt-1">{safety.safety_instructions}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExerciseVideoModal;
