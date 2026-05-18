import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Play,
  Pause,
  X,
  Minus,
  Maximize2,
  Video as VideoIcon,
  Link as LinkIcon,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

type VideoKind = "youtube" | "vimeo" | "direct" | "unknown";

function detectKind(url: string): VideoKind {
  if (!url) return "unknown";
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/vimeo\.com/i.test(url)) return "vimeo";
  if (/\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(url) || url.includes("supabase.co/storage"))
    return "direct";
  return "unknown";
}

function getYouTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/
  );
  return m ? m[1] : null;
}

function getVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

function buildEmbedSrc(url: string): { kind: VideoKind; src: string | null } {
  const kind = detectKind(url);
  if (kind === "youtube") {
    const id = getYouTubeId(url);
    if (!id) return { kind, src: null };
    return {
      kind,
      src: `https://www.youtube.com/embed/${id}?enablejsapi=1&playsinline=1&rel=0`,
    };
  }
  if (kind === "vimeo") {
    const id = getVimeoId(url);
    if (!id) return { kind, src: null };
    return { kind, src: `https://player.vimeo.com/video/${id}?playsinline=1` };
  }
  if (kind === "direct") return { kind, src: url };
  return { kind: "unknown", src: null };
}

interface VideoCompanionPanelProps {
  /** Persisted state key (e.g. match id, round entry) */
  storageKey: string;
  /** Called when the user wants to also start the parent chrono */
  onStartChrono?: () => void;
  /** Called when the user wants to also pause the parent chrono */
  onPauseChrono?: () => void;
  /** Whether the parent chrono is currently running (for the combined button label) */
  chronoRunning?: boolean;
  /** Optional title shown in header */
  title?: string;
}

/**
 * Floating, resizable companion video panel for live match / combat capture.
 * - Paste a video URL (YouTube, Vimeo, or direct file)
 * - Play/pause the video
 * - Sync: one button starts both the video AND the parent chrono
 *
 * Never hosts the video — only reads/embeds from public URLs.
 */
export function VideoCompanionPanel({
  storageKey,
  onStartChrono,
  onPauseChrono,
  chronoRunning,
  title = "Vidéo du match",
}: VideoCompanionPanelProps) {
  const lsKey = `video-companion-${storageKey}`;
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [url, setUrl] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [playing, setPlaying] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Load persisted URL
  useEffect(() => {
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.url) {
          setUrl(parsed.url);
          setDraftUrl(parsed.url);
        }
      }
    } catch {
      /* noop */
    }
  }, [lsKey]);

  const persist = (next: { url: string }) => {
    try {
      localStorage.setItem(lsKey, JSON.stringify(next));
    } catch {
      /* noop */
    }
  };

  const { kind, src } = buildEmbedSrc(url);

  const sendYT = (func: "playVideo" | "pauseVideo") => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args: [] }),
      "*"
    );
  };
  const sendVimeo = (method: "play" | "pause") => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ method }),
      "*"
    );
  };

  const playVideo = () => {
    if (kind === "direct") videoRef.current?.play().catch(() => undefined);
    else if (kind === "youtube") sendYT("playVideo");
    else if (kind === "vimeo") sendVimeo("play");
    setPlaying(true);
  };

  const pauseVideo = () => {
    if (kind === "direct") videoRef.current?.pause();
    else if (kind === "youtube") sendYT("pauseVideo");
    else if (kind === "vimeo") sendVimeo("pause");
    setPlaying(false);
  };

  const handleConfirmUrl = () => {
    const v = draftUrl.trim();
    setUrl(v);
    persist({ url: v });
    setPlaying(false);
  };

  const handleSyncStart = () => {
    playVideo();
    onStartChrono?.();
  };

  const handleSyncPause = () => {
    pauseVideo();
    onPauseChrono?.();
  };

  // Floating launcher button when closed
  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <VideoIcon className="h-4 w-4" />
        Vidéo
      </Button>
    );
  }

  return (
    <>
      {/* Trigger placeholder (kept for layout) */}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <VideoIcon className="h-4 w-4" />
        Vidéo
      </Button>

      <div
        className={cn(
          "fixed z-50 bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col",
          "bottom-4 right-4",
          minimized ? "w-72 h-12" : "w-[min(640px,90vw)] h-[min(480px,80vh)]"
        )}
        style={{ resize: minimized ? undefined : "both" }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/60 border-b border-border shrink-0">
          <VideoIcon className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold truncate flex-1">{title}</span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setMinimized((m) => !m)}
            title={minimized ? "Agrandir" : "Réduire"}
          >
            {minimized ? <Maximize2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setOpen(false)}
            title="Fermer"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {!minimized && (
          <>
            {/* URL bar */}
            <div className="flex items-center gap-2 p-2 border-b border-border shrink-0">
              <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                value={draftUrl}
                onChange={(e) => setDraftUrl(e.target.value)}
                placeholder="Coller un lien YouTube, Vimeo ou MP4…"
                className="h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleConfirmUrl();
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8"
                onClick={handleConfirmUrl}
                disabled={!draftUrl.trim() || draftUrl.trim() === url}
              >
                Charger
              </Button>
              {url && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => window.open(url, "_blank")}
                  title="Ouvrir dans un nouvel onglet"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Player */}
            <div className="flex-1 min-h-0 bg-black flex items-center justify-center">
              {!src ? (
                <div className="text-center text-muted-foreground text-sm p-6">
                  {url
                    ? "Lien non reconnu. Utilisez YouTube, Vimeo ou un fichier vidéo direct (.mp4, .webm…)."
                    : "Collez un lien vidéo ci-dessus pour commencer."}
                </div>
              ) : kind === "direct" ? (
                <video
                  ref={videoRef}
                  src={src}
                  className="w-full h-full"
                  controls
                  playsInline
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                />
              ) : (
                <iframe
                  ref={iframeRef}
                  src={src}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>

            {/* Footer controls */}
            <div className="flex items-center gap-2 p-2 border-t border-border bg-muted/30 shrink-0">
              {playing || chronoRunning ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5 flex-1"
                  onClick={handleSyncPause}
                  disabled={!src}
                >
                  <Pause className="h-4 w-4" />
                  Pause vidéo + chrono
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5 flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleSyncStart}
                  disabled={!src}
                >
                  <Play className="h-4 w-4" />
                  Démarrer vidéo + chrono
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default VideoCompanionPanel;
