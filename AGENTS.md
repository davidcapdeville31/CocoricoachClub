# Architecture decisions

- Push permission reads the native three-state permission first; OneSignal's boolean false is never treated as denied because it also means not requested.

- Athlete staff badges use unread `session_feedback` (RPE) and `wellness_submitted` (wellness) notifications as their source of truth, so read state stays user-specific without duplicating submission data.
- The load calendar combines category training sessions and non-personal competitions over their date ranges; competition references affect only calendar summaries, never stored athlete loads.
- The competition RPE target is a per-category setting (categories.competition_planned_rpe, default 8) read via useCompetitionPlannedRpe, so each staff adapts competition load to their discipline.
- Athlete self-entry of competition data (results, competition RPE) is gated by the per-category flag categories.athlete_competition_entry_enabled (read via useAthleteCompetitionEntry), so each staff controls it in one click.
- Athlete navigation and wellness summaries use semantic CSS tokens with valid HSL alpha syntax; never append hexadecimal alpha to an HSL string, because mobile browsers can render identical foreground and background colors.
