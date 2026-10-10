import { describe, expect, it } from "bun:test";
import { blockDuration, decodeBlockNotes, durationFromTimes, encodeBlockNotes, newBlock, randoriDurations, sumBlocks, toBlockRow } from "./sessionModel";
import { searchTechniques } from "./nomenclature";

describe("séance judo", () => {
  it("5 randori × 4 min avec 1 min de récupération = 20 min d'opposition, 24 min au total", () => {
    const b = { ...newBlock("randori"), randori_count: 5, randori_unit_min: 4, randori_rest_min: 1 };
    expect(randoriDurations(b)).toEqual({ opposition: 20, recovery: 4, total: 24 });
    expect(blockDuration(b)).toBe(24);
  });

  it("une durée absente n'est jamais comptée comme 0 minute renseignée", () => {
    const s = sumBlocks([{ ...newBlock("technique"), duration_min: 25 }, newBlock("tactic")]);
    expect(s).toEqual({ total: 25, missing: 1 });
  });

  it("calcule la durée depuis les horaires et refuse une fin avant le début", () => {
    expect(durationFromTimes("18:00", "19:30")).toBe(90);
    expect(durationFromTimes("19:00", "18:00")).toBeNull();
  });

  it("conserve les techniques sous forme structurée après enregistrement", () => {
    const b = { ...newBlock("technique"), positions: ["tachi" as const], techniques: ["o_soto_gari"], modalities: [] };
    const decoded = decodeBlockNotes(encodeBlockNotes(b));
    expect(decoded?.techniques).toEqual(["o_soto_gari"]);
    expect(toBlockRow(b, 0).training_type).toBe("judo_technique");
  });

  it("la recherche ignore accents et tirets", () => {
    expect(searchTechniques("osoto", "tachi").map((t) => t.label)).toContain("O-soto-gari");
    expect(searchTechniques("kesa", "tachi")).toHaveLength(0);
  });
});
