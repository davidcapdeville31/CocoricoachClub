import { supabase } from "@/integrations/supabase/client";

const DB_NAME = "match-prepare-cache";
const DB_VERSION = 1;
const STORE = "cache";
const SESSION_STORE = "session";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" });
      if (!db.objectStoreNames.contains(SESSION_STORE)) db.createObjectStore(SESSION_STORE, { keyPath: "key" });
    };
  });
}

export async function setCachedData(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ key, value, cachedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getCachedData<T = unknown>(key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => {
      db.close();
      resolve(req.result ? (req.result.value as T) : null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function saveSession(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SESSION_STORE, "readwrite");
    tx.objectStore(SESSION_STORE).put({ key: "current", session: data.session, savedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getLastPreparation(matchId: string): Promise<number | null> {
  const data = await getCachedData<{ preparedAt: number }>(`match:${matchId}:meta`);
  return data?.preparedAt ?? null;
}

export type PrepareStep =
  | "match"
  | "players"
  | "stats"
  | "categories"
  | "session"
  | "warmup"
  | "done";

export interface PrepareProgress {
  step: PrepareStep;
  label: string;
  status: "pending" | "running" | "done" | "error";
  error?: string;
}

const STEPS: { id: PrepareStep; label: string }[] = [
  { id: "match", label: "Chargement des données du match…" },
  { id: "players", label: "Mise en cache des joueurs et équipes…" },
  { id: "stats", label: "Mise en cache des statistiques existantes…" },
  { id: "categories", label: "Mise en cache des catégories de stats…" },
  { id: "warmup", label: "Préchargement des routes de l'application…" },
  { id: "session", label: "Sauvegarde de la session utilisateur…" },
  { id: "done", label: "Application prête pour une utilisation hors-ligne ✅" },
];

export function getPrepareSteps() {
  return STEPS;
}

const CRITICAL_PATHS = ["/", "/dashboard", "/categories"];

async function warmUpRoutes(matchId: string, categoryId: string | null) {
  const urls = [
    ...CRITICAL_PATHS,
    `/categories/${categoryId ?? ""}`,
    `/categories/${categoryId ?? ""}/match/${matchId}/live`,
  ].filter(Boolean);

  // Try API endpoint first (no-op if missing), else manual fetch
  try {
    await fetch("/api/cache-warmup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls }),
    }).catch(() => null);
  } catch {
    /* ignore */
  }
  await Promise.all(
    urls.map((u) =>
      fetch(u, { method: "GET", credentials: "same-origin" }).catch(() => null),
    ),
  );
}

export async function prepareMatchCache(
  matchId: string,
  onProgress?: (p: PrepareProgress) => void,
): Promise<void> {
  const emit = (step: PrepareStep, status: PrepareProgress["status"], error?: string) => {
    const meta = STEPS.find((s) => s.id === step)!;
    onProgress?.({ step, label: meta.label, status, error });
  };

  let categoryId: string | null = null;

  // 1. Match
  emit("match", "running");
  try {
    const { data: match, error } = await supabase
      .from("matches")
      .select("*, categories(*)")
      .eq("id", matchId)
      .single();
    if (error) throw error;
    categoryId = match?.category_id ?? null;
    await setCachedData(`match:${matchId}`, match);
    emit("match", "done");
  } catch (e: any) {
    emit("match", "error", e?.message ?? "Erreur de chargement du match");
    throw e;
  }

  // 2. Players & lineup
  emit("players", "running");
  try {
    const [{ data: lineup }, { data: players }] = await Promise.all([
      supabase
        .from("match_lineups")
        .select("*, players(*)")
        .eq("match_id", matchId),
      categoryId
        ? supabase.from("players").select("*").eq("category_id", categoryId)
        : Promise.resolve({ data: [] as any }),
    ]);
    await setCachedData(`match:${matchId}:lineup`, lineup ?? []);
    await setCachedData(`match:${matchId}:players`, players ?? []);
    emit("players", "done");
  } catch (e: any) {
    emit("players", "error", e?.message);
    throw e;
  }

  // 3. Existing stats / events
  emit("stats", "running");
  try {
    const [{ data: events }, { data: pStats }] = await Promise.all([
      supabase
        .from("match_events" as any)
        .select("*")
        .eq("match_id", matchId),
      supabase
        .from("player_match_stats" as any)
        .select("*")
        .eq("match_id", matchId),
    ]);
    await setCachedData(`match:${matchId}:events`, events ?? []);
    await setCachedData(`match:${matchId}:player_stats`, pStats ?? []);
    emit("stats", "done");
  } catch (e: any) {
    emit("stats", "error", e?.message);
    throw e;
  }

  // 4. Stat preferences / categories
  emit("categories", "running");
  try {
    if (categoryId) {
      const [{ data: catPrefs }, { data: matchOverride }] = await Promise.all([
        supabase
          .from("category_stat_preferences" as any)
          .select("*")
          .eq("category_id", categoryId)
          .maybeSingle(),
        supabase
          .from("match_stat_overrides" as any)
          .select("*")
          .eq("match_id", matchId)
          .maybeSingle(),
      ]);
      await setCachedData(`match:${matchId}:cat_prefs`, catPrefs ?? null);
      await setCachedData(`match:${matchId}:match_override`, matchOverride ?? null);
    }
    emit("categories", "done");
  } catch (e: any) {
    emit("categories", "error", e?.message);
    throw e;
  }

  // 5. Warmup routes (Service Worker cache)
  emit("warmup", "running");
  try {
    await warmUpRoutes(matchId, categoryId);
    emit("warmup", "done");
  } catch (e: any) {
    emit("warmup", "error", e?.message);
    // not fatal
  }

  // 6. Session
  emit("session", "running");
  try {
    await saveSession();
    emit("session", "done");
  } catch (e: any) {
    emit("session", "error", e?.message);
    throw e;
  }

  await setCachedData(`match:${matchId}:meta`, { preparedAt: Date.now() });
  emit("done", "done");
}
