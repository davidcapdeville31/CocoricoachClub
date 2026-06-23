import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface InfoHintProps {
  title: string;
  /** Court — ce que ça mesure, en langage coach */
  what: string;
  /** Comment c'est calculé (1 phrase simple) */
  how?: string;
  /** Pourquoi c'est utile / quoi en faire */
  why?: string;
  className?: string;
}

/**
 * Petite icône "i" pédagogique cliquable (mobile-friendly).
 * Explication claire et non-technique pour les coachs.
 */
export function InfoHint({ title, what, how, why, className }: InfoHintProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Aide : ${title}`}
          className={cn(
            "inline-flex items-center justify-center h-5 w-5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0",
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="max-w-[300px] p-3 space-y-2 text-xs leading-relaxed bg-background/95 backdrop-blur-sm"
      >
        <p className="font-semibold text-sm text-foreground">{title}</p>
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">À quoi ça sert :</span> {what}
        </p>
        {how && (
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Comment c'est calculé :</span> {how}
          </p>
        )}
        {why && (
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Comment l'utiliser :</span> {why}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
