 import { useState } from "react";
 import { Label } from "@/components/ui/label";
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { Badge } from "@/components/ui/badge";
 import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
 import { Info } from "lucide-react";
 import { cn } from "@/lib/utils";
 import {
   WEIGHTLIFTING_STARTING_POSITIONS,
   getPositionsForExercise,
   isWeightliftingExercise,
   type StartingPosition
 } from "@/lib/weightliftingConfig";
 
 interface WeightliftingPositionSelectorProps {
   exerciseName: string;
   stationName: string;
   value?: string;
   onChange: (value: string) => void;
   compact?: boolean;
 }
 
 export const WeightliftingPositionSelector = ({
   exerciseName,
   stationName,
   value,
   onChange,
   compact = false
 }: WeightliftingPositionSelectorProps) => {
   // Check if this is a weightlifting exercise
   const isWeightlifting = isWeightliftingExercise(stationName, exerciseName);
   
   if (!isWeightlifting) {
     return null;
   }
   
   // Get applicable positions for this specific exercise
   const applicablePositions = getPositionsForExercise(exerciseName);
   
   if (applicablePositions.length === 0) {
     return null;
   }
   
   const selectedPosition = applicablePositions.find(p => p.key === value);
   
   return (
     <div className={cn("space-y-1", compact && "space-y-0.5")}>
       <div className="flex items-center gap-1.5">
         <Label className={cn(
           "text-muted-foreground",
           compact ? "text-[10px]" : "text-xs"
         )}>
           Position de départ
         </Label>
         <TooltipProvider>
           <Tooltip>
             <TooltipTrigger asChild>
               <Info className="h-3 w-3 text-muted-foreground cursor-help" />
             </TooltipTrigger>
             <TooltipContent className="max-w-xs">
               <p className="text-xs">
                 Sélectionnez la position de départ du mouvement : 
                 du sol, en suspension, des blocks ou du rack.
               </p>
             </TooltipContent>
           </Tooltip>
         </TooltipProvider>
       </div>
       
       <Select value={value || "floor"} onValueChange={onChange}>
         <SelectTrigger className={cn(
           "bg-background",
           compact ? "h-7 text-xs" : "h-8"
         )}>
           <SelectValue placeholder="Position de départ" />
         </SelectTrigger>
         <SelectContent className="bg-card border-border z-[200]">
           {applicablePositions.map((position) => (
             <SelectItem key={position.key} value={position.key}>
               <div className="flex items-center gap-2">
                 <div className={cn(
                   "w-2 h-2 rounded-full",
                   position.color
                 )} />
                 <span>{position.labelFr}</span>
                 <span className="text-muted-foreground text-[10px]">
                   ({position.labelEn})
                 </span>
               </div>
             </SelectItem>
           ))}
         </SelectContent>
       </Select>
       
       {selectedPosition && value && value !== "floor" && (
         <p className={cn(
           "text-muted-foreground italic",
           compact ? "text-[9px]" : "text-[10px]"
         )}>
           {selectedPosition.description}
         </p>
       )}
     </div>
   );
 };
 
 // Display badge for position (for read-only views)
 export const WeightliftingPositionBadge = ({
   positionKey,
   compact = false
 }: {
   positionKey?: string;
   compact?: boolean;
 }) => {
   if (!positionKey || positionKey === "floor") {
     return null;
   }
   
   const position = WEIGHTLIFTING_STARTING_POSITIONS.find(p => p.key === positionKey);
   
   if (!position) {
     return null;
   }
   
   return (
     <Badge 
       variant="outline" 
       className={cn(
         "gap-1",
         compact ? "text-[9px] px-1 py-0" : "text-[10px]"
       )}
     >
       <div className={cn("w-1.5 h-1.5 rounded-full", position.color)} />
       {position.labelFr}
     </Badge>
   );
 };
 
 export default WeightliftingPositionSelector;