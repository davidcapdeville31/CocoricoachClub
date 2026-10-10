import { describe, expect, test } from "bun:test";
import { canAddAthleteDocument } from "./athleteDocumentAccess";

describe("existing document upload rights", () => {
  test("owner may add a personal document", () => expect(canAddAthleteDocument("personal", true, false)).toBe(true));
  test("ownership alone never grants team upload", () => expect(canAddAthleteDocument("team", true, false)).toBe(false));
  test("category manager may add in either context", () => {
    expect(canAddAthleteDocument("personal", false, true)).toBe(true);
    expect(canAddAthleteDocument("team", false, true)).toBe(true);
  });
  test("unconfirmed rights expose neither action", () => {
    expect(canAddAthleteDocument("personal", false, false)).toBe(false);
    expect(canAddAthleteDocument("team", false, false)).toBe(false);
  });
});