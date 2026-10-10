import { useFieldMode } from "@/contexts/FieldModeContext";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

export function FieldModeToggle() {
  const { fieldMode, toggleFieldMode } = useFieldMode();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleFieldMode}
      className={cn(
        "field-mode-toggle fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] right-3 z-40 min-h-11 min-w-11 p-0 sm:w-auto sm:px-3 gap-2 shadow-lg  transition-all duration-300",
        fieldMode 
          ? "bg-card border-border text-foreground hover:bg-muted" 
          : "bg-card border-border text-foreground hover:bg-muted"
      )}
      aria-label={fieldMode ? "Désactiver le Mode Terrain" : "Activer le Mode Terrain"}
      title={fieldMode ? "Désactiver le Mode Terrain" : "Activer le Mode Terrain"}
    >
      {fieldMode ? (
        <>
          <Moon className="h-4 w-4 text-primary" />
          <span className="hidden sm:inline">Mode Terrain</span>
        </>
      ) : (
        <>
          <Sun className="h-4 w-4 text-primary" />
          <span className="hidden sm:inline">Mode Terrain</span>
        </>
      )}
    </Button>
  );
}
