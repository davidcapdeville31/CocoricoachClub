import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { 
  Dumbbell, 
  Target, 
  User, 
  PlayCircle, 
  ShieldAlert,
  Video,
  ExternalLink,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ExerciseVisual } from "./ExerciseVisual";
import { ExerciseDescriptionData } from "./ExerciseDescriptionCard";

interface ExerciseFocusPanelProps {
  isOpen: boolean;
  onClose: () => void;
  exerciseName: string;
  category: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  data: ExerciseDescriptionData;
  // Training params for context
  sets?: number;
  reps?: string;
  percentage?: number;
  tempo?: string;
  rpe?: number;
  restSeconds?: number;
  trainingStyle?: string;
  styleLabel?: string;
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
  <div className={cn("flex items-center gap-2 font-semibold text-sm", color)}>
    <Icon className="h-4 w-4" />
    <span>{title}</span>
  </div>
);

// Video URL helpers
const getYouTubeVideoId = (url: string) => {
  // Support for: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, youtube.com/embed/
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
  return videoId ? `https://player.vimeo.com/video/${videoId}` : null;
};

const getVideoType = (url: string | null | undefined): 'youtube' | 'vimeo' | 'direct' | null => {
  if (!url) return null;
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('vimeo.com')) return 'vimeo';
  return 'direct';
};

export const ExerciseFocusPanel = ({
  isOpen,
  onClose,
  exerciseName,
  category,
  imageUrl,
  videoUrl,
  data,
  sets,
  reps,
  percentage,
  tempo,
  rpe,
  restSeconds,
  trainingStyle,
  styleLabel,
}: ExerciseFocusPanelProps) => {
  const [showVideo, setShowVideo] = useState(false);
  
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
    
  const videoType = getVideoType(videoUrl);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()} modal={false}>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b bg-secondary/30">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <ExerciseVisual 
                imageUrl={imageUrl} 
                category={category} 
                exerciseName={exerciseName}
                size="lg" 
              />
              <div className="min-w-0">
                <SheetTitle className="text-base font-semibold truncate">
                  {exerciseName}
                </SheetTitle>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="outline" className="text-xs">
                    {category}
                  </Badge>
                  {styleLabel && trainingStyle !== "normal" && (
                    <Badge className="text-xs bg-primary/20 text-primary border-primary/30">
                      {styleLabel}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Training Params Summary */}
          {(sets || reps || percentage || tempo || rpe) && (
            <div className="flex flex-wrap gap-1.5 mt-2">
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
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Video Player - integrated */}
            {videoUrl && videoType && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <SectionHeader icon={Video} title="Vidéo de démonstration" color="text-primary" />
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setShowVideo(!showVideo)}
                    >
                      {showVideo ? "Masquer" : "Afficher"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => window.open(videoUrl, '_blank')}
                      title="Ouvrir dans un nouvel onglet"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                
                {showVideo && (
                  <div className="aspect-video bg-black rounded-lg overflow-hidden border flex items-center justify-center">
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
                        onError={(e) => {
                          console.error('Video error:', e);
                        }}
                      />
                    )}
                  </div>
                )}
                
                {!showVideo && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => setShowVideo(true)}
                  >
                    <PlayCircle className="h-4 w-4" />
                    Lancer la vidéo
                  </Button>
                )}
              </div>
            )}

            {/* Description générale */}
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
                  <div className="space-y-1.5 text-sm">
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
                  <div className="space-y-1.5 text-sm">
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
                    {execution.key_points && execution.key_points.length > 0 && (
                      <div className="pt-1">
                        <span className="font-medium">Points clés:</span>
                        <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-0.5">
                          {execution.key_points.map((point: string, idx: number) => (
                            <li key={idx}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
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

            {/* Empty state */}
            {!data.general_description && !hasPositioning && !hasExecution && !hasSafety && (
              <div className="text-center py-8 text-muted-foreground">
                <Dumbbell className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Aucune fiche technique disponible pour cet exercice.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default ExerciseFocusPanel;
