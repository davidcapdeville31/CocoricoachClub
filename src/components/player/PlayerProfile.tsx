import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Zap, Users, Target, Dumbbell, Timer, Gauge } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PlayerAvatarUpload } from "./PlayerAvatarUpload";
import { getAthleticProfileConfig, type AthleticProfileConfig } from "@/lib/constants/athleticProfiles";

interface PlayerProfileProps {
  playerId: string;
  categoryId: string;
  playerName: string;
  avatarUrl?: string | null;
  sportType?: string;
}

type ProfileType = "primary" | "balanced" | "secondary" | "insufficientData";

interface TestResult {
  value: number;
  date: string;
}

export function PlayerProfile({ playerId, categoryId, playerName, avatarUrl, sportType = "XV" }: PlayerProfileProps) {
  const profileConfig = getAthleticProfileConfig(sportType);

  // Fetch test data based on sport profile configuration
  const { data: testData } = useQuery({
    queryKey: ["player_athletic_profile", playerId, sportType],
    queryFn: async () => {
      const results: Record<string, TestResult | null> = {};
      
      for (const test of profileConfig.tests) {
        let data: { value: number; date: string } | null = null;
        
        if (test.tableSource === "speed_tests") {
          const { data: speedData } = await supabase
            .from("speed_tests")
            .select("*")
            .eq("player_id", playerId)
            .eq("test_type", test.testType)
            .order("test_date", { ascending: false })
            .limit(1);
          
          if (speedData && speedData.length > 0) {
            const testResult = speedData[0];
            // Handle different value columns
            const value = testResult.vma_kmh || testResult.speed_kmh || testResult.time_40m_seconds || 0;
            data = { value, date: testResult.test_date };
          }
        } else if (test.tableSource === "jump_tests") {
          const { data: jumpData } = await supabase
            .from("jump_tests")
            .select("*")
            .eq("player_id", playerId)
            .eq("test_type", test.testType)
            .order("test_date", { ascending: false })
            .limit(1);
          
          if (jumpData && jumpData.length > 0) {
            data = { value: jumpData[0].result_cm, date: jumpData[0].test_date };
          }
        } else if (test.tableSource === "generic_tests") {
          const { data: genericData } = await supabase
            .from("generic_tests")
            .select("*")
            .eq("player_id", playerId)
            .eq("test_type", test.testType)
            .order("test_date", { ascending: false })
            .limit(1);
          
          if (genericData && genericData.length > 0) {
            data = { value: genericData[0].result_value, date: genericData[0].test_date };
          }
        }
        
        results[test.key] = data;
      }
      
      return results;
    },
  });

  // Calculate profile based on test results
  const getPlayerProfile = (): {
    type: ProfileType;
    test1: TestResult | null;
    test2: TestResult | null;
    ratio: number | null;
  } => {
    const test1 = testData?.[profileConfig.tests[0].key] || null;
    const test2 = testData?.[profileConfig.tests[1].key] || null;

    if (!test1 || !test2) {
      return { type: "insufficientData", test1, test2, ratio: null };
    }

    // Normalize both test values to a 0-100 scale for comparison
    // The ratio determines which profile type to assign
    const val1 = test1.value;
    const val2 = test2.value;
    
    // For sports where both tests are "higher is better" or same direction
    // we can compare relative performance
    const t1Config = profileConfig.tests[0];
    const t2Config = profileConfig.tests[1];
    
    // Create a simple ratio based on relative performance
    // This is a simplified version - in reality you'd use sport-specific norms
    let ratio: number;
    
    // If both tests point the same direction
    if (t1Config.higherIsBetter === t2Config.higherIsBetter) {
      ratio = (val1 / (val1 + val2)) * 100;
    } else {
      // If they point different directions, invert one
      ratio = t1Config.higherIsBetter 
        ? (val1 / (val1 + (1/val2))) * 100
        : ((1/val1) / ((1/val1) + val2)) * 100;
    }

    // Classify based on ratio
    let type: ProfileType;
    if (ratio > 55) {
      type = "primary";
    } else if (ratio >= 45) {
      type = "balanced";
    } else {
      type = "secondary";
    }

    return { type, test1, test2, ratio };
  };

  const profile = getPlayerProfile();
  const currentProfileType = profileConfig.profileTypes[profile.type];

  const getProfileIcon = () => {
    switch (profile.type) {
      case "primary":
        return Timer;
      case "balanced":
        return Users;
      case "secondary":
        return Zap;
      default:
        return Activity;
    }
  };

  const getProfileColor = () => {
    switch (profile.type) {
      case "primary":
        return "bg-primary text-primary-foreground";
      case "balanced":
        return "bg-accent text-accent-foreground";
      case "secondary":
        return "bg-secondary text-secondary-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const Icon = getProfileIcon();

  return (
    <Card className="bg-gradient-card shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Profil Athlétique - {profileConfig.label}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {profileConfig.profileDescription}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <PlayerAvatarUpload
          playerId={playerId}
          playerName={playerName}
          currentAvatarUrl={avatarUrl}
        />
        
        <div className="flex items-center justify-between">
          <Badge className={`${getProfileColor()} text-lg py-2 px-4`}>
            <Icon className="h-4 w-4 mr-2" />
            {currentProfileType.label}
          </Badge>
          {profile.ratio && (
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Équilibre</p>
              <p className="text-2xl font-bold">{profile.ratio.toFixed(0)}%</p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-muted-foreground">{currentProfileType.description}</p>
          
          {profile.test1 && profile.test2 && (
            <div className="grid grid-cols-2 gap-4 mt-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">{profileConfig.tests[0].shortLabel}</p>
                <p className="text-xl font-bold text-primary">
                  {profile.test1.value.toFixed(1)} {profileConfig.tests[0].unit}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{profileConfig.tests[1].shortLabel}</p>
                <p className="text-xl font-bold text-primary">
                  {profile.test2.value.toFixed(1)} {profileConfig.tests[1].unit}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <h4 className="font-semibold">Recommandations d'entraînement:</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
            {currentProfileType.recommendations.map((rec, index) => (
              <li key={index}>{rec}</li>
            ))}
          </ul>
        </div>

        {profile.type === "insufficientData" && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              Pour déterminer le profil athlétique, il faut effectuer:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground mt-2">
              <li>{profileConfig.tests[0].label}</li>
              <li>{profileConfig.tests[1].label}</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
