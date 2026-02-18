import { useState } from "react";
import { ConversationList } from "./ConversationList";
import { ChatWindow } from "./ChatWindow";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle } from "lucide-react";

interface MessagingTabProps {
  categoryId: string;
  isAthlete?: boolean;
}

export function MessagingTab({ categoryId, isAthlete = false }: MessagingTabProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <ConversationList
          categoryId={categoryId}
          selectedId={selectedConversationId || undefined}
          onSelect={setSelectedConversationId}
          isAthlete={isAthlete}
        />
      </div>
      <div className="lg:col-span-2">
        {selectedConversationId ? (
          <ChatWindow 
            conversationId={selectedConversationId} 
            categoryId={categoryId}
          />
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
