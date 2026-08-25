import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Shown instead of data-entry forms when the athlete declared himself absent
 * for the session. Applies to every discipline.
 */
export function AthleteAbsentLockNotice({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <div
      className={`rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 ${className}`}
    >
      <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
        <Lock className="h-4 w-4" />
        {t("athleteSpace.calendar.attendance.absentLockTitle")}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("athleteSpace.calendar.attendance.absentLockHint")}
      </p>
    </div>
  );
}
