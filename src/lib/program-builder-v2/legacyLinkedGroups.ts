// Anciennes sauvegardes de programmes : les méthodes liées (superset, biset…)
// étaient enregistrées sans group_id. On reconstitue des groupes à partir des
// exercices consécutifs de même méthode liée, pour que l'édition (crayon)
// retrouve ses exercices au lieu d'ouvrir un éditeur vide.
const LINKED = new Set(["superset", "biset", "triset", "giant_set", "bulgarian", "combine_haltero"]);
const CHUNK: Record<string, number> = { superset: 2, biset: 2, triset: 3 };

export function restoreLegacyLinkedGroups<T extends { method?: string | null; groupId?: string | null }>(
  exercises: T[],
): T[] {
  const out = exercises.map((e) => ({ ...e }));
  let i = 0;
  while (i < out.length) {
    const m = out[i].method ?? "";
    if (!LINKED.has(m) || out[i].groupId) { i++; continue; }
    let j = i;
    while (j < out.length && out[j].method === m && !out[j].groupId) j++;
    const size = CHUNK[m] ?? j - i;
    for (let k = i; k < j; k += size) {
      const gid = `grp-legacy-${Math.random().toString(36).slice(2, 10)}`;
      for (let x = k; x < Math.min(k + size, j); x++) (out[x] as any).groupId = gid;
    }
    i = j;
  }
  return out;
}
