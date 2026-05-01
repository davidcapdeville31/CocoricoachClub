 import React, { useState, useRef, useCallback, useEffect } from "react";
 import {
   Dialog,
   DialogContent,
   DialogHeader,
   DialogTitle,
   DialogFooter,
 } from "@/components/ui/dialog";
 import { Button } from "@/components/ui/button";
 import { Slider } from "@/components/ui/slider";
 import { ZoomIn, ZoomOut, RotateCcw, Check } from "lucide-react";
 import { cn } from "@/lib/utils";
 import type { ImageCropSettings } from "./blockTypes";
 import { defaultImageCropSettings } from "./blockTypes";
 
 interface ImageCropModalProps {
   isOpen: boolean;
   onClose: () => void;
   imageUrl: string;
   aspectRatio?: number; // width / height (e.g., 16/9, 1, 4/3)
   initialCrop?: ImageCropSettings;
   onSave: (crop: ImageCropSettings) => void;
 }
 
 export const ImageCropModal = ({
   isOpen,
   onClose,
   imageUrl,
   aspectRatio = 16 / 9,
   initialCrop,
   onSave,
 }: ImageCropModalProps) => {
   const [crop, setCrop] = useState<ImageCropSettings>(
     initialCrop || defaultImageCropSettings
   );
   const [isDragging, setIsDragging] = useState(false);
   const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
   const containerRef = useRef<HTMLDivElement>(null);
 
   // Reset crop when modal opens with new initial values
   useEffect(() => {
     if (isOpen) {
       setCrop(initialCrop || defaultImageCropSettings);
     }
   }, [isOpen, initialCrop]);
 
   const handleMouseDown = useCallback((e: React.MouseEvent) => {
     e.preventDefault();
     setIsDragging(true);
     setDragStart({ x: e.clientX, y: e.clientY });
   }, []);
 
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const deltaX = ((e.clientX - dragStart.x) / containerRect.width) * 100;
      const deltaY = ((e.clientY - dragStart.y) / containerRect.height) * 100;

      // Allow movement even at scale=1 (up to 50% offset for repositioning within frame)
      // At higher zoom levels, allow more movement proportional to the zoom
      const baseOffset = 50; // Base offset allowed even at scale=1
      const zoomOffset = crop.scale > 1 ? ((crop.scale - 1) / crop.scale) * 50 : 0;
      const maxOffset = baseOffset + zoomOffset;

      setCrop((prev) => ({
        ...prev,
        positionX: Math.max(-maxOffset, Math.min(maxOffset, prev.positionX + deltaX)),
        positionY: Math.max(-maxOffset, Math.min(maxOffset, prev.positionY + deltaY)),
      }));

      setDragStart({ x: e.clientX, y: e.clientY });
    },
    [isDragging, dragStart, crop.scale]
  );
 
   const handleMouseUp = useCallback(() => {
     setIsDragging(false);
   }, []);
 
   // Touch support
   const handleTouchStart = useCallback((e: React.TouchEvent) => {
     const touch = e.touches[0];
     setIsDragging(true);
     setDragStart({ x: touch.clientX, y: touch.clientY });
   }, []);
 
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging || !containerRef.current) return;

      const touch = e.touches[0];
      const containerRect = containerRef.current.getBoundingClientRect();
      const deltaX = ((touch.clientX - dragStart.x) / containerRect.width) * 100;
      const deltaY = ((touch.clientY - dragStart.y) / containerRect.height) * 100;

      // Allow movement even at scale=1 (up to 50% offset for repositioning within frame)
      const baseOffset = 50;
      const zoomOffset = crop.scale > 1 ? ((crop.scale - 1) / crop.scale) * 50 : 0;
      const maxOffset = baseOffset + zoomOffset;

      setCrop((prev) => ({
        ...prev,
        positionX: Math.max(-maxOffset, Math.min(maxOffset, prev.positionX + deltaX)),
        positionY: Math.max(-maxOffset, Math.min(maxOffset, prev.positionY + deltaY)),
      }));

      setDragStart({ x: touch.clientX, y: touch.clientY });
    },
    [isDragging, dragStart, crop.scale]
  );
 
   const handleTouchEnd = useCallback(() => {
     setIsDragging(false);
   }, []);
 
  const handleScaleChange = (value: number[]) => {
    const newScale = value[0];
    // Allow base offset even at scale=1
    const baseOffset = 50;
    const zoomOffset = newScale > 1 ? ((newScale - 1) / newScale) * 50 : 0;
    const maxOffset = baseOffset + zoomOffset;

    // Clamp position when zooming out
    setCrop((prev) => ({
      ...prev,
      scale: newScale,
      positionX: Math.max(-maxOffset, Math.min(maxOffset, prev.positionX)),
      positionY: Math.max(-maxOffset, Math.min(maxOffset, prev.positionY)),
    }));
  };
 
   const handleReset = () => {
     setCrop(defaultImageCropSettings);
   };
 
   const handleSave = () => {
     onSave(crop);
     onClose();
   };
 
   // Calculate the image style based on crop settings
   const imageStyle: React.CSSProperties = {
     transform: `scale(${crop.scale}) translate(${crop.positionX / crop.scale}%, ${crop.positionY / crop.scale}%)`,
     transformOrigin: "center center",
     transition: isDragging ? "none" : "transform 0.1s ease-out",
   };
 
   return (
     <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
       <DialogContent className="max-w-2xl">
         <DialogHeader>
           <DialogTitle>Recadrer l'image</DialogTitle>
         </DialogHeader>
 
         <div className="space-y-4">
           {/* Preview container with aspect ratio */}
           <div
             ref={containerRef}
             className={cn(
               "relative overflow-hidden rounded-lg bg-muted mx-auto",
               isDragging ? "cursor-grabbing" : "cursor-grab"
             )}
             style={{
               aspectRatio: aspectRatio,
               maxHeight: "400px",
               width: "100%",
             }}
             onMouseDown={handleMouseDown}
             onMouseMove={handleMouseMove}
             onMouseUp={handleMouseUp}
             onMouseLeave={handleMouseUp}
             onTouchStart={handleTouchStart}
             onTouchMove={handleTouchMove}
             onTouchEnd={handleTouchEnd}
           >
             <img
               src={imageUrl}
               alt="Aperçu recadrage"
               className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
               style={imageStyle}
               draggable={false}
             />
 
             {/* Grid overlay for visual reference */}
             <div className="absolute inset-0 pointer-events-none">
               <div className="w-full h-full grid grid-cols-3 grid-rows-3">
                 {[...Array(9)].map((_, i) => (
                   <div
                     key={i}
                     className="border border-white/20"
                   />
                 ))}
               </div>
             </div>
           </div>
 
           {/* Zoom control */}
           <div className="flex items-center gap-4 px-4">
             <ZoomOut className="h-4 w-4 text-muted-foreground flex-shrink-0" />
             <Slider
               value={[crop.scale]}
               onValueChange={handleScaleChange}
               min={1}
               max={3}
               step={0.05}
               className="flex-1"
             />
             <ZoomIn className="h-4 w-4 text-muted-foreground flex-shrink-0" />
             <span className="text-sm text-muted-foreground w-12 text-right">
               {Math.round(crop.scale * 100)}%
             </span>
           </div>
 
           {/* Instructions */}
           <p className="text-sm text-muted-foreground text-center">
             Faites glisser l'image pour la repositionner • Utilisez le slider pour zoomer
           </p>
         </div>
 
         <DialogFooter className="gap-2 sm:gap-0">
           <Button variant="outline" onClick={handleReset}>
             <RotateCcw className="h-4 w-4 mr-2" />
             Réinitialiser
           </Button>
           <Button onClick={handleSave}>
             <Check className="h-4 w-4 mr-2" />
             Valider
           </Button>
         </DialogFooter>
       </DialogContent>
     </Dialog>
   );
 };