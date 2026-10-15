import { mergeCompetitionParticipants, type CompetitionParticipantIdentity, type CompetitionParticipantRelation } from "./competitionParticipants";

export type ParticipationStatus = "present" | "absent" | "to_verify" | "unset";
export type ParticipationCorrection = { player_id: string; participation_status: string | null };
export type ParticipationRound = { player_id: string; result?: string | null; final_time_seconds?: number | null; ranking?: number | null; competition_round_stats?: { id: string }[] };
export const participationLabels: Record<ParticipationStatus, string> = { present: "Présent", absent: "Absent", to_verify: "À vérifier", unset: "Non renseigné" };
export function buildParticipationRows(invitations: CompetitionParticipantRelation[], lineup: CompetitionParticipantRelation[], identities: CompetitionParticipantIdentity[], rounds: ParticipationRound[], corrections: ParticipationCorrection[], individual: boolean, future: boolean) {
  const meaningful = individual ? rounds.filter(r => Boolean(r.result) || r.final_time_seconds != null || r.ranking != null || Boolean(r.competition_round_stats?.length)) : [];
  const extra = [...meaningful, ...corrections].map(r => ({ player_id: r.player_id }));
  return mergeCompetitionParticipants(invitations, [...lineup, ...extra], identities).map(row => {
    const correction = corrections.find(r => r.player_id === row.id)?.participation_status;
    const manual = correction === "present" || correction === "absent" || correction === "to_verify";
    const automatic = !manual && meaningful.some(r => r.player_id === row.id);
    const participation: ParticipationStatus = manual ? correction : automatic ? "present" : future ? "unset" : "to_verify";
    return { ...row, participation, automatic, manual, composed: lineup.some(r => r.player_id === row.id) };
  });
}
export function participationCounts(rows: { participation: ParticipationStatus }[]) {
  return rows.reduce((counts, row) => { counts[row.participation]++; return counts; }, { total: rows.length, present: 0, absent: 0, to_verify: 0, unset: 0 });
}