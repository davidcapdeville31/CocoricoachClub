import { mergeCompetitionParticipants, type CompetitionParticipantIdentity, type CompetitionParticipantRelation } from "./competitionParticipants";
import { isGameComplete } from "./bowling/scoreRules";
import type { FrameData } from "@/components/athlete-portal/BowlingScoreSheet";

export type ParticipationStatus = "present" | "absent" | "to_verify" | "unset";
export type ParticipationCorrection = { player_id: string; participation_status: string | null };
export type ParticipationRound = { player_id: string; result?: string | null; final_time_seconds?: number | null; ranking?: number | null; competition_round_stats?: { id?: string; stat_data?: unknown }[] };
export const participationLabels: Record<ParticipationStatus, string> = { present: "Présent", absent: "Absent", to_verify: "À vérifier", unset: "Non renseigné" };
export function hasValidCompetitionResult(round: ParticipationRound): boolean {
  if (round.result?.trim() || (round.final_time_seconds != null && round.final_time_seconds > 0) || (round.ranking != null && round.ranking > 0)) return true;
  return (round.competition_round_stats || []).some(({ stat_data }) => {
    if (!stat_data || typeof stat_data !== "object" || Array.isArray(stat_data)) return false;
    const data = stat_data as Record<string, unknown>;
    const frames = data.bowlingFrames ?? data.frames;
    if (Array.isArray(frames) && frames.length > 0) {
      // A provisional score never proves that a game was actually completed.
      return frames.every(f => f && typeof f === "object" && Array.isArray(f.throws)) && isGameComplete(frames as FrameData[]);
    }
    if (typeof data.gameScore === "number") return Number.isFinite(data.gameScore) && data.gameScore >= 0 && data.gameScore <= 300;
    // Metadata, default zeroes and empty stats rows are not sports evidence.
    return Object.entries(data).some(([key, value]) => !key.startsWith("_") && key !== "roundDate" && typeof value === "number" && Number.isFinite(value) && value > 0);
  });
}
export function resolveCompetitionParticipation(hasSportsResults: boolean, staffStatus?: string | null): { status: "present" | "absent" | "pending"; source: "sports_result" | "staff" | "unknown"; hasSportsResults: boolean; conflict: boolean; staffStatus: string | null } {
  const manual = staffStatus === "present" || staffStatus === "absent" || staffStatus === "to_verify";
  return {
    status: hasSportsResults ? "present" as const : staffStatus === "present" || staffStatus === "absent" ? staffStatus : "pending" as const,
    source: hasSportsResults ? "sports_result" as const : manual ? "staff" as const : "unknown" as const,
    hasSportsResults,
    conflict: hasSportsResults && staffStatus === "absent",
    staffStatus: manual ? staffStatus : null,
  };
}
export function buildParticipationRows(invitations: CompetitionParticipantRelation[], lineup: CompetitionParticipantRelation[], identities: CompetitionParticipantIdentity[], rounds: ParticipationRound[], corrections: ParticipationCorrection[], individual: boolean, _future: boolean) {
  const meaningful = individual ? rounds.filter(hasValidCompetitionResult) : [];
  const resultPlayers = new Set(meaningful.map(r => r.player_id));
  const staff = new Map(corrections.map(r => [r.player_id, r.participation_status]));
  const composedPlayers = new Set(lineup.map(r => r.player_id));
  const extra = [...meaningful, ...corrections].map(r => ({ player_id: r.player_id }));
  return mergeCompetitionParticipants(invitations, [...lineup, ...extra], identities).map(row => {
    const resolved = resolveCompetitionParticipation(resultPlayers.has(row.id), staff.get(row.id));
    const participation: ParticipationStatus = resolved.status === "pending" ? "to_verify" : resolved.status;
    return { ...row, ...resolved, participation, automatic: resolved.source === "sports_result", manual: resolved.source === "staff", composed: composedPlayers.has(row.id) };
  });
}
export function participationCounts(rows: { participation: ParticipationStatus }[]) {
  return rows.reduce((counts, row) => { counts[row.participation]++; return counts; }, { total: rows.length, present: 0, absent: 0, to_verify: 0, unset: 0 });
}