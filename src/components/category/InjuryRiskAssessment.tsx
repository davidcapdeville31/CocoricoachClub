import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle, AlertCircle, TrendingUp } from "lucide-react";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";

interface InjuryRiskAssessmentProps {
  categoryId: string;
}

interface PlayerRisk {
  playerId: string;
  playerName: string;
  awcr: number | null;
  awcrRisk: "low" | "medium" | "high";
  wellnessScore: number | null;
  wellnessRisk: "low" | "medium" | "high";
  hasSpecificPain: boolean;
  painLocation: string | null;
  combinedRisk: "low" | "medium" | "high" | "critical";
  riskFactors: string[];
}

export function InjuryRiskAssessment({ categoryId }: InjuryRiskAssessmentProps) {
  const today = new Date();
  const weekAgo = subDays(today, 7);

  // Fetch players
  const { data: players } = useQuery({
    queryKey: ["players", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch latest AWCR data for each player
  const { data: awcrData } = useQuery({
    queryKey: ["awcr_latest", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("awcr_tracking")
        .select("player_id, awcr, session_date")
        .eq("category_id", categoryId)
        .gte("session_date", weekAgo.toISOString().split("T")[0])
        .order("session_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch latest wellness data for each player
  const { data: wellnessData } = useQuery({
    queryKey: ["wellness_latest", categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wellness_tracking")
        .select("*")
        .eq("category_id", categoryId)
        .gte("tracking_date", subDays(today, 3).toISOString().split("T")[0])
        .order("tracking_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const calculatePlayerRisks = (): PlayerRisk[] => {
    if (!players) return [];

    return players.map((player) => {
      // Get latest AWCR for player
      const playerAwcr = awcrData?.find((a) => a.player_id === player.id);
      const awcrValue = playerAwcr?.awcr ?? null;

      // Determine AWCR risk
      let awcrRisk: "low" | "medium" | "high" = "low";
      if (awcrValue !== null) {
        if (awcrValue < 0.8 || awcrValue > 1.5) awcrRisk = "high";
        else if (awcrValue < 0.9 || awcrValue > 1.3) awcrRisk = "medium";
      }

      // Get latest wellness for player
      const playerWellness = wellnessData?.find((w) => w.player_id === player.id);
      let wellnessScore: number | null = null;
      let wellnessRisk: "low" | "medium" | "high" = "low";
      let hasSpecificPain = false;
      let painLocation: string | null = null;

      if (playerWellness) {
        wellnessScore = (
          playerWellness.sleep_quality +
          playerWellness.sleep_duration +
          playerWellness.general_fatigue +
          playerWellness.stress_level +
          playerWellness.soreness_upper_body +
          playerWellness.soreness_lower_body
        ) / 6;

        if (wellnessScore >= 4) wellnessRisk = "high";
        else if (wellnessScore >= 3) wellnessRisk = "medium";

        hasSpecificPain = playerWellness.has_specific_pain;
        painLocation = playerWellness.pain_location;
      }

      // Calculate combined risk
      const riskFactors: string[] = [];
      let combinedRisk: "low" | "medium" | "high" | "critical" = "low";

      if (awcrRisk === "high") riskFactors.push("AWCR hors zone optimale");
      if (awcrRisk === "medium") riskFactors.push("AWCR à surveiller");
      if (wellnessRisk === "high") riskFactors.push("Wellness préoccupant");
      if (wellnessRisk === "medium") riskFactors.push("Wellness à surveiller");
      if (hasSpecificPain) riskFactors.push(`Douleur: ${painLocation || "signalée"}`);

      // Combined risk logic
      if (hasSpecificPain && (awcrRisk === "high" || wellnessRisk === "high")) {
        combinedRisk = "critical";
      } else if (awcrRisk === "high" && wellnessRisk === "high") {
        combinedRisk = "critical";
      } else if (awcrRisk === "high" || wellnessRisk === "high" || hasSpecificPain) {
        combinedRisk = "high";
      } else if (awcrRisk === "medium" || wellnessRisk === "medium") {
        combinedRisk = "medium";
      }

      return {
        playerId: player.id,
        playerName: player.name,
        awcr: awcrValue,
        awcrRisk,
        wellnessScore,
        wellnessRisk,
        hasSpecificPain,
        painLocation,
        combinedRisk,
        riskFactors,
      };
    });
  };

  const playerRisks = calculatePlayerRisks();
  const criticalPlayers = playerRisks.filter((p) => p.combinedRisk === "critical");
  const highRiskPlayers = playerRisks.filter((p) => p.combinedRisk === "high");
  const mediumRiskPlayers = playerRisks.filter((p) => p.combinedRisk === "medium");

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case "critical":
        return <Badge variant="destructive" className="bg-red-600">Critique</Badge>;
      case "high":
        return <Badge variant="destructive">Élevé</Badge>;
      case "medium":
        return <Badge variant="secondary" className="bg-yellow-500 text-white">Modéré</Badge>;
      default:
        return <Badge variant="default" className="bg-green-500">Faible</Badge>;
    }
  };

  const getRiskIcon = (risk: string) => {
    switch (risk) {
      case "critical":
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case "high":
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case "medium":
        return <TrendingUp className="h-5 w-5 text-yellow-500" />;
      default:
        return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Évaluation du Risque de Blessure
        </CardTitle>
        <CardDescription>
          Analyse combinée AWCR + Wellness pour prévenir les blessures
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-red-100 dark:bg-red-900/20 rounded-lg text-center">
            <div className="text-2xl font-bold text-red-600">{criticalPlayers.length}</div>
            <div className="text-sm text-muted-foreground">Risque Critique</div>
          </div>
          <div className="p-4 bg-orange-100 dark:bg-orange-900/20 rounded-lg text-center">
            <div className="text-2xl font-bold text-orange-600">{highRiskPlayers.length}</div>
            <div className="text-sm text-muted-foreground">Risque Élevé</div>
          </div>
          <div className="p-4 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg text-center">
            <div className="text-2xl font-bold text-yellow-600">{mediumRiskPlayers.length}</div>
            <div className="text-sm text-muted-foreground">Risque Modéré</div>
          </div>
          <div className="p-4 bg-green-100 dark:bg-green-900/20 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-600">
              {playerRisks.length - criticalPlayers.length - highRiskPlayers.length - mediumRiskPlayers.length}
            </div>
            <div className="text-sm text-muted-foreground">Risque Faible</div>
          </div>
        </div>

        {/* Critical & High Risk Players */}
        {(criticalPlayers.length > 0 || highRiskPlayers.length > 0) && (
          <div className="space-y-4">
            <h4 className="font-semibold text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Joueurs à Attention Immédiate
            </h4>
            <div className="space-y-3">
              {[...criticalPlayers, ...highRiskPlayers].map((player) => (
                <div
                  key={player.playerId}
                  className="p-4 border rounded-lg bg-destructive/5 border-destructive/20"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {getRiskIcon(player.combinedRisk)}
                      <span className="font-medium">{player.playerName}</span>
                    </div>
                    {getRiskBadge(player.combinedRisk)}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <span className="text-muted-foreground">AWCR: </span>
                      <span className={player.awcrRisk === "high" ? "text-destructive font-medium" : ""}>
                        {player.awcr?.toFixed(2) ?? "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Wellness: </span>
                      <span className={player.wellnessRisk === "high" ? "text-destructive font-medium" : ""}>
                        {player.wellnessScore?.toFixed(1) ?? "N/A"}/5
                      </span>
                    </div>
                  </div>

                  {player.riskFactors.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {player.riskFactors.map((factor, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {factor}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Players List */}
        <div className="space-y-4">
          <h4 className="font-semibold">Tous les Joueurs</h4>
          <div className="space-y-2">
            {playerRisks.map((player) => (
              <div
                key={player.playerId}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  {getRiskIcon(player.combinedRisk)}
                  <span>{player.playerName}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    AWCR: {player.awcr?.toFixed(2) ?? "-"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    W: {player.wellnessScore?.toFixed(1) ?? "-"}
                  </div>
                  {getRiskBadge(player.combinedRisk)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="p-4 bg-muted rounded-lg text-sm">
          <h5 className="font-medium mb-2">Comment est calculé le risque ?</h5>
          <ul className="space-y-1 text-muted-foreground">
            <li>• <strong>AWCR optimal:</strong> 0.8 - 1.3 (zone de sécurité)</li>
            <li>• <strong>Wellness optimal:</strong> score moyen &lt; 3 (bon état)</li>
            <li>• <strong>Risque critique:</strong> Douleur signalée + AWCR ou Wellness élevé</li>
            <li>• <strong>Risque élevé:</strong> AWCR &gt;1.5 ou &lt;0.8, ou Wellness &gt;4</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
