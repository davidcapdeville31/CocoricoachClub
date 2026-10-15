import { describe, expect, it } from "bun:test";
import { mergeCompetitionParticipants, filterCompetitionParticipants, INITIAL_COMPETITION_PARTICIPANTS } from "./competitionParticipants";

describe("competition participant display", () => {
  it("deduplicates invitations and multiple composition entries without changing their sources", () => {
    const rows = mergeCompetitionParticipants([{ player_id: "a", attendance_status: "present" }], [{ player_id: "a", discipline: "100m" }, { player_id: "a", discipline: "200m" }], [{ id: "a", first_name: "Alex", name: "Martin" }]);
    expect(rows).toHaveLength(1);
    expect(rows[0].invited).toBe(true);
    expect(rows[0].composed).toBe(true);
    expect(rows[0].attendance).toBe("present");
    expect(rows[0].disciplines).toEqual(["100m", "200m"]);
  });
  it("shows all eight participants in the initial list", () => {
    const rows = mergeCompetitionParticipants(Array.from({ length: 8 }, (_, i) => ({ player_id: String(i) })), [], []);
    expect(rows.slice(0, INITIAL_COMPETITION_PARTICIPANTS)).toHaveLength(8);
  });
  it("sorts alphabetically and searches first and last names without accents", () => {
    const rows = mergeCompetitionParticipants([{ player_id: "z" }, { player_id: "a" }], [], [{ id: "z", name: "Zitouni", first_name: "Élodie" }, { id: "a", name: "Angevin", first_name: "Arthur" }]);
    expect(rows.map((row) => row.id)).toEqual(["a", "z"]);
    expect(filterCompetitionParticipants(rows, "zit elodie").map((row) => row.id)).toEqual(["z"]);
  });
  it("updates the unique count when sources add or remove participants", () => {
    expect(mergeCompetitionParticipants([], [], [])).toHaveLength(0);
    expect(mergeCompetitionParticipants([{ player_id: "a" }], [{ player_id: "b" }], [])).toHaveLength(2);
    expect(mergeCompetitionParticipants([], [{ player_id: "b" }], [])).toHaveLength(1);
  });
});