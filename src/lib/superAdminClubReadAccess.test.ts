import { describe, expect, it } from "bun:test";

async function readClubRows(table: string, authenticated: boolean) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const rawSession = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
  if (!url || !key || !rawSession) throw new Error("Managed session and configuration required");
  const session = JSON.parse(rawSession) as { access_token?: string };
  if (!session.access_token) throw new Error("Authenticated test session required");
  const filters = table === "matches" ? "&is_personal=eq.false" : "";
  const response = await fetch(`${url}/rest/v1/${table}?select=id&category_id=eq.f0d820b4-51d3-43d2-87bd-ec246662580a${filters}`, {
    headers: { apikey: key, ...(authenticated ? { Authorization: `Bearer ${session.access_token}` } : {}) },
  });
  if (!response.ok) throw new Error(`Club read returned HTTP ${response.status}`);
  return await response.json() as { id: string }[];
}

describe("full super-admin club consultation integration", () => {
  it("reads 42 non-personal Balma competitions through caller RLS", async () => {
    expect((await readClubRows("matches", true)).length).toBe(42);
  });
  it("reads 303 Balma training sessions through caller RLS", async () => {
    expect((await readClubRows("training_sessions", true)).length).toBe(303);
  });
  it("does not expose Balma competitions anonymously", async () => {
    expect(await readClubRows("matches", false)).toEqual([]);
  });
  it("does not expose Balma sessions anonymously", async () => {
    expect(await readClubRows("training_sessions", false)).toEqual([]);
  });
});