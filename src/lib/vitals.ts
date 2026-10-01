import { manifestOf, type CareData, type Reading } from "./data";
import { moduleUi } from "./modules";
import { asThresholds, evaluateLevel, worstLevel, type Level, type Thresholds } from "./rules";
import { localDateKey, weekdayShort, DEFAULT_TZ } from "./time";

/** Thresholds in force: the user's (confirmed from the ficha) or the module defaults */
export function thresholdsFor(moduleId: string, data: Pick<CareData, "userModules" | "modules">): Thresholds {
  const um = data.userModules.find((u) => u.module_id === moduleId);
  const own = asThresholds(um?.thresholds);
  if (Object.keys(own).length) return own;
  return asThresholds(manifestOf(data.modules.find((m) => m.id === moduleId))?.defaultThresholds);
}

export type VitalReading = {
  ts: string;
  text: string; // "134/84" or "118"
  primary: number; // value plotted (systolic for bp)
  level: Level;
  source: string;
};

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Groups bp readings into systolic/diastolic pairs; other modules map 1:1 */
export function vitalSeries(moduleId: string, readings: Reading[], t: Thresholds): VitalReading[] {
  const ui = moduleUi(moduleId);
  const own = readings.filter((r) => r.module_id === moduleId);

  if (moduleId === "bp") {
    const groups = new Map<string, { sys?: Reading; dia?: Reading }>();
    for (const r of own) {
      const key = r.reading_group ?? r.ts;
      const g = groups.get(key) ?? {};
      if (r.metric === "systolic") g.sys = r;
      if (r.metric === "diastolic") g.dia = r;
      groups.set(key, g);
    }
    return [...groups.values()]
      .filter((g) => g.sys)
      .map((g) => {
        const sys = Number(g.sys!.value);
        const dia = g.dia ? Number(g.dia.value) : null;
        const levels = [evaluateLevel(sys, t.systolic)];
        if (dia != null) levels.push(evaluateLevel(dia, t.diastolic));
        return {
          ts: g.sys!.ts,
          text: dia != null ? `${fmt(sys)}/${fmt(dia)}` : fmt(sys),
          primary: sys,
          level: worstLevel(levels),
          source: g.sys!.source,
        };
      })
      .sort((a, b) => a.ts.localeCompare(b.ts));
  }

  const metric = ui.primaryMetric;
  return own
    .filter((r) => r.metric === metric)
    .map((r) => {
      const v = Number(r.value);
      return { ts: r.ts, text: fmt(v), primary: v, level: evaluateLevel(v, metric ? t[metric] : undefined), source: r.source };
    });
}

export type Trend = { icon: string; text: string };

export function trendOf(series: VitalReading[], t: Thresholds, moduleId: string): Trend {
  const last = series.at(-1);
  if (!last) return { icon: "help", text: "Sin lecturas" };
  const primary = moduleUi(moduleId).primaryMetric ?? "";
  const normal = t[primary]?.normal;
  if (last.level === "critical" && normal) {
    return last.primary < normal[0] ? { icon: "arrow_downward", text: "Muy baja" } : { icon: "arrow_upward", text: "Muy alta" };
  }
  const prev = series.slice(-7, -1);
  if (!prev.length) return { icon: "trending_flat", text: "Estable" };
  const avg = prev.reduce((s, r) => s + r.primary, 0) / prev.length;
  const diff = (last.primary - avg) / avg;
  if (diff > 0.06) return { icon: "trending_up", text: "Subiendo" };
  if (diff < -0.06) return { icon: "trending_down", text: "Bajando" };
  return { icon: "trending_flat", text: "Estable" };
}

export type DayPoint = { key: string; day: string; value: number | null; text: string; out: boolean; isToday: boolean };

/** One point per local day (last reading of the day) for the last `days` days */
export function dailyPoints(series: VitalReading[], tz = DEFAULT_TZ, days = 7, now = new Date()): DayPoint[] {
  const byDay = new Map<string, VitalReading>();
  for (const r of series) byDay.set(localDateKey(new Date(r.ts), tz), r);
  const out: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    const key = localDateKey(d, tz);
    const r = byDay.get(key);
    out.push({
      key,
      day: i === 0 ? "Hoy" : weekdayShort(d, tz),
      value: r ? r.primary : null,
      text: r ? String(Math.round(r.primary)) : "—",
      out: r ? r.level !== "ok" : false,
      isToday: i === 0,
    });
  }
  return out;
}

/** Days (of the last `days`) where every reading was in range */
export function daysInRange(series: VitalReading[], tz = DEFAULT_TZ, days = 7, now = new Date()) {
  const keys = new Set<string>();
  for (let i = 0; i < days; i++) keys.add(localDateKey(new Date(now.getTime() - i * 86_400_000), tz));
  const byDay = new Map<string, boolean>();
  for (const r of series) {
    const k = localDateKey(new Date(r.ts), tz);
    if (!keys.has(k)) continue;
    byDay.set(k, (byDay.get(k) ?? true) && r.level === "ok");
  }
  return { ok: [...byDay.values()].filter(Boolean).length, total: byDay.size };
}

/** "bajo 140/90" style goal text built from the thresholds in force */
export function rangeLabel(moduleId: string, t: Thresholds) {
  if (moduleId === "bp" && t.systolic && t.diastolic) return `Su objetivo: bajo ${t.systolic.normal[1]}/${t.diastolic.normal[1]}`;
  if (moduleId === "glucose" && t.mg_dl) return `Su objetivo: entre ${t.mg_dl.normal[0]} y ${t.mg_dl.normal[1]}`;
  if (moduleId === "heart_rate" && t.bpm) return `En reposo: entre ${t.bpm.normal[0]} y ${t.bpm.normal[1]}`;
  return "";
}

/** Position (%) of a value on the module scale, clamped so the marker stays visible */
export function scalePos(value: number, [lo, hi]: [number, number]) {
  return Math.max(3, Math.min(97, ((value - lo) / (hi - lo)) * 100));
}
