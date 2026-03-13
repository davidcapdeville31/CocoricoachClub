import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, Link, Film, X, FileVideo } from "lucide-react";

const ACCEPTED_VIDEO_FORMATS = ".mp4,.mov,.webm,.avi,.mkv,.m4v,.3gp,.flv,.wmv";
const MAX_FILE_SIZE_MB = 200;

interface VideoFileUploadProps {
  onFileUploaded: (url: string, source: "upload" | "url") => void;
  currentUrl?: string;
  label?: string;
  compact?: boolean;
}

export function VideoFileUpload({
  onFileUploaded,
  currentUrl,
  label = "Vidéo",
  compact = false,
}: VideoFileUploadProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"url" | "upload">(currentUrl ? "url" : "upload");
  const [urlValue, setUrlValue] = useState(currentUrl || "");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`Fichier trop volumineux (max ${MAX_FILE_SIZE_MB} MB)`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const filePath = `${user?.id}/${crypto.randomUUID()}.${ext}`;

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 500);

      const { data, error } = await supabase.storage
        .from("videos")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      clearInterval(progressInterval);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("videos")
        .getPublicUrl(data.path);

      setUploadProgress(100);
      setUploadedFileName(file.name);
      onFileUploaded(urlData.publicUrl, "upload");
      toast.success("Vidéo uploadée avec succès");
    } catch (err: any) {
      toast.error("Erreur upload: " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUrlSubmit = () => {
    if (!urlValue.trim()) return;
    onFileUploaded(urlValue.trim(), "url");
  };

  if (compact) {
    return (
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Film className="h-4 w-4" />
          {label}
        </Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === "upload" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("upload")}
          >
            <Upload className="h-3 w-3 mr-1" />
            Fichier
          </Button>
          <Button
            type="button"
            variant={mode === "url" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("url")}
          >
            <Link className="h-3 w-3 mr-1" />
            URL
          </Button>
        </div>

        {mode === "upload" ? (
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_VIDEO_FORMATS}
              onChange={handleFileSelect}
              className="hidden"
            />
            {uploadedFileName ? (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md text-sm">
                <FileVideo className="h-4 w-4 text-primary" />
                <span className="truncate flex-1">{uploadedFileName}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    setUploadedFileName(null);
                    onFileUploaded("", "upload");
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? "Upload en cours..." : "Choisir un fichier vidéo"}
              </Button>
            )}
            {uploading && <Progress value={uploadProgress} className="h-2" />}
            <p className="text-xs text-muted-foreground">
              MP4, MOV, WebM, AVI, MKV — max {MAX_FILE_SIZE_MB} MB
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              value={urlValue}
              onChange={(e) => {
                setUrlValue(e.target.value);
                if (e.target.value.trim()) {
                  onFileUploaded(e.target.value.trim(), "url");
                }
              }}
              placeholder="https://youtube.com/... ou VEO, Hudl..."
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        <Film className="h-4 w-4" />
        {label}
      </Label>

      {/* Mode selector */}
      <div className="flex rounded-lg border overflow-hidden">
        <button
          type="button"
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
            mode === "upload"
              ? "bg-primary text-primary-foreground"
              : "bg-background hover:bg-muted"
          }`}
          onClick={() => setMode("upload")}
        >
          <Upload className="h-4 w-4" />
          Upload Fichier
        </button>
        <button
          type="button"
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors ${
            mode === "url"
              ? "bg-primary text-primary-foreground"
              : "bg-background hover:bg-muted"
          }`}
          onClick={() => setMode("url")}
        >
          <Link className="h-4 w-4" />
          Lien Externe
        </button>
      </div>

      {mode === "upload" ? (
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_VIDEO_FORMATS}
            onChange={handleFileSelect}
            className="hidden"
          />

          {uploadedFileName ? (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <FileVideo className="h-5 w-5 text-primary flex-shrink-0" />
              <span className="text-sm truncate flex-1">{uploadedFileName}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  setUploadedFileName(null);
                  onFileUploaded("", "upload");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              className="flex flex-col items-center gap-3 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  {uploading ? "Upload en cours..." : "Cliquez pour sélectionner"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  MP4, MOV, WebM, AVI, MKV — max {MAX_FILE_SIZE_MB} MB
                </p>
              </div>
            </div>
          )}

          {uploading && (
            <div className="space-y-1">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {uploadProgress}%
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <Input
            value={urlValue}
            onChange={(e) => {
              setUrlValue(e.target.value);
              if (e.target.value.trim()) {
                onFileUploaded(e.target.value.trim(), "url");
              }
            }}
            placeholder="https://app.veo.co/... ou YouTube, Vimeo, Hudl..."
          />
          <p className="text-xs text-muted-foreground">
            Collez le lien de votre vidéo hébergée (VEO, YouTube, Vimeo, Hudl, Google Drive...)
          </p>
        </div>
      )}
    </div>
  );
}
