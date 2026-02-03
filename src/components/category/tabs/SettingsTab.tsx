import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Video, ExternalLink, Settings, BookOpen } from "lucide-react";
import { CategoryCollaborationTab } from "@/components/category/CategoryCollaborationTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SettingsTabProps {
  categoryId: string;
}

const VIDEO_TUTORIALS = [
  {
    title: "Créer et gérer une catégorie",
    description: "Apprenez à configurer votre équipe",
    url: "https://www.youtube.com/watch?v=example1",
  },
  {
    title: "Planifier des séances d'entraînement",
    description: "Utiliser le calendrier et créer des séances",
    url: "https://www.youtube.com/watch?v=example2",
  },
  {
    title: "Suivre les performances des athlètes",
    description: "Tests, AWCR et analyses",
    url: "https://www.youtube.com/watch?v=example3",
  },
  {
    title: "Gestion de la collaboration",
    description: "Inviter et gérer les membres de l'équipe",
    url: "https://www.youtube.com/watch?v=example4",
  },
];

export function SettingsTab({ categoryId }: SettingsTabProps) {
  return (
    <Tabs defaultValue="collaboration" className="space-y-4">
      <div className="overflow-x-auto -mx-4 px-4 pb-2">
        <TabsList className="inline-flex w-max min-w-full gap-1 h-auto bg-muted p-1">
          <TabsTrigger value="collaboration" className="flex items-center gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1.5 whitespace-nowrap">
            <Users className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Collaboration</span>
            <span className="sm:hidden">Collab</span>
          </TabsTrigger>
          <TabsTrigger value="tutorials" className="flex items-center gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1.5 whitespace-nowrap">
            <Video className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Tutoriels Vidéo</span>
            <span className="sm:hidden">Vidéos</span>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="collaboration">
        <CategoryCollaborationTab categoryId={categoryId} />
      </TabsContent>

      <TabsContent value="tutorials">
        <Card className="bg-gradient-card shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Tutoriels Vidéo
            </CardTitle>
            <CardDescription>
              Apprenez à utiliser toutes les fonctionnalités de l'application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {VIDEO_TUTORIALS.map((video, index) => (
                <Card key={index} className="border bg-card hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <Video className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm">{video.title}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {video.description}
                        </p>
                        <Button
                          variant="link"
                          className="h-auto p-0 mt-2 text-xs"
                          onClick={() => window.open(video.url, "_blank")}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Voir le tutoriel
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-dashed">
              <p className="text-sm text-muted-foreground text-center">
                D'autres tutoriels seront bientôt disponibles. Restez à l'écoute !
              </p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
