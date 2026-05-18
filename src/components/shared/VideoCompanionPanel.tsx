import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Play,
  Pause,
  X,
  Video as VideoIcon,
  Link as LinkIcon,
  ExternalLink,
} from "lucide-react";

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

interface VideoCompanionTriggerProps {
  open: boolean;
  onToggle: () => void;
  label?: string;
}

/** Toolbar button to open/close the dock. Place inside your existing toolbar. */
export function VideoCompanionTrigger({
  open,
  onToggle,
  label = "Vidéo",
}: VideoCompanionTriggerProps) {
  return (
    <Button
      type="button"
      size="sm"
      variant={open ? "default" : "outline"}
      onClick={onToggle}
      className="gap-1.5"
    >
      <VideoIcon className="h-4 w-4" />
      {label}
    </Button>
  );
}

interface VideoCompanionDockProps {
  open: boolean;
  onClose: () => void;
  storageKey: string;
  onStartChrono?: () => void;
  onPauseChrono?: () => void;
  chronoRunning?: boolean;
  title?: string;
}

/**
 * Inline dockable video panel. Renders nothing when closed.
 * Parent controls layout (e.g. flex with width). Designed to be wrapped in a
 * sticky <aside> so it stays visible while the coach logs actions.
 */
export function VideoCompanionDock({
  open,
  onClose,
  storageKey,
  onStartChrono,
  onPauseChrono,
  chronoRunning,
  title = "Vidéo du match",
}: VideoCompanionDockProps) {
  const lsKey = `video-companion-${storageKey}`;
  const [url, setUrl] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [playing, setPlaying] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  if (!open) return null;

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
    try {
      localStorage.setItem(lsKey, JSON.stringify({ url: v }));
    } catch {
      /* noop */
    }
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

  return (
    <div className="flex flex-col h-full w-full bg-card border border-border rounded-2xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/60 border-b border-border shrink-0">
        <VideoIcon className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold truncate flex-1">{title}</span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={onClose}
          title="Fermer"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

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
    </div>
  );
}

// Back-compat: legacy floating panel kept as default export, now an alias.
export const VideoCompanionPanel = VideoCompanionDock;
export default VideoCompanionDock;
