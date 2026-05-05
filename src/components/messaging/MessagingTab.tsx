import { useState } from "react";
import { ConversationList } from "./ConversationList";
import { ChatWindow } from "./ChatWindow";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, ChevronLeft } from "lucide-react";

interface MessagingTabProps {
  categoryId: string;
  isAthlete?: boolean;
}

export function MessagingTab({ categoryId, isAthlete = false }: MessagingTabProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Liste : visible sur desktop, ou sur mobile uniquement si aucune conv n'est ouverte */}
      <div className={`lg:col-span-1 ${selectedConversationId ? "hidden lg:block" : "block"}`}>
        <ConversationList
          categoryId={categoryId}
          selectedId={selectedConversationId || undefined}
          onSelect={setSelectedConversationId}
          isAthlete={isAthlete}
        />
      </div>
      {/* Fenêtre chat : visible sur desktop, ou sur mobile uniquement si une conv est ouverte */}
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
              Retour aux conversations
            </Button>
            <ChatWindow
              conversationId={selectedConversationId}
              categoryId={categoryId}
            />
          </div>
        ) : (
          <Card className="h-[500px] flex items-center justify-center">
            <CardContent className="text-center">
              <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Sélectionnez une conversation ou créez-en une nouvelle
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
