// Mirror of public.evaluate_level (supabase/migrations/*_02_rules_engine.sql) used ONLY to paint
// status on screen. Alerts are created by the SQL rules engine, never here (AGENTS.md §3.1).

export type Level = "ok" | "warn" | "critical";

export type MetricThreshold = { normal: [number, number]; margin?: number };
export type Thresholds = Record<string, MetricThreshold>;

export function evaluateLevel(value: number, t?: MetricThreshold | null): Level {
  if (!t?.normal) return "ok";
  const [min, max] = t.normal;
  const margin = t.margin ?? 0;
  if (value >= min && value <= max) return "ok";
  const dist = value < min ? min - value : value - max;
  return dist <= margin ? "warn" : "critical";
}

const RANK: Record<Level, number> = { ok: 0, warn: 1, critical: 2 };

export function worstLevel(levels: Level[]): Level {
  return levels.reduce<Level>((acc, l) => (RANK[l] > RANK[acc] ? l : acc), "ok");
}

export function asThresholds(json: unknown): Thresholds {
  return json && typeof json === "object" && !Array.isArray(json) ? (json as Thresholds) : {};
}
