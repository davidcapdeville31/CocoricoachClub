import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SessionTemplateCard } from "./SessionTemplateCard";
import { AddSessionTemplateDialog } from "./AddSessionTemplateDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, LayoutTemplate } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface SessionTemplatesSectionProps {
  categoryId: string;
}

export function SessionTemplatesSection({ categoryId }: SessionTemplatesSectionProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ["session-templates", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_templates")
        .select("*")
        .eq("category_id", categoryId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("session_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-templates", categoryId] });
      toast.success("Template supprimé");
    },
    onError: () => {
      toast.error("Erreur lors de la suppression");
    },
  });

  const duplicateTemplate = useMutation({
    mutationFn: async (id: string) => {
      const template = templates?.find((t) => t.id === id);
      if (!template) return;
      
      const { error } = await supabase.from("session_templates").insert({
        ...template,
        id: undefined,
        name: `${template.name} (copie)`,
        created_at: undefined,
        updated_at: undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-templates", categoryId] });
      toast.success("Template dupliqué");
    },
    onError: () => {
      toast.error("Erreur lors de la duplication");
    },
  });

  const filteredTemplates = templates?.filter((t) =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <LayoutTemplate className="h-5 w-5" />
            Templates de séances
          </CardTitle>
          <AddSessionTemplateDialog categoryId={categoryId} />
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {filteredTemplates?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucun template. Créez-en un pour commencer !
              </p>
            ) : (
              filteredTemplates?.map((template) => (
                <SessionTemplateCard
                  key={template.id}
                  template={template}
                  onDelete={(id) => deleteTemplate.mutate(id)}
                  onDuplicate={(id) => duplicateTemplate.mutate(id)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
