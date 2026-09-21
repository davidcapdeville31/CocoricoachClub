import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { collectWeightHistory, isWeightQuestionKeyLabel } from "@/lib/weight/weightHistory";
import { computeAcwrDetailed, type LoadRow } from "@/lib/acwr";
import { labelizeTestType } from "@/hooks/useCustomTestLabels";

/**
 * Collecte transverse de toutes les données comparables d'un athlète sur une période :
 * tests, assiduité applicative, présences (entraînement / compétition), charge,
 * blessures et poids. Générique — fonctionne pour toutes les disciplines.
 */

export interface Athlete360TestResult {
  testKey: string;
  date: string;
  value: number;
  unit: string | null;
}

export interface Athlete360Row {
  id: string;
  name: string;
  /** Assiduité app (Wellness / RPE) */
  wellnessDone: number;
  wellnessTotal: number;
  wellnessRate: number | null;
  rpeDone: number;
  rpeTotal: number;
  rpeRate: number | null;
  appRate: number | null;
  /** Présence entraînements */
  trainingPresent: number;
  trainingTotal: number;
  trainingRate: number | null;
  muscuPresent: number;
  muscuTotal: number;
  muscuRate: number | null;
  terrainPresent: number;
  terrainTotal: number;
  terrainRate: number | null;
  /** Présence compétitions */
  matchPresent: number;
  matchCalled: number;
  matchRate: number | null;
  /** Charge */
  totalLoad: number;
  weeklyLoad: number | null;
  acuteLoad: number | null;
  chronicLoad: number | null;
  acwr: number | null;
  acwrInsufficient: boolean;
  loadSessions: number;
  /** Blessures */
  injuryCount: number;
  injuryDays: number;
  injuryActive: boolean;
  injuryTypes: string[];
  /** Poids */
  weightFirst: number | null;
  weightLast: number | null;
  weightDelta: number | null;
  weightSeries: { date: string; weight: number }[];
  /** Tests */
  tests: Athlete360TestResult[];
}

export interface Athlete360TestOption {
  key: string;
  label: string;
  unit: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function useAthlete360(categoryId: string, startDate: string, endDate: string) {
  const { data: players = [] } = useQuery({
    queryKey: ["a360-players", categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("players")
        .select("id, name, first_name, position")
        .eq("category_id", categoryId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: bundle, isLoading } = useQuery({
    queryKey: ["a360-bundle", categoryId, startDate, endDate],
    enabled: !!categoryId,
    queryFn: async () => {
      const chronicStart = new Date(new Date(endDate).getTime() - 27 * DAY_MS)
        .toISOString()
        .slice(0, 10);
      const loadStart = chronicStart < startDate ? chronicStart : startDate;

      const [
        wellness,
        loads,
        sessions,
        attendance,
        matches,
        injuries,
        generic,
        strength,
        speed,
        bodyComps,
        measurements,
        genericAll,
        customTests,
      ] = await Promise.all([
        supabase
          .from("wellness_tracking")
          .select("player_id, tracking_date, auto_filled")
          .eq("category_id", categoryId)
          .gte("tracking_date", startDate)
          .lte("tracking_date", endDate),
        supabase
          .from("awcr_tracking")
          .select("player_id, session_date, auto_filled, rpe, duration_minutes, training_load, training_session_id")
          .eq("category_id", categoryId)
          .gte("session_date", loadStart)
          .lte("session_date", endDate),
        supabase
          .from("training_sessions")
          .select("id, session_date, training_type, notes, created_by_player_id")
          .eq("category_id", categoryId)
          .gte("session_date", startDate)
          .lte("session_date", endDate),
        supabase
          .from("training_attendance")
          .select("player_id, attendance_date, status, training_session_id, training_sessions(training_type)")
          .eq("category_id", categoryId)
          .gte("attendance_date", startDate)
          .lte("attendance_date", endDate),
        supabase
          .from("matches")
          .select("id, match_date")
          .eq("category_id", categoryId)
          .gte("match_date", startDate)
          .lte("match_date", endDate),
        supabase
          .from("injuries")
          .select("player_id, injury_date, actual_return_date, estimated_return_date, status, severity, injury_type")
          .eq("category_id", categoryId),
        supabase
          .from("generic_tests")
          .select("player_id, test_type, result_value, result_unit, test_date")
          .eq("category_id", categoryId)
          .order("test_date", { ascending: true }),
        supabase
          .from("strength_tests")
          .select("player_id, test_name, weight_kg, test_date")
          .eq("category_id", categoryId)
          .order("test_date", { ascending: true }),
        supabase
          .from("speed_tests")
          .select("player_id, test_type, vma_kmh, speed_kmh, time_40m_seconds, test_date")
          .eq("category_id", categoryId)
          .order("test_date", { ascending: true }),
        supabase
          .from("body_composition")
          .select("player_id, measurement_date, weight_kg, created_at")
          .eq("category_id", categoryId),
        supabase
          .from("player_measurements")
          .select("player_id, measurement_date, weight_kg, created_at")
          .eq("category_id", categoryId),
        supabase
          .from("generic_tests")
          .select("player_id, test_date, test_type, test_category, result_value, result_unit, created_at")
          .eq("category_id", categoryId),
        supabase.from("custom_tests").select("id, name, unit, test_category"),
        supabase
          .from("wellness_question_configs")
          .select("questions")
          .eq("category_id", categoryId)
          .maybeSingle(),
      ]);

      const wellnessConfig = (arguments0 => arguments0)(null) as any;

      const sessionRows = sessions.data || [];
      const sessionIds = sessionRows.map((s: any) => s.id);
      let eventParticipants: any[] = [];
      if (sessionIds.length > 0) {
        const page = 1000;
        for (let from = 0; ; from += page) {
          const { data, error } = await supabase
            .from("event_participants")
            .select("training_session_id, player_id, attendance_status")
            .in("training_session_id", sessionIds)
            .range(from, from + page - 1);
          if (error) throw error;
          eventParticipants.push(...(data || []));
          if ((data || []).length < page) break;
        }
      }

      const matchIds = (matches.data || []).map((m: any) => m.id);
      let matchParticipants: any[] = [];
      if (matchIds.length > 0) {
        const { data, error } = await supabase
          .from("match_participants")
          .select("match_id, player_id, attendance_status")
          .in("match_id", matchIds);
        if (error) throw error;
        matchParticipants = data || [];
      }

      return {
        wellness: wellness.data || [],
        loads: loads.data || [],
        sessions: sessionRows,
        attendance: attendance.data || [],
        matches: matches.data || [],
        injuries: injuries.data || [],
        generic: generic.data || [],
        strength: strength.data || [],
        speed: speed.data || [],
        eventParticipants,
        matchParticipants,
        weightEntries: collectWeightHistory({
          bodyComps: bodyComps.data || [],
          playerMeasurements: measurements.data || [],
          genericTests: (genericAll.data || []) as any,
          customTests: (customTests.data || []) as any,
        }),
        customTests: customTests.data || [],
      };
    },
  });

  const customMap = useMemo(() => {
    const map: Record<string, { name: string; unit: string | null }> = {};
    (bundle?.customTests || []).forEach((c: any) => {
      map[`custom:${String(c.id).toLowerCase()}`] = { name: c.name, unit: c.unit };
    });
    return map;
  }, [bundle?.customTests]);

  const allTests = useMemo<Record<string, Athlete360TestResult[]>>(() => {
    const out: Record<string, Athlete360TestResult[]> = {};
    const push = (pid: string, r: Athlete360TestResult) => {
      if (!out[pid]) out[pid] = [];
      out[pid].push(r);
    };
    (bundle?.generic || []).forEach((t: any) => {
      const v = Number(t.result_value);
      if (!Number.isFinite(v)) return;
      push(t.player_id, { testKey: t.test_type, date: t.test_date, value: v, unit: t.result_unit ?? null });
    });
    (bundle?.strength || []).forEach((t: any) => {
      const v = Number(t.weight_kg);
      if (!Number.isFinite(v) || !t.test_name) return;
      push(t.player_id, { testKey: `strength:${t.test_name}`, date: t.test_date, value: v, unit: "kg" });
    });
    (bundle?.speed || []).forEach((t: any) => {
      const v = t.vma_kmh ?? t.speed_kmh ?? t.time_40m_seconds;
      if (v == null || !Number.isFinite(Number(v))) return;
      push(t.player_id, {
        testKey: t.test_type || "speed",
        date: t.test_date,
        value: Number(v),
        unit: t.time_40m_seconds != null && t.vma_kmh == null && t.speed_kmh == null ? "s" : "km/h",
      });
    });
    Object.values(out).forEach((list) => list.sort((a, b) => a.date.localeCompare(b.date)));
    return out;
  }, [bundle?.generic, bundle?.strength, bundle?.speed]);

  const testOptions = useMemo<Athlete360TestOption[]>(() => {
    const map = new Map<string, Athlete360TestOption>();
    Object.values(allTests).forEach((list) =>
      list.forEach((r) => {
        if (map.has(r.testKey)) {
          const cur = map.get(r.testKey)!;
          if (!cur.unit && r.unit) cur.unit = r.unit;
          return;
        }
        map.set(r.testKey, {
          key: r.testKey,
          label: r.testKey.startsWith("strength:")
            ? r.testKey.slice("strength:".length)
            : labelizeTestType(r.testKey, customMap),
          unit: r.unit ?? customMap[r.testKey]?.unit ?? null,
        });
      }),
    );
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [allTests, customMap]);

  const rows = useMemo<Athlete360Row[]>(() => {
    if (!bundle) return [];
    const today = new Date().toISOString().slice(0, 10);

    const sessionDate = new Map<string, string>();
    const sessionType = new Map<string, string>();
    (bundle.sessions as any[]).forEach((s) => {
      sessionDate.set(s.id, s.session_date);
      sessionType.set(s.id, s.training_type);
    });
    const kindOf = (type?: string | null): "muscu" | "terrain" =>
      type === "musculation" ? "muscu" : "terrain";

    const attendanceKeys = new Set(
      (bundle.attendance as any[]).map(
        (a) => `${a.player_id}|${a.training_session_id || a.attendance_date}`,
      ),
    );

    type Kind = { att: number; tot: number };
    const epByPlayer = new Map<string, { muscu: Kind; terrain: Kind }>();
    (bundle.eventParticipants as any[]).forEach((p) => {
      const st = p.attendance_status;
      if (st !== "present" && st !== "absent") return;
      const date = sessionDate.get(p.training_session_id);
      if (!date || date > today) return;
      if (
        attendanceKeys.has(`${p.player_id}|${p.training_session_id}`) ||
        attendanceKeys.has(`${p.player_id}|${date}`)
      )
        return;
      const entry =
        epByPlayer.get(p.player_id) || { muscu: { att: 0, tot: 0 }, terrain: { att: 0, tot: 0 } };
      const bucket = kindOf(sessionType.get(p.training_session_id)) === "muscu" ? entry.muscu : entry.terrain;
      bucket.tot += 1;
      if (st === "present") bucket.att += 1;
      epByPlayer.set(p.player_id, entry);
    });

    return (players as any[]).map((p) => {
      const name =
        [p.name ? String(p.name).toUpperCase() : "", p.first_name || ""].filter(Boolean).join(" ").trim() ||
        "Athlète";

      // --- Assiduité app ---
      const w = (bundle.wellness as any[]).filter((r) => r.player_id === p.id);
      const wellnessDone = w.filter((r) => !r.auto_filled).length;
      const wellnessRate = w.length > 0 ? Math.round((wellnessDone / w.length) * 100) : null;

      const l = (bundle.loads as any[]).filter(
        (r) => r.player_id === p.id && r.training_session_id && r.session_date >= startDate && r.session_date <= endDate,
      );
      const rpeDone = l.filter((r) => !r.auto_filled && Number(r.rpe) > 0).length;
      const rpeRate = l.length > 0 ? Math.round((rpeDone / l.length) * 100) : null;
      const appParts = [wellnessRate, rpeRate].filter((v): v is number => v !== null);
      const appRate = appParts.length
        ? Math.round(appParts.reduce((a, b) => a + b, 0) / appParts.length)
        : null;

      // --- Présence entraînements ---
      const staff = (bundle.attendance as any[]).filter((a) => a.player_id === p.id);
      const kind = { muscu: { att: 0, tot: 0 }, terrain: { att: 0, tot: 0 } };
      staff.forEach((a) => {
        const bucket =
          kindOf(a.training_sessions?.training_type) === "muscu" ? kind.muscu : kind.terrain;
        bucket.tot += 1;
        if (a.status === "present" || a.status === "late") bucket.att += 1;
      });
      const ep = epByPlayer.get(p.id);
      if (ep) {
        kind.muscu.att += ep.muscu.att;
        kind.muscu.tot += ep.muscu.tot;
        kind.terrain.att += ep.terrain.att;
        kind.terrain.tot += ep.terrain.tot;
      }
      const trainingPresent = kind.muscu.att + kind.terrain.att;
      const trainingTotal = kind.muscu.tot + kind.terrain.tot;

      // --- Compétitions ---
      const mp = (bundle.matchParticipants as any[]).filter((m) => m.player_id === p.id);
      const matchCalled = mp.filter((m) => m.attendance_status === "present" || m.attendance_status === "absent").length;
      const matchPresent = mp.filter((m) => m.attendance_status === "present").length;

      // --- Charge ---
      const loadRows: LoadRow[] = (bundle.loads as any[])
        .filter((r) => r.player_id === p.id)
        .map((r) => ({
          session_date: r.session_date,
          rpe: r.rpe,
          duration_minutes: r.duration_minutes,
          training_load: r.training_load,
        }));
      const inPeriod = loadRows.filter((r) => r.session_date >= startDate && r.session_date <= endDate);
      const loadOf = (r: LoadRow) =>
        r.training_load != null && Number.isFinite(Number(r.training_load))
          ? Number(r.training_load)
          : (Number(r.rpe) || 0) * (Number(r.duration_minutes) || 0);
      const totalLoad = inPeriod.reduce((sum, r) => sum + loadOf(r), 0);
      const spanDays = Math.max(
        1,
        Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / DAY_MS) + 1,
      );
      const weeklyLoad = inPeriod.length ? Math.round((totalLoad / spanDays) * 7) : null;

      const endRef = new Date(endDate);
      const acute =
        loadRows
          .filter((r) => {
            const d = new Date(r.session_date).getTime();
            return d <= endRef.getTime() && d > endRef.getTime() - 7 * DAY_MS;
          })
          .reduce((s, r) => s + loadOf(r), 0) / 7;
      const chronic =
        loadRows
          .filter((r) => {
            const d = new Date(r.session_date).getTime();
            return d <= endRef.getTime() && d > endRef.getTime() - 28 * DAY_MS;
          })
          .reduce((s, r) => s + loadOf(r), 0) / 28;
      const acwrDetail = computeAcwrDetailed(loadRows, "rolling", endRef);

      // --- Blessures (épisodes chevauchant la période) ---
      const injuries = (bundle.injuries as any[]).filter((i) => {
        if (i.player_id !== p.id) return false;
        const start = String(i.injury_date).slice(0, 10);
        const end = String(i.actual_return_date || today).slice(0, 10);
        return start <= endDate && end >= startDate;
      });
      const injuryDays = injuries.reduce((sum, i) => {
        const s = new Date(Math.max(new Date(i.injury_date).getTime(), new Date(startDate).getTime()));
        const rawEnd = i.actual_return_date || today;
        const e = new Date(Math.min(new Date(rawEnd).getTime(), new Date(endDate).getTime()));
        return sum + Math.max(0, Math.round((e.getTime() - s.getTime()) / DAY_MS) + 1);
      }, 0);

      // --- Poids ---
      const weightSeries = (bundle.weightEntries as any[])
        .filter((e) => e.player_id === p.id && e.date >= startDate && e.date <= endDate)
        .map((e) => ({ date: e.date, weight: e.weight }));
      const weightFirst = weightSeries.length ? weightSeries[0].weight : null;
      const weightLast = weightSeries.length ? weightSeries[weightSeries.length - 1].weight : null;

      return {
        id: p.id,
        name,
        wellnessDone,
        wellnessTotal: w.length,
        wellnessRate,
        rpeDone,
        rpeTotal: l.length,
        rpeRate,
        appRate,
        trainingPresent,
        trainingTotal,
        trainingRate: trainingTotal > 0 ? Math.round((trainingPresent / trainingTotal) * 100) : null,
        muscuPresent: kind.muscu.att,
        muscuTotal: kind.muscu.tot,
        muscuRate: kind.muscu.tot > 0 ? Math.round((kind.muscu.att / kind.muscu.tot) * 100) : null,
        terrainPresent: kind.terrain.att,
        terrainTotal: kind.terrain.tot,
        terrainRate: kind.terrain.tot > 0 ? Math.round((kind.terrain.att / kind.terrain.tot) * 100) : null,
        matchPresent,
        matchCalled,
        matchRate: matchCalled > 0 ? Math.round((matchPresent / matchCalled) * 100) : null,
        totalLoad: Math.round(totalLoad),
        weeklyLoad,
        acuteLoad: acute > 0 ? Math.round(acute) : null,
        chronicLoad: chronic > 0 ? Math.round(chronic) : null,
        acwr: acwrDetail.acwr,
        acwrInsufficient: acwrDetail.insufficientHistory,
        loadSessions: inPeriod.length,
        injuryCount: injuries.length,
        injuryDays,
        injuryActive: injuries.some((i) => i.status === "active" || i.status === "recovering"),
        injuryTypes: Array.from(new Set(injuries.map((i) => i.injury_type).filter(Boolean))),
        weightFirst,
        weightLast,
        weightDelta:
          weightFirst != null && weightLast != null ? Number((weightLast - weightFirst).toFixed(1)) : null,
        weightSeries,
        tests: allTests[p.id] || [],
      };
    });
  }, [bundle, players, startDate, endDate, allTests]);

  return { players, rows, testOptions, isLoading };
}
