import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./UserAvatar";
import { usePresence } from "@/hooks/usePresence";
import { useCategoryMembers } from "@/hooks/useCategoryMembers";

interface MembersPanelProps {
  categoryId: string;
  onOpenConversation: (conversationId: string) => void;
}

export function MembersPanel({ categoryId, onOpenConversation }: MembersPanelProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const online = usePresence(categoryId);
  const { data: members, isLoading } = useCategoryMembers(categoryId);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const list = (members || []).filter((m) => m.userId !== user?.id);
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((m) => m.name.toLowerCase().includes(q));
  }, [members, search, user?.id]);

  const openDm = useMutation({
    mutationFn: async (otherUserId: string) => {
      const { data, error } = await supabase.rpc("get_or_create_direct_conversation", {
        _category_id: categoryId,
        _other_user_id: otherUserId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (convId) => {
      queryClient.invalidateQueries({ queryKey: ["conversations", categoryId] });
      onOpenConversation(convId);
    },
    onError: (e: any) => toast.error(e?.message || "Impossible d'ouvrir la conversation"),
  });

  const onlineCount = filtered.filter((m) => online.has(m.userId)).length;

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Membres</p>
          <Badge variant="secondary" className="text-xs">
            <span className="mr-1 h-2 w-2 rounded-full bg-emerald-500 inline-block" />
            {onlineCount} en ligne
          </Badge>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un membre..."
            className="pl-7 h-8 text-sm"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center">Aucun membre</div>
        ) : (
          <div className="p-2 space-y-1">
            {filtered.map((m) => {
              const isOnline = online.has(m.userId);
              return (
                <button
                  key={m.userId}
                  onClick={() => openDm.mutate(m.userId)}
                  disabled={openDm.isPending}
                  className={cn(
                    "w-full flex items-center gap-3 p-2 rounded-lg text-left hover:bg-muted transition-colors",
                    openDm.isPending && "opacity-60"
                  )}
                >
                  <UserAvatar
                    name={m.name}
                    photoUrl={m.photoUrl}
                    online={isOnline}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className="overflow-x-auto"
                      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                    >
                      <p className="text-sm font-medium whitespace-nowrap">{m.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {isOnline ? "En ligne" : m.kind === "player" ? "Athlète" : "Staff"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
