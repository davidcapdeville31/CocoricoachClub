import { ReactNode, useState, useCallback } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type DeleteSeverity = "low" | "medium" | "high";

export interface ConfirmDeleteButtonProps {
  /** Action called when user confirms. May be async. */
  onConfirm: () => void | Promise<unknown>;
  /** Severity – `high` forces typed confirmation. */
  severity?: DeleteSeverity;
  /** Name of the entity being deleted (e.g. "EDF U19"). For `high` severity it must be retyped. */
  entityName?: string;
  /** Optional entity kind label (e.g. "catégorie", "joueur"). Used to build a default title. */
  entityKind?: string;
  /** Override the dialog title. */
  title?: string;
  /** Override the dialog body / consequences description. */
  description?: ReactNode;
  /** Label shown on the confirm button inside the dialog. */
  confirmLabel?: string;
  /** Label shown on the cancel button. */
  cancelLabel?: string;
  /** Toast shown on success. Pass `null` to disable. */
  successToast?: string | null;
  /** Toast shown on error. Pass `null` to disable. */
  errorToast?: string | null;
  /** Disable the trigger. */
  disabled?: boolean;
  /** Render a custom trigger instead of the default icon button. */
  children?: ReactNode;
  /** Trigger button variant when using the default icon button. */
  triggerVariant?: ButtonProps["variant"];
  /** Trigger button size when using the default icon button. */
  triggerSize?: ButtonProps["size"];
  /** Extra class on the default trigger button. */
  triggerClassName?: string;
  /** Tooltip / aria-label on the default trigger. */
  triggerTitle?: string;
  /** Stop propagation on the trigger click (useful inside clickable cards). */
  stopPropagation?: boolean;
}

/**
 * Single source of truth for destructive actions across the app.
 *
 * - Always opens an AlertDialog before running the delete.
 * - `severity="high"` (catégories, joueurs, clubs, saisons...) requires the
 *   user to retype the entity name before the destructive button activates.
 * - Handles loading + toasts automatically.
 *
 * Memory rule: every delete UI in the app MUST go through this component
 * (or `useDeleteWithConfirm`). Do not call destructive APIs directly from
 * a click handler.
 */
export function ConfirmDeleteButton({
  onConfirm,
  severity = "medium",
  entityName,
  entityKind,
  title,
  description,
  confirmLabel = "Supprimer",
  cancelLabel = "Annuler",
  successToast,
  errorToast = "Erreur lors de la suppression",
  disabled,
  children,
  triggerVariant = "ghost",
  triggerSize = "icon",
  triggerClassName,
  triggerTitle = "Supprimer",
  stopPropagation = true,
}: ConfirmDeleteButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [typed, setTyped] = useState("");

  const needsTyping = severity === "high" && !!entityName;
  const canConfirm =
    !loading && (!needsTyping || typed.trim() === (entityName ?? "").trim());

  const resolvedTitle =
    title ??
    (entityName
      ? `Supprimer ${entityKind ? entityKind + " " : ""}« ${entityName} » ?`
      : "Confirmer la suppression ?");

  const resolvedDescription =
    description ??
    (severity === "high"
      ? "Cette action est définitive. Toutes les données associées seront perdues et ne pourront pas être restaurées."
      : "Cette action est définitive et ne peut pas être annulée.");

  const handleConfirm = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!canConfirm) return;
      try {
        setLoading(true);
        await onConfirm();
        if (successToast) toast.success(successToast);
        setOpen(false);
        setTyped("");
      } catch (err: any) {
        if (errorToast) {
          toast.error(errorToast, {
            description: err?.message,
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [canConfirm, onConfirm, successToast, errorToast],
  );

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (loading) return;
        setOpen(o);
        if (!o) setTyped("");
      }}
    >
      <AlertDialogTrigger asChild>
        {children ? (
          <span
            onClick={(e) => {
              if (stopPropagation) e.stopPropagation();
            }}
          >
            {children}
          </span>
        ) : (
          <Button
            type="button"
            variant={triggerVariant}
            size={triggerSize}
            disabled={disabled}
            title={triggerTitle}
            aria-label={triggerTitle}
            className={cn(
              triggerVariant === "ghost" && "text-destructive hover:text-destructive",
              triggerClassName,
            )}
            onClick={(e) => {
              if (stopPropagation) e.stopPropagation();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </AlertDialogTrigger>

      <AlertDialogContent
        onClick={(e) => e.stopPropagation()}
        className="max-w-md"
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-start gap-2">
            {severity === "high" && (
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            )}
            <span>{resolvedTitle}</span>
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-relaxed">
            {resolvedDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {needsTyping && (
          <div className="space-y-2 pt-1">
            <Label htmlFor="confirm-delete-typed" className="text-xs">
              Pour confirmer, tapez{" "}
              <span className="font-semibold text-foreground">
                {entityName}
              </span>{" "}
              ci-dessous :
            </Label>
            <Input
              id="confirm-delete-typed"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoFocus
              placeholder={entityName}
              disabled={loading}
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Suppression…
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
