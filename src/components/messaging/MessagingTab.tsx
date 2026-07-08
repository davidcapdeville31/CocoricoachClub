import { useState } from "react";
import { ConversationList } from "./ConversationList";
import { ChatWindow } from "./ChatWindow";
import { MembersPanel } from "./MembersPanel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MessageCircle, ChevronLeft, Users2, MessageSquare } from "lucide-react";

interface MessagingTabProps {
  categoryId: string;
  isAthlete?: boolean;
}

export function MessagingTab({ categoryId, isAthlete = false }: MessagingTabProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [tab, setTab] = useState<"conversations" | "members">("conversations");

  const handleOpenConversation = (id: string) => {
    setSelectedConversationId(id);
    setTab("conversations");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className={`lg:col-span-1 ${selectedConversationId ? "hidden lg:block" : "block"}`}>
        <Card className="h-[600px] flex flex-col">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "conversations" | "members")} className="flex-1 flex flex-col">
            <TabsList className="grid grid-cols-2 mx-3 mt-3">
              <TabsTrigger value="conversations" className="gap-2">
                <MessageSquare className="h-3.5 w-3.5" />
                Conversations
              </TabsTrigger>
              <TabsTrigger value="members" className="gap-2">
                <Users2 className="h-3.5 w-3.5" />
                Membres
              </TabsTrigger>
            </TabsList>
            <TabsContent value="conversations" className="flex-1 mt-0 overflow-hidden">
              <ConversationList
                categoryId={categoryId}
                selectedId={selectedConversationId || undefined}
                onSelect={setSelectedConversationId}
                isAthlete={isAthlete}
              />
            </TabsContent>
            <TabsContent value="members" className="flex-1 mt-0 overflow-hidden">
              <MembersPanel categoryId={categoryId} onOpenConversation={handleOpenConversation} />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
      <div className={`lg:col-span-2 ${selectedConversationId ? "block" : "hidden lg:block"}`}>
        {selectedConversationId ? (
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden -ml-2"
              onClick={() => setSelectedConversationId(null)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Retour
            </Button>
            <ChatWindow
              conversationId={selectedConversationId}
              categoryId={categoryId}
            />
          </div>
        ) : (
          <Card className="h-[600px] flex items-center justify-center">
            <CardContent className="text-center">
              <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Sélectionnez une conversation, un membre à contacter, ou créez un groupe
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
