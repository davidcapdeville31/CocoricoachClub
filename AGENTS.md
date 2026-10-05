# Architecture decisions

- Athlete staff badges use unread `session_feedback` (RPE) and `wellness_submitted` (wellness) notifications as their source of truth, so read state stays user-specific without duplicating submission data.
- The load calendar combines category training sessions and non-personal competitions over their date ranges; competition references affect only calendar summaries, never stored athlete loads.
- The competition RPE target is a per-category setting (categories.competition_planned_rpe, default 8) read via useCompetitionPlannedRpe, so each staff adapts competition load to their discipline.
- Athlete self-entry of competition data (results, competition RPE) is gated by the per-category flag categories.athlete_competition_entry_enabled (read via useAthleteCompetitionEntry), so each staff controls it in one click.
