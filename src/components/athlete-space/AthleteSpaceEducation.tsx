import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Moon, Apple, Activity, Shield } from "lucide-react";

interface Props {
  sportType?: string;
}

export function AthleteSpaceEducation({ sportType }: Props) {
  const { t } = useTranslation();

  const RECOVERY_TIPS = [
    { title: t("athleteSpace:components.education.recoveryTips.sleep.title"), content: t("athleteSpace:components.education.recoveryTips.sleep.content") },
    { title: t("athleteSpace:components.education.recoveryTips.hydration.title"), content: t("athleteSpace:components.education.recoveryTips.hydration.content") },
    { title: t("athleteSpace:components.education.recoveryTips.coldBaths.title"), content: t("athleteSpace:components.education.recoveryTips.coldBaths.content") },
    { title: t("athleteSpace:components.education.recoveryTips.stretching.title"), content: t("athleteSpace:components.education.recoveryTips.stretching.content") },
  ];

  const NUTRITION_TIPS = [
    { title: t("athleteSpace:components.education.nutritionTips.before.title"), content: t("athleteSpace:components.education.nutritionTips.before.content") },
    { title: t("athleteSpace:components.education.nutritionTips.after.title"), content: t("athleteSpace:components.education.nutritionTips.after.content") },
    { title: t("athleteSpace:components.education.nutritionTips.matchDay.title"), content: t("athleteSpace:components.education.nutritionTips.matchDay.content") },
    { title: t("athleteSpace:components.education.nutritionTips.restDay.title"), content: t("athleteSpace:components.education.nutritionTips.restDay.content") },
  ];

  const MOBILITY_EXERCISES = [
    { title: t("athleteSpace:components.education.mobilityTips.hips.title"), content: t("athleteSpace:components.education.mobilityTips.hips.content") },
    { title: t("athleteSpace:components.education.mobilityTips.shoulders.title"), content: t("athleteSpace:components.education.mobilityTips.shoulders.content") },
    { title: t("athleteSpace:components.education.mobilityTips.ankles.title"), content: t("athleteSpace:components.education.mobilityTips.ankles.content") },
    { title: t("athleteSpace:components.education.mobilityTips.spine.title"), content: t("athleteSpace:components.education.mobilityTips.spine.content") },
  ];

  const getSportTips = (sport?: string): { title: string; content: string }[] => {
    const s = sport?.toLowerCase() || "";

    if (s.includes("rugby") || s === "xv" || s === "7" || s === "xiii") {
      return [
        { title: t("athleteSpace:components.education.rugbyTips.tackle.title"), content: t("athleteSpace:components.education.rugbyTips.tackle.content") },
        { title: t("athleteSpace:components.education.rugbyTips.scrum.title"), content: t("athleteSpace:components.education.rugbyTips.scrum.content") },
        { title: t("athleteSpace:components.education.rugbyTips.support.title"), content: t("athleteSpace:components.education.rugbyTips.support.content") },
      ];
    }
    if (s.includes("foot") || s.includes("soccer")) {
      return [
        { title: t("athleteSpace:components.education.footballTips.acl.title"), content: t("athleteSpace:components.education.footballTips.acl.content") },
        { title: t("athleteSpace:components.education.footballTips.intermittent.title"), content: t("athleteSpace:components.education.footballTips.intermittent.content") },
      ];
    }
    if (s.includes("athlé") || s.includes("athletics")) {
      return [
        { title: t("athleteSpace:components.education.athleticsTips.warmup.title"), content: t("athleteSpace:components.education.athleticsTips.warmup.content") },
        { title: t("athleteSpace:components.education.athleticsTips.recovery.title"), content: t("athleteSpace:components.education.athleticsTips.recovery.content") },
      ];
    }

    return [
      { title: t("athleteSpace:components.education.defaultTips.warmup.title"), content: t("athleteSpace:components.education.defaultTips.warmup.content") },
      { title: t("athleteSpace:components.education.defaultTips.coolDown.title"), content: t("athleteSpace:components.education.defaultTips.coolDown.content") },
    ];
  };

  const sportTips = getSportTips(sportType);

  const sections = [
    { title: t("athleteSpace:components.education.recovery"), icon: Moon, tips: RECOVERY_TIPS, color: "text-accent" },
    { title: t("athleteSpace:components.education.nutrition"), icon: Apple, tips: NUTRITION_TIPS, color: "text-status-optimal" },
    { title: t("athleteSpace:components.education.mobility"), icon: Activity, tips: MOBILITY_EXERCISES, color: "text-warning" },
    { title: t("athleteSpace:components.education.sportTips"), icon: Shield, tips: sportTips, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card shadow-md">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="h-5 w-5 text-accent" />
            <p className="font-semibold">{t("athleteSpace:components.education.title")}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("athleteSpace:components.education.subtitle")}
          </p>
        </CardContent>
      </Card>

      {sections.map(section => (
        <Card key={section.title} className="bg-gradient-card shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <section.icon className={`h-4 w-4 ${section.color}`} />
              {section.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {section.tips.map((tip, i) => (
                <div key={i}>
                  <p className="text-sm font-semibold mb-0.5">{tip.title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{tip.content}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
