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
    expect(buildParticipationRows(invitations, [], [], [], [], false, true).map(r => r.participation)).toEqual(["to_verify", "to_verify"]);
  });
  it("deduplicates actual games, invitations and registrations", () => {
    const rows = buildParticipationRows(invitations, [{ player_id: "a" }], [], [{ player_id: "a", result: "win" }, { player_id: "a", competition_round_stats: [{ id: "s" }] }], [], true, false);
    expect(rows).toHaveLength(2); expect(rows[0].automatic).toBe(true); expect(rows[0].participation).toBe("present");
  });
  it("sports result overrides manual absence without erasing the contradiction", () => {
    const row = buildParticipationRows(invitations, [], [], [{ player_id: "a", result: "win" }], [{ player_id: "a", participation_status: "absent" }], true, false)[0];
    expect(row.participation).toBe("present"); expect(row.conflict).toBe(true); expect(row.staffStatus).toBe("absent");
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

describe("automatic sports evidence", () => {
  const game = (player_id = "a") => ({player_id, competition_round_stats:[{stat_data:{gameScore:180}}]});
  const resolve = (rounds: Parameters<typeof buildParticipationRows>[3], correction: string | null = null, attendance = "no_response") => buildParticipationRows([{player_id:"a",attendance_status:attendance}],[],[],rounds, correction ? [{player_id:"a",participation_status:correction}] : [],true,false)[0];
  it("five bowling games and no RSVP prove presence", () => { expect(resolve(Array.from({length:5},()=>game())).participation).toBe("present"); });
  it("two judo combats and no RSVP prove presence", () => { expect(resolve([{player_id:"a",result:"win"},{player_id:"a",result:"loss"}]).participation).toBe("present"); });
  it("keeps a refused invitation despite sports presence", () => { const row=resolve([game()],null,"absent"); expect(row.participation).toBe("present"); expect(row.attendance).toBe("absent"); });
  it("accepted invitation alone remains pending", () => { expect(resolve([],null,"present").status).toBe("pending"); });
  it("staff presence without results is present", () => { expect(resolve([],"present").source).toBe("staff"); expect(resolve([],"present").participation).toBe("present"); });
  it("staff absence without results is absent", () => { expect(resolve([],"absent").participation).toBe("absent"); });
  it("last result deletion restores staff or unknown status", () => { for (const status of ["present","absent",null] as const) { expect(resolve([game()],status).participation).toBe("present"); expect(resolve([],status).participation).toBe(status || "to_verify"); } });
  it("historical results count despite no invitations", () => { const rows=buildParticipationRows([],[],[],[game()],[],true,false); expect(rows).toHaveLength(1); expect(rows[0].automatic).toBe(true); });
  it("adding and modifying a result recalculates counts", () => { const rows=(rounds: Parameters<typeof buildParticipationRows>[3])=>buildParticipationRows([{player_id:"a"}],[],[],rounds,[],true,false); expect(participationCounts(rows([])).present).toBe(0); expect(participationCounts(rows([game()])).present).toBe(1); expect(participationCounts(rows([{player_id:"a",competition_round_stats:[{stat_data:{}}]}])).present).toBe(0); });
  it("does not mutate or duplicate historical inputs", () => { const before=JSON.stringify(invitations); const rows=buildParticipationRows(invitations,[{player_id:"a"}],[],Array.from({length:5},()=>game()),[],true,false); expect(rows).toHaveLength(2); expect(JSON.stringify(invitations)).toBe(before); });
  it("empty stats, metadata and default zeroes are not evidence", () => { expect(resolve([{player_id:"a",competition_round_stats:[{id:"s",stat_data:{_discipline:"judo",blockId:"b",roundDate:"2026-10-15",ijf_ippon_me:0}}]}]).participation).toBe("to_verify"); });
  it("a completed zero bowling score is valid, an unfinished sheet is not", () => { expect(resolve([{player_id:"a",competition_round_stats:[{stat_data:{gameScore:0}}]}]).participation).toBe("present"); expect(resolve([{player_id:"a",competition_round_stats:[{stat_data:{gameScore:50,bowlingFrames:[{throws:[{value:"X",pins:10}]}]}}]}]).participation).toBe("to_verify"); });
  it("another athlete's results cannot confirm this athlete", () => { expect(resolve([game("b")]).participation).toBe("to_verify"); });
});