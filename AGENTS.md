# Architecture decisions
- The shared athlete notification dialog sends push-only requests using linked user IDs; composition announcements use an editable default message without changing global-calendar availability invitations.
- OneSignal device registration waits for the explicit post-init readiness flag and caches only successful syncs; SDK method availability alone does not mean initialization has completed.
- Attendance reports label notification channels active only from confirmed enabled OneSignal subscriptions; preference toggles alone never prove delivery readiness.
- Global calendar attendance previews read only `match_participants` and minimal player display fields, never lineups or the full roster, so counts reflect invited athletes and their actual responses across all sports.

- Push permission reads the native three-state permission first; OneSignal's boolean false is never treated as denied because it also means not requested.

- Athlete staff badges use unread `session_feedback` (RPE) and `wellness_submitted` (wellness) notifications as their source of truth, so read state stays user-specific without duplicating submission data.
- The load calendar combines category training sessions and non-personal competitions over their date ranges; competition references affect only calendar summaries, never stored athlete loads.
- The competition RPE target is a per-category setting (categories.competition_planned_rpe, default 8) read via useCompetitionPlannedRpe, so each staff adapts competition load to their discipline.
- Athlete self-entry of competition data (results, competition RPE) is gated by the per-category flag categories.athlete_competition_entry_enabled (read via useAthleteCompetitionEntry), so each staff controls it in one click.
- Athlete navigation and wellness summaries use semantic CSS tokens with valid HSL alpha syntax; never append hexadecimal alpha to an HSL string, because mobile browsers can render identical foreground and background colors.
- Arsenal Bank managers (`public.arsenal_bank_managers` + `is_arsenal_bank_manager()`) get the Super Admin page restricted to the arsenal-bank tab and system-ball write policies, without being super admins.
- Bowling session kind is stored in the structured column `training_sessions.session_kind` (training/competition/personal/evaluation, nullable), never in free-text notes, so histories and stats can filter on it.
- Circuit V2 athlete logs keep one `athlete_exercise_logs` row per circuit (aggregated so tonnage = Σ charge × reps) and store per-exercise/per-round detail in a `<!--circuit-log:...-->` notes tag, so the unique key and tonnage stay unchanged.

- Athlete mental content is rendered with a safe Markdown renderer and navigation derived only from stored headings; coach content is never rewritten.
- Circuit tour completion uses explicit confirmations persisted in the backward-compatible circuit notes tag, not visits or prescribed values; tonnage aggregation remains independent.
- Athlete entry drafts are kept in component memory keyed by session and discarded on successful validation or account change; sensitive responses are never written to browser storage.
