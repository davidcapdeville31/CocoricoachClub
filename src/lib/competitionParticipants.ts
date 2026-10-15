export interface CompetitionParticipantRelation {
  player_id: string;
  attendance_status?: string | null;
  discipline?: string | null;
  specialty?: string | null;
}

export interface CompetitionParticipantIdentity {
  id: string | null;
  name?: string | null;
  first_name?: string | null;
  avatar_url?: string | null;
}

export function mergeCompetitionParticipants(
  invitations: CompetitionParticipantRelation[],
  lineup: CompetitionParticipantRelation[],
  identities: CompetitionParticipantIdentity[],
) {
  const players = new Map(identities.map((player) => [player.id, player]));
  const ids = new Set([...invitations, ...lineup].map((row) => row.player_id));
  return Array.from(ids).map((id) => {
    const player = players.get(id);
    const invitation = invitations.find((row) => row.player_id === id);
    const entries = lineup.filter((row) => row.player_id === id);
    return {
      id, player,
      name: [player?.first_name, player?.name].filter(Boolean).join(" ") || "Athlète",
      invited: !!invitation,
      composed: entries.length > 0,
      attendance: invitation?.attendance_status,
      disciplines: Array.from(new Set(entries.map((row) => [row.discipline, row.specialty].filter(Boolean).join(" · ")).filter(Boolean))),
    };
  }).sort((a, b) => (a.player?.name || a.name).localeCompare(b.player?.name || b.name, "fr", { sensitivity: "base" }) || a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
}

export function filterCompetitionParticipants<T extends { name: string }>(participants: T[], search: string) {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
  const words = normalize(search).split(/\s+/).filter(Boolean);
  return participants.filter((participant) => words.every((word) => normalize(participant.name).includes(word)));
}

export const INITIAL_COMPETITION_PARTICIPANTS = 8;