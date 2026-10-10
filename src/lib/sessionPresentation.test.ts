import { describe, it, expect } from "bun:test";
import { getSessionDisplayTitle, getSessionOrigin, getReadableNotes, getNotesSectionKey, getCompletionStatus, getEntryStatus } from "./sessionPresentation";

describe("sessionPresentation", () => {
  it("bowling simplifié devient Séance bowling", () => {
    expect(getSessionDisplayTitle({ training_type: "bowling_simplified" })).toBe("Séance bowling");
    expect(getSessionDisplayTitle({ training_type: "bowling_advanced" })).toBe("Séance bowling");
  });
  it("retire [Séance athlète] et le mode d'un titre", () => {
    expect(getSessionDisplayTitle({ title: "[Séance athlète] Séance bowling — Mode simplifié" })).toBe("Séance bowling");
    expect(getSessionDisplayTitle({ title: "[Séance athlète] Séance de course" })).toBe("Séance de course");
  });
  it("conserve un titre personnalisé", () => {
    expect(getSessionDisplayTitle({ title: "Spares 7-10", training_type: "bowling_simplified" })).toBe("Spares 7-10");
  });
  it("séance créée par l'athlète = personnelle, jamais consignes du coach", () => {
    const o = getSessionOrigin({ created_by_player_id: "p1" });
    expect(o).toBe("personal");
    expect(getNotesSectionKey(o)).toBe("myNotes");
    expect(getNotesSectionKey(getSessionOrigin({ notes: "[Séance athlète] x" }))).toBe("myNotes");
  });
  it("séance staff = consignes du coach", () => {
    expect(getNotesSectionKey(getSessionOrigin({ author_user_id: "u1" }))).toBe("coachInstructions");
  });
  it("supprime les lignes techniques auto-générées", () => {
    expect(getReadableNotes("Séance bowling — Mode simplifié\nDurée : 75 min · RPE : 6/10\nObjectif : spares")).toBe("Objectif : spares");
    expect(getReadableNotes("Séance bowling — Mode simplifié")).toBe("");
  });
  it("statuts réalisation et saisie distincts", () => {
    const now = new Date("2026-09-09T12:00:00");
    expect(getCompletionStatus({ session_date: "2026-09-09", session_start_time: "09:00", session_end_time: "10:15" }, now)).toBe("done");
    expect(getCompletionStatus({ session_date: "2026-09-10" }, now)).toBe("scheduled");
    expect(getEntryStatus(true, false, true)).toBe("partial");
    expect(getEntryStatus(false, false, true)).toBe("toComplete");
    expect(getEntryStatus(true, true, true)).toBe("recorded");
  });
});
