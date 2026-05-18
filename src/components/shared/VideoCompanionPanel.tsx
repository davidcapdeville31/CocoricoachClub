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

type VideoKind =
  | "youtube"
  | "vimeo"
  | "veo"
  | "dailymotion"
  | "twitch"
  | "facebook"
  | "streamable"
  | "wistia"
  | "hudl"
  | "ffr"
  | "direct"
  | "iframe"
  | "unknown";

function detectKind(url: string): VideoKind {
  if (!url) return "unknown";
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/vimeo\.com/i.test(url)) return "vimeo";
  if (/veo\.co/i.test(url)) return "veo";
  if (/dailymotion\.com|dai\.ly/i.test(url)) return "dailymotion";
  if (/twitch\.tv/i.test(url)) return "twitch";
  if (/facebook\.com\/.+\/videos|fb\.watch/i.test(url)) return "facebook";
  if (/streamable\.com/i.test(url)) return "streamable";
  if (/wistia\.com|wi\.st/i.test(url)) return "wistia";
  if (/hudl\.com/i.test(url)) return "hudl";
  if (/fromsmash\.com/i.test(url)) return "ffr";
  if (/\.(mp4|webm|mov|m4v|ogg|m3u8)(\?|$)/i.test(url) || url.includes("supabase.co/storage"))
    return "direct";
  if (/^https?:\/\//i.test(url)) return "iframe";
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

function getVeoEmbed(url: string): string | null {
  // VEO match URLs look like https://app.veo.co/matches/<id>/ optionally with ?highlight=<hid>
  const m = url.match(/veo\.co\/matches\/([^/?#]+)/i);
  if (!m) return null;
  const matchId = m[1];
  const highlight = url.match(/[?&]highlight=([^&]+)/i)?.[1];
  // VEO supports embed via /matches/<id>/?embed=true ; highlight propagates if present
  const base = `https://app.veo.co/matches/${matchId}/?embed=true`;
  return highlight ? `${base}&highlight=${highlight}` : base;
}

function getDailymotionEmbed(url: string): string | null {
  const m = url.match(/(?:dailymotion\.com\/(?:video|embed\/video)\/|dai\.ly\/)([A-Za-z0-9]+)/i);
  return m ? `https://www.dailymotion.com/embed/video/${m[1]}` : null;
}

function getTwitchEmbed(url: string): string | null {
  const parent = typeof window !== "undefined" ? window.location.hostname : "lovable.app";
  const video = url.match(/twitch\.tv\/videos\/(\d+)/i);
  if (video) return `https://player.twitch.tv/?video=${video[1]}&parent=${parent}&autoplay=false`;
  const channel = url.match(/twitch\.tv\/([A-Za-z0-9_]+)/i);
  if (channel) return `https://player.twitch.tv/?channel=${channel[1]}&parent=${parent}&autoplay=false`;
  return null;
}

function getFacebookEmbed(url: string): string {
  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`;
}

function getStreamableEmbed(url: string): string | null {
  const m = url.match(/streamable\.com\/([A-Za-z0-9]+)/i);
  return m ? `https://streamable.com/e/${m[1]}` : null;
}

function getWistiaEmbed(url: string): string | null {
  const m = url.match(/wistia\.com\/medias\/([A-Za-z0-9]+)/i);
  return m ? `https://fast.wistia.net/embed/iframe/${m[1]}` : null;
}

function getFfrFromSmashEmbed(url: string): string | null {
  // fromsmash URLs: https://fromsmash.com/XXXXX or https://ffr.fromsmash.com/XXXXX
  const m = url.match(/(?:ffr\.)?fromsmash\.com\/([A-Za-z0-9_-]+)/i);
  if (!m) return null;
  return `https://player.fromsmash.com/${m[1]}`;
}

function buildEmbedSrc(url: string): { kind: VideoKind; src: string | null } {
  const kind = detectKind(url);
  if (kind === "youtube") {
    const id = getYouTubeId(url);
    return { kind, src: id ? `https://www.youtube.com/embed/${id}?enablejsapi=1&playsinline=1&rel=0` : null };
  }
  if (kind === "vimeo") {
    const id = getVimeoId(url);
    return { kind, src: id ? `https://player.vimeo.com/video/${id}?playsinline=1` : null };
  }
  if (kind === "veo") return { kind, src: getVeoEmbed(url) ?? url };
  if (kind === "dailymotion") return { kind, src: getDailymotionEmbed(url) };
  if (kind === "twitch") return { kind, src: getTwitchEmbed(url) };
  if (kind === "facebook") return { kind, src: getFacebookEmbed(url) };
  if (kind === "streamable") return { kind, src: getStreamableEmbed(url) };
  if (kind === "wistia") return { kind, src: getWistiaEmbed(url) };
  if (kind === "hudl") return { kind, src: url };
  if (kind === "direct") return { kind, src: url };
  if (kind === "iframe") return { kind, src: url };
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
              ? "Lien invalide. Collez une URL https:// (YouTube, Vimeo, VEO, Dailymotion, Twitch, Facebook, Streamable, Wistia, Hudl, MP4/WebM…)."
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
