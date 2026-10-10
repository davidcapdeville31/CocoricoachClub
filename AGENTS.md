# Architecture decisions
- Athlete visuals inherit scoped tokens to avoid portal regressions.
- Selectable controls use shared tokens and state attributes, preserving functional statuses.
- Athlete mobile navigation uses URL tabs and sport visibility; drawer/theme commands reuse FieldModeContext to preserve preferences.
- Athlete content reserves ResizeObserver-measured navigation and safe-area height; visualViewport hides navigation under the keyboard, preserving form state.
- Athlete notifications are push-only via linked user IDs; composition messages stay editable and calendar availability invitations unchanged.
- BrandLogo uses identical artwork and transparency across themes; its CDN dark variant has light strokes to avoid checkerboards and brand drift.
- OneSignal registration waits for explicit post-init readiness and caches only successful syncs; available SDK methods do not prove readiness.
- Attendance reports require confirmed enabled OneSignal subscriptions to mark push active; preferences alone never prove readiness.
- Attendance previews read `match_participants` and minimal player fields, never lineups, to count actual invitations/responses.

- Push permission reads the native three-state permission first; OneSignal's boolean false is never treated as denied because it also means not requested.

- Athlete staff badges use unread `session_feedback` (RPE) and `wellness_submitted` (wellness) notifications as their source of truth, so read state stays user-specific without duplicating submission data.
- The load calendar combines category training sessions and non-personal competitions over their date ranges; competition references affect only calendar summaries, never stored athlete loads.
- useCompetitionPlannedRpe reads the category target so staff adapts competition load to their discipline.
- useAthleteCompetitionEntry gates athlete competition entry using the category flag, keeping staff in control.
- Athlete navigation/wellness use semantic tokens with valid HSL alpha, never hexadecimal suffixes on HSL strings, to prevent invisible mobile content.
- Arsenal Bank managers (`public.arsenal_bank_managers` + `is_arsenal_bank_manager()`) get the Super Admin page restricted to the arsenal-bank tab and system-ball write policies, without being super admins.
- Bowling session kind is stored in the structured column `training_sessions.session_kind` (training/competition/personal/evaluation, nullable), never in free-text notes, so histories and stats can filter on it.
- Circuit V2 athlete logs keep one `athlete_exercise_logs` row per circuit (aggregated so tonnage = Σ charge × reps) and store per-exercise/per-round detail in a `<!--circuit-log:...-->` notes tag, so the unique key and tonnage stay unchanged.

- Athlete mental content is rendered with a safe Markdown renderer and navigation derived only from stored headings; coach content is never rewritten.
- Circuit tour completion uses explicit confirmations persisted in the backward-compatible circuit notes tag, not visits or prescribed values; tonnage aggregation remains independent.
- Athlete entry drafts are kept in component memory keyed by session and discarded on successful validation or account change; sensitive responses are never written to browser storage.

- Bowling desktop and guided mobile share frame state and pure score/validation helpers; absent throws never resolve bonuses or cumulative scores, avoiding divergent score engines.
- Optional bowling observations use a backward-compatible observed-fields list on existing throw JSON; omitted metadata preserves legacy meaning, while new absent observations are excluded from denominators.
- Poche/Split use one typed tri-state component with invariant tokens and a dedicated Button variant; null adapts to observed-fields JSON, preserving statistics. Mobile entry holds each throw until explicit continuation.
- In-progress bowling games remain in block configuration but never enter completed-game aggregates or flattened competition results; this preserves resumable input without publishing provisional scores.
- Judo premium sessions reuse training_sessions/training_session_blocks (training_type terrain + judo_* blocks) with structured detail in backward-compatible `<!--judo-block:...-->`/`<!--judo-session:...-->` notes tags, so existing calendars, workload and history keep working without schema changes.

- FieldModeContext activates canonical `.dark` tokens and Tailwind variants; no parallel theme provider.
- RPE uses `data-rpe`; form uses shared FeelingChoices and `data-feeling` tokens; selection overrides exclude both and bowling to preserve meaning.

- Attendance uses `data-attendance` status tokens outside selection overrides; session actions stay outside disclosures to remain accessible when collapsed.

- Athlete calendar uses scoped Day Picker/month and date-fns/week over identical data; mounted tabs preserve drafts and civil-date URL context without changing business dialogs.
- Upcoming summaries batch attendance reads; controls retain write destinations and locks to avoid a parallel RSVP model.
