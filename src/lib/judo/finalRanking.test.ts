import { describe, it, expect } from "vitest";
import { finalRankingLabel, finalRankingNumber, isPodium } from "./finalRanking";

describe("judo final ranking", () => {
  it("non renseigné is never NC", () => {
    expect(finalRankingLabel(null)).toBeNull();
    expect(finalRankingLabel(undefined)).toBeNull();
  });
  it("NC is explicit and has no numeric rank", () => {
    expect(finalRankingLabel("NC")).toBe("NC");
    expect(finalRankingNumber("NC")).toBeNull();
  });
  it("3e is a podium, 5e is not", () => {
    expect(finalRankingLabel("3")).toBe("🥉 3e");
    expect(isPodium("3")).toBe(true);
    expect(isPodium("5")).toBe(false);
  });
});
