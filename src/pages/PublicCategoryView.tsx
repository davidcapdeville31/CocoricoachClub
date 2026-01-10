import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, Users, Calendar, Activity, Trophy, 
  Eye, AlertCircle, Loader2 
} from "lucide-react";
import { usePublicAccess } from "@/contexts/PublicAccessContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Player {
  id: string;
  name: string;
  position: string | null;
  date_of_birth: string | null;
  avatar_url: string | null;
}

interface Match {
  id: string;
  opponent: string;
  match_date: string;
  is_home: boolean;
  score_home: number | null;
  score_away: number | null;
  location: string | null;
}

interface OverviewData {
  totalPlayers: number;
  totalSessions: number;
  activeInjuries: number;
  categoryName: string;
  clubName: string;
}

export default function PublicCategoryView() {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const { isPublicAccess, token, categoryName, clubName, categoryId: contextCategoryId } = usePublicAccess();
  
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "players" | "matches">("overview");
  const [error, setError] = useState<string | null>(null);

  // Verify access
  useEffect(() => {
    if (!isPublicAccess || !token) {
      navigate("/auth");
      return;
    }
    
    // Verify this is the right category
    if (categoryId !== contextCategoryId) {
      setError("Vous n'avez pas accès à cette catégorie");
      setLoading(false);
      return;
    }

    fetchData();
  }, [isPublicAccess, token, categoryId, contextCategoryId]);

  const fetchData = async () => {
    if (!token) return;
    
    try {
      const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-data`;
      const headers = {
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      };

      // Fetch all data in parallel
      const [overviewRes, playersRes, matchesRes] = await Promise.all([
        fetch(`${baseUrl}?token=${token}&type=overview`, { headers }),
        fetch(`${baseUrl}?token=${token}&type=players`, { headers }),
        fetch(`${baseUrl}?token=${token}&type=matches`, { headers }),
      ]);

      const [overviewData, playersData, matchesData] = await Promise.all([
        overviewRes.json(),
        playersRes.json(),
        matchesRes.json(),
      ]);

      if (overviewData.success) setOverview(overviewData.data);
      if (playersData.success) setPlayers(playersData.data || []);
      if (matchesData.success) setMatches(matchesData.data || []);
      
      setLoading(false);
    } catch (e) {
      console.error("Error fetching public data:", e);
      setError("Erreur lors du chargement des données");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <p className="font-medium">{error}</p>
            <Button variant="outline" onClick={() => navigate("/public-view?token=" + token)}>
              Retour
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-hero py-8 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              className="text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => navigate("/public-view?token=" + token)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <Badge variant="secondary" className="bg-amber-100 text-amber-800">
              <Eye className="h-3 w-3 mr-1" />
              Mode Consultation
            </Badge>
          </div>
          <h1 className="text-2xl font-bold text-primary-foreground">
            {categoryName || overview?.categoryName}
          </h1>
          <p className="text-primary-foreground/80">
            {clubName || overview?.clubName}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto max-w-6xl px-4 py-6">
        {/* Stats Cards */}
        {overview && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("players")}>
              <CardContent className="pt-4 text-center">
                <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{overview.totalPlayers}</p>
                <p className="text-sm text-muted-foreground">Joueurs</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <Calendar className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{overview.totalSessions}</p>
                <p className="text-sm text-muted-foreground">Séances</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <Activity className="h-6 w-6 mx-auto mb-2 text-amber-500" />
                <p className="text-2xl font-bold">{overview.activeInjuries}</p>
                <p className="text-sm text-muted-foreground">Blessures</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-4 border-b">
          <Button
            variant={activeTab === "overview" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("overview")}
          >
            Vue générale
          </Button>
          <Button
            variant={activeTab === "players" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("players")}
          >
            Joueurs ({players.length})
          </Button>
          <Button
            variant={activeTab === "matches" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("matches")}
          >
            Matchs ({matches.length})
          </Button>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <Card>
            <CardHeader>
              <CardTitle>Résumé de l'équipe</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Cette équipe compte {overview?.totalPlayers || 0} joueurs et a réalisé{" "}
                {overview?.totalSessions || 0} séances d'entraînement.
              </p>
              {overview && overview.activeInjuries > 0 && (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-amber-800 dark:text-amber-200 text-sm">
                    ⚠️ {overview.activeInjuries} blessure(s) active(s) dans l'équipe
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "players" && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {players.map((player) => (
              <Card key={player.id}>
                <CardContent className="pt-4 flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={player.avatar_url || undefined} />
                    <AvatarFallback>
                      {player.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{player.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {player.position || "Position non définie"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
            {players.length === 0 && (
              <p className="text-muted-foreground col-span-full text-center py-8">
                Aucun joueur dans cette catégorie
              </p>
            )}
          </div>
        )}

        {activeTab === "matches" && (
          <div className="space-y-3">
            {matches.map((match) => (
              <Card key={match.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Trophy className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">
                          {match.is_home ? "vs " : "@ "}{match.opponent}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(match.match_date), "d MMM yyyy", { locale: fr })}
                          {match.location && ` • ${match.location}`}
                        </p>
                      </div>
                    </div>
                    {(match.score_home !== null || match.score_away !== null) && (
                      <Badge variant="outline" className="font-mono">
                        {match.score_home ?? "-"} - {match.score_away ?? "-"}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {matches.length === 0 && (
              <p className="text-muted-foreground text-center py-8">
                Aucun match enregistré
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
