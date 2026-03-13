import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Play, Pause, Volume2, VolumeX, Maximize, 
  SkipBack, SkipForward, ExternalLink 
} from "lucide-react";

interface InlineVideoPlayerProps {
  url: string;
  startTime?: number;
  endTime?: number | null;
  title?: string;
  className?: string;
}

/**
 * Detects if a URL is a direct video file (uploaded) vs an external platform.
 */
function isDirectVideoUrl(url: string): boolean {
  if (!url) return false;
  // Supabase storage URLs or direct file URLs
  if (url.includes("supabase.co/storage")) return true;
  // Common video extensions
  if (/\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(url)) return true;
  return false;
}

/**
 * Convert external URLs to embeddable format
 */
function getEmbedUrl(url: string): string | null {
  // YouTube
  const ytMatch = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/
  );
  if (ytMatch) {
    return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=0&rel=0`;
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  return null;
}

export function InlineVideoPlayer({
  url,
  startTime = 0,
  endTime,
  title,
  className = "",
}: InlineVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  if (!url) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
          <p>Aucune vidéo disponible</p>
        </CardContent>
      </Card>
    );
  }

  const isDirect = isDirectVideoUrl(url);
  const embedUrl = !isDirect ? getEmbedUrl(url) : null;

  // Direct video file → native HTML5 player
  if (isDirect) {
    const togglePlay = () => {
      if (!videoRef.current) return;
      if (playing) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setPlaying(!playing);
    };

    const formatTimestamp = (s: number) => {
      const mins = Math.floor(s / 60);
      const secs = Math.floor(s % 60);
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    return (
      <Card className={className}>
        <CardContent className="p-0 overflow-hidden rounded-lg">
          {title && (
            <div className="px-3 py-2 bg-muted/50 border-b text-sm font-medium truncate">
              {title}
            </div>
          )}
          <div className="relative bg-black">
            <video
              ref={videoRef}
              src={url}
              className="w-full max-h-[500px]"
              onTimeUpdate={() => {
                if (videoRef.current) {
                  setCurrentTime(videoRef.current.currentTime);
                  // Auto-stop at endTime
                  if (endTime && videoRef.current.currentTime >= endTime) {
                    videoRef.current.pause();
                    setPlaying(false);
                  }
                }
              }}
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  setDuration(videoRef.current.duration);
                  if (startTime > 0) {
                    videoRef.current.currentTime = startTime;
                  }
                }
              }}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onClick={togglePlay}
              playsInline
            />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={togglePlay}>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => {
                if (videoRef.current) videoRef.current.currentTime -= 5;
              }}
            >
              <SkipBack className="h-4 w-4" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => {
                if (videoRef.current) videoRef.current.currentTime += 5;
              }}
            >
              <SkipForward className="h-4 w-4" />
            </Button>

            {/* Progress bar */}
            <div className="flex-1 mx-2">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={(e) => {
                  const t = parseFloat(e.target.value);
                  if (videoRef.current) videoRef.current.currentTime = t;
                  setCurrentTime(t);
                }}
                className="w-full h-1 accent-primary cursor-pointer"
              />
            </div>

            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatTimestamp(currentTime)} / {formatTimestamp(duration)}
            </span>

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => {
                setMuted(!muted);
                if (videoRef.current) videoRef.current.muted = !muted;
              }}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => videoRef.current?.requestFullscreen?.()}
            >
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Embeddable external (YouTube, Vimeo)
  if (embedUrl) {
    const embedWithTime = startTime
      ? embedUrl.includes("youtube")
        ? `${embedUrl}&start=${Math.floor(startTime)}`
        : `${embedUrl}#t=${Math.floor(startTime)}s`
      : embedUrl;

    return (
      <Card className={className}>
        <CardContent className="p-0 overflow-hidden rounded-lg">
          {title && (
            <div className="px-3 py-2 bg-muted/50 border-b text-sm font-medium truncate">
              {title}
            </div>
          )}
          <div className="relative" style={{ paddingBottom: "56.25%" }}>
            <iframe
              src={embedWithTime}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  // External platform (VEO, Hudl, etc.) — just link
  return (
    <Card className={className}>
      <CardContent className="flex flex-col items-center justify-center py-8 gap-3">
        {title && <p className="text-sm font-medium">{title}</p>}
        <p className="text-sm text-muted-foreground text-center">
          Cette vidéo est hébergée sur une plateforme externe
        </p>
        <Button variant="outline" onClick={() => window.open(url, "_blank")}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Ouvrir la vidéo
        </Button>
      </CardContent>
    </Card>
  );
}
