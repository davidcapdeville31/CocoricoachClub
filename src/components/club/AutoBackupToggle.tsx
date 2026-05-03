import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { DatabaseBackup } from "lucide-react";

interface Props {
  clubId: string;
}

export function AutoBackupToggle({ clubId }: Props) {
  const queryClient = useQueryClient();

  const { data: club } = useQuery({
    queryKey: ["club-backup-pref", clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clubs")
        .select("auto_backup_enabled")
        .eq("id", clubId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const enabled = club?.auto_backup_enabled ?? true;

  const handleToggle = async (value: boolean) => {
    const { error } = await supabase
      .from("clubs")
      .update({ auto_backup_enabled: value })
      .eq("id", clubId);
    if (error) {
      toast.error("Impossible de mettre à jour la préférence");
      return;
    }
    toast.success(
      value
        ? "Sauvegarde automatique activée"
        : "Sauvegarde automatique désactivée"
    );
    queryClient.invalidateQueries({ queryKey: ["club-backup-pref", clubId] });
  };

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <DatabaseBackup className="h-5 w-5 text-primary" />
        </div>
        <div>
          <Label className="font-semibold">Sauvegarde automatique hebdomadaire</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Chaque dimanche à 23h59 (heure du club), un instantané complet du club est créé.
            La nouvelle sauvegarde remplace la précédente.
          </p>
        </div>
      </div>
      <Switch checked={enabled} onCheckedChange={handleToggle} />
    </div>
  );
}
