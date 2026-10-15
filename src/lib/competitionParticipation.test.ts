import { describe, expect, it } from "bun:test";
import { buildParticipationRows, participationCounts } from "./competitionParticipation";
const invitations = [{ player_id: "a", attendance_status: "present" }, { player_id: "b", attendance_status: "absent" }];
describe("effective competition participation", () => {
  it("never treats confirmed RSVP as effective attendance", () => {
    expect(buildParticipationRows(invitations, [], [], [], [], false, false)[0].participation).toBe("to_verify");
  });
  it("allows confirmed RSVP and manual absence independently", () => {
    const row = buildParticipationRows(invitations, [], [], [], [{ player_id: "a", participation_status: "absent" }], true, false)[0];
    expect(row.attendance).toBe("present"); expect(row.participation).toBe("absent");
  });
  it("never infers absence from missing or empty combats", () => {
    expect(buildParticipationRows(invitations, [], [], [{ player_id: "a" }], [], true, false)[0].participation).toBe("to_verify");
  });
  it("future competitions keep unknown attendance even after declined RSVP", () => {
    expect(buildParticipationRows(invitations, [], [], [], [], false, true).map(r => r.participation)).toEqual(["unset", "unset"]);
  });
  it("deduplicates actual games, invitations and registrations", () => {
    const rows = buildParticipationRows(invitations, [{ player_id: "a" }], [], [{ player_id: "a", result: "win" }, { player_id: "a", competition_round_stats: [{ id: "s" }] }], [], true, false);
    expect(rows).toHaveLength(2); expect(rows[0].automatic).toBe(true); expect(rows[0].participation).toBe("present");
  });
  it("manual correction overrides individual result inference", () => {
    expect(buildParticipationRows(invitations, [], [], [{ player_id: "a", result: "win" }], [{ player_id: "a", participation_status: "absent" }], true, false)[0].participation).toBe("absent");
  });
  it("collective rounds do not infer effective attendance", () => {
    expect(buildParticipationRows(invitations, [], [], [{ player_id: "a", result: "win" }], [], false, false)[0].participation).toBe("to_verify");
  });
  it("global counts include all thirty participants regardless of reduced or filtered view", () => {
    const rows = buildParticipationRows(Array.from({length:30}, (_,i) => ({player_id:String(i)})), [], [], [], [{player_id:"0", participation_status:"present"}], true, false);
    const counts = participationCounts(rows); rows.filter(r => r.participation === "present").slice(0,8);
    expect(counts).toEqual({total:30, present:1, absent:0, to_verify:29, unset:0});
    expect(participationCounts(rows.map(r => r.id === "0" ? {...r, participation:"absent" as const} : r)).absent).toBe(1);
  });
});