import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut, RotateCcw, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LogoCrop } from "@/contexts/ClubBrandingContext";

const defaultCrop: LogoCrop = { scale: 1, positionX: 0, positionY: 0 };

interface Props {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  initialCrop?: LogoCrop | null;
  onSave: (crop: LogoCrop) => void;
}

export function LogoCropModal({ isOpen, onClose, imageUrl, initialCrop, onSave }: Props) {
  const [crop, setCrop] = useState<LogoCrop>(initialCrop || defaultCrop);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (isOpen) setCrop(initialCrop || defaultCrop); }, [isOpen, initialCrop]);

  const getMaxOffset = (scale: number) => {
    if (scale >= 1) return 50 + ((scale - 1) / scale) * 50;
    // When the image is shrunk it already fits entirely in the frame,
    // so panning is not needed.
    return 0;
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragStart.x) / rect.width) * 100;
    const dy = ((e.clientY - dragStart.y) / rect.height) * 100;
    const max = getMaxOffset(crop.scale);
    setCrop(prev => ({
      ...prev,
      positionX: Math.max(-max, Math.min(max, prev.positionX + dx)),
      positionY: Math.max(-max, Math.min(max, prev.positionY + dy)),
    }));
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, dragStart, crop.scale]);

  const handleScale = (v: number[]) => {
    const newScale = v[0];
    const max = getMaxOffset(newScale);
    setCrop(prev => ({
      ...prev,
      scale: newScale,
      positionX: Math.max(-max, Math.min(max, prev.positionX)),
      positionY: Math.max(-max, Math.min(max, prev.positionY)),
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Recadrer le logo</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div
            ref={containerRef}
            className={cn("relative overflow-hidden rounded-lg bg-muted mx-auto", isDragging ? "cursor-grabbing" : "cursor-grab")}
            style={{ aspectRatio: 1, maxHeight: 400, width: "100%" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
          >
            <img
              src={imageUrl}
              alt="Recadrage"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
              style={{
                transform: `scale(${crop.scale}) translate(${crop.positionX / crop.scale}%, ${crop.positionY / crop.scale}%)`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              }}
              draggable={false}
            />
          </div>
          <div className="flex items-center gap-4 px-4">
            <ZoomOut className="h-4 w-4 text-muted-foreground" />
            <Slider value={[crop.scale]} onValueChange={handleScale} min={1} max={3} step={0.05} className="flex-1" />
            <ZoomIn className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground w-12 text-right">{Math.round(crop.scale * 100)}%</span>
          </div>
          <p className="text-sm text-muted-foreground text-center">Faites glisser pour repositionner • Slider pour zoomer</p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setCrop(defaultCrop)}>
            <RotateCcw className="h-4 w-4 mr-2" /> Réinitialiser
          </Button>
          <Button onClick={() => { onSave(crop); onClose(); }}>
            <Check className="h-4 w-4 mr-2" /> Valider
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
