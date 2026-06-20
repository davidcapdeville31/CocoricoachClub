import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { DeleteSeverity } from "@/components/ui/confirm-delete-button";

interface OpenArgs {
  entityName?: string;
  entityKind?: string;
  title?: string;
  description?: string;
  severity?: DeleteSeverity;
  confirmLabel?: string;
  successToast?: string | null;
  errorToast?: string | null;
  onConfirm: () => void | Promise<unknown>;
}

interface DialogState extends OpenArgs {
  open: boolean;
}

/**
 * Programmatic version of <ConfirmDeleteButton /> for cases where the trigger
 * isn't a standalone button (context menu, swipe, table row action, etc.).
 *
 * Usage:
 *   const del = useDeleteWithConfirm();
 *   ...
 *   del.requestDelete({
 *     entityName: category.name,
 *     entityKind: "la catégorie",
 *     severity: "high",
 *     onConfirm: () => mutation.mutateAsync(category.id),
 *     successToast: "Catégorie supprimée",
 *   });
 *   ...
 *   {del.dialog}
 */
export function useDeleteWithConfirm() {
  const [state, setState] = useState<DialogState | null>(null);
  const [loading, setLoading] = useState(false);

  const requestDelete = useCallback((args: OpenArgs) => {
    setState({ ...args, open: true });
  }, []);

  const close = useCallback(() => {
    if (loading) return;
    setState((s) => (s ? { ...s, open: false } : s));
  }, [loading]);

  const confirm = useCallback(async () => {
    if (!state) return;
    try {
      setLoading(true);
      await state.onConfirm();
      if (state.successToast !== null && state.successToast !== undefined) {
        toast.success(state.successToast);
      }
      setState(null);
    } catch (err: any) {
      const msg =
        state.errorToast === null
          ? null
          : state.errorToast ?? "Erreur lors de la suppression";
      if (msg) toast.error(msg, { description: err?.message });
    } finally {
      setLoading(false);
    }
  }, [state]);

  return {
    requestDelete,
    isOpen: !!state?.open,
    loading,
    state,
    close,
    confirm,
  };
}
