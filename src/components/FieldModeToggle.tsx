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
        "field-mode-toggle fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] right-3 z-40 h-9 w-9 p-0 sm:w-auto sm:px-3 gap-2 shadow-lg opacity-80 hover:opacity-100 transition-all duration-300",
        fieldMode 
          ? "bg-slate-800 border-slate-600 text-white hover:bg-slate-700" 
          : "bg-background border-border hover:bg-accent"
      )}
      title={fieldMode ? "Désactiver le Mode Terrain" : "Activer le Mode Terrain"}
    >
      {fieldMode ? (
        <>
          <Moon className="h-4 w-4 text-blue-400" />
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
