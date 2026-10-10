import { describe, expect, test } from "bun:test";
import { isOwnSession } from "./sessionAuthor";
describe("session creator identity", () => {
  test("authenticated creator is self", () => {
    expect(isOwnSession({ session_id: "s", author_user_id: "alexis", author_name: "Alexis" }, "alexis")).toBe(true);
  });
  test("staff actor takes precedence over athlete assignment", () => {
    expect(isOwnSession({ session_id: "s", author_user_id: "coach", author_name: "Alexis", author_player_id: "arthur" }, "athlete", "arthur")).toBe(false);
  });
  test("historical athlete creator is not another athlete", () => {
    expect(isOwnSession({ session_id: "s", author_user_id: null, author_name: "Arthur", author_player_id: "arthur" }, undefined, "arthur")).toBe(true);
    expect(isOwnSession({ session_id: "s", author_user_id: null, author_name: "Arthur", author_player_id: "arthur" }, undefined, "manon")).toBe(false);
  });
  test("unknown authorship is never assigned to the viewer", () => {
    expect(isOwnSession({ session_id: "s", author_user_id: null, author_name: null }, "alexis", "arthur")).toBe(false);
  });
});