import type { Medication, Reading } from "./data";
import type { SimProfile } from "./personas";
import { MISSED_AFTER_MIN, scheduleTimes } from "./pillbox";
import { localDateKey, zonedTime } from "./time";

// Device simulator (AGENTS.md §3.7: every reading is declared with source = 'simulator').
// It only produces values. Whether a value becomes an alert, and at which level, is decided by
// the SQL rules engine on insert (AGENTS.md §3.1), never here.

/** How often the /demo panel asks /api/demo/simulate for a new tick */
export const TICK_MS = 20_000;
/** Chance per tick that the unstable profile has an out-of-range episode (≈ one every 2–3 min) */
export const EPISODE_CHANCE = 0.15;
/** Dose slots older than this are left alone: reset_demo already seeded them */
const PILLBOX_LOOKBACK_MS = 3 * 3_600_000;

export type ReadingSpec =
  | { kind: "bp"; systolic: number; diastolic: number; episode?: string }
  | {
      kind: "reading";
      moduleId: string;
      metric: string;
      value: number;
      unit: string;
      ts?: string;
      metadata?: Record<string, string | number>;
      episode?: string;
    };

export type TickContext = {
  profile: SimProfile;
  /** Enabled and confirmed modules of the user */
  modules: string[];
  /** Epoch ms of the last reading per module */
  lastTs: Record<string, number | undefined>;
  medications: Medication[];
  /** Pillbox readings of the last few hours */
  pillbox: Pick<Reading, "metric" | "metadata">[];
  tz: string;
  now: Date;
  random?: () => number;
};

type Range = [number, number];
type Rand = (range: Range) => number;
type VitalRanges = { bp: { sys: Range; dia: Range }; glucose: Range; heart_rate: Range };

// Inside the default thresholds (bp 90–140 / 60–90, glucose 80–180, bpm 55–100)
const STABLE: VitalRanges = { bp: { sys: [116, 132], dia: [70, 82] }, glucose: [95, 140], heart_rate: [62, 82] };
// Near the upper limits: an occasional value crosses into "warn" on its own
const UNSTABLE: VitalRanges = { bp: { sys: [128, 144], dia: [78, 89] }, glucose: [85, 178], heart_rate: [70, 99] };

type VitalGenerator = { everyMs: number; make: (rand: Rand, r: VitalRanges) => ReadingSpec };

// One generator per vital module (AGENTS.md §3.9: a new module = manifest + generator here).
// Cadences are compressed for the demo; the manifests describe the real ones.
export const VITAL_GENERATORS: Record<string, VitalGenerator> = {
  heart_rate: {
    everyMs: TICK_MS,
    make: (rand, r) => ({ kind: "reading", moduleId: "heart_rate", metric: "bpm", value: rand(r.heart_rate), unit: "lpm" }),
  },
  glucose: {
    everyMs: 2 * TICK_MS,
    make: (rand, r) => ({ kind: "reading", moduleId: "glucose", metric: "mg_dl", value: rand(r.glucose), unit: "mg/dL" }),
  },
  bp: {
    everyMs: 6 * TICK_MS,
    make: (rand, r) => ({ kind: "bp", systolic: rand(r.bp.sys), diastolic: rand(r.bp.dia) }),
  },
};

type Episode = { name: string; moduleId: string; make: (rand: Rand) => ReadingSpec };

const vital = (moduleId: string, metric: string, unit: string, range: Range, name: string): Episode => ({
  name,
  moduleId,
  make: (rand) => ({ kind: "reading", moduleId, metric, value: rand(range), unit, episode: name }),
});

/** Out-of-range episodes of the unstable profile */
export const EPISODES: Episode[] = [
  { name: "Crisis de presión", moduleId: "bp", make: (rand) => ({ kind: "bp", systolic: rand([182, 192]), diastolic: rand([110, 118]), episode: "Crisis de presión" }) },
  { name: "Presión alta", moduleId: "bp", make: (rand) => ({ kind: "bp", systolic: rand([148, 156]), diastolic: rand([92, 97]), episode: "Presión alta" }) },
  vital("heart_rate", "bpm", "lpm", [132, 145], "Taquicardia"),
  vital("heart_rate", "bpm", "lpm", [40, 44], "Bradicardia"),
  vital("glucose", "mg_dl", "mg/dL", [58, 66], "Hipoglucemia"),
  vital("glucose", "mg_dl", "mg/dL", [196, 215], "Glucosa alta"),
];

/** Readings to ingest for one user on this tick */
export function generateTick(ctx: TickContext): ReadingSpec[] {
  const random = ctx.random ?? Math.random;
  const rand: Rand = ([lo, hi]) => Math.round(lo + random() * (hi - lo));
  const ranges = ctx.profile === "unstable" ? UNSTABLE : STABLE;
  const now = ctx.now.getTime();

  const specs: ReadingSpec[] = [];
  for (const moduleId of ctx.modules) {
    const gen = VITAL_GENERATORS[moduleId];
    if (!gen) continue;
    const last = ctx.lastTs[moduleId];
    // A quarter tick of slack absorbs timer and network jitter
    if (last === undefined || now - last >= gen.everyMs - TICK_MS / 4) specs.push(gen.make(rand, ranges));
  }

  if (ctx.profile === "unstable" && random() < EPISODE_CHANCE) {
    const options = EPISODES.filter((e) => ctx.modules.includes(e.moduleId));
    if (options.length) {
      const ep = options[Math.floor(random() * options.length)];
      const i = specs.findIndex((s) => specModule(s) === ep.moduleId);
      if (i >= 0) specs.splice(i, 1);
      specs.push(ep.make(rand));
    }
  }

  if (ctx.modules.includes("pillbox")) specs.push(...pillboxSpecs(ctx));
  return specs;
}

type DoseMeta = { medication_id?: string; scheduled_for?: string };

/** Today's dose events in real time: stable takes each dose 3–15 min late, unstable forgets it */
function pillboxSpecs(ctx: TickContext): ReadingSpec[] {
  const out: ReadingSpec[] = [];
  const today = localDateKey(ctx.now, ctx.tz);
  const now = ctx.now.getTime();

  for (const med of ctx.medications) {
    for (const time of scheduleTimes(med)) {
      const at = zonedTime(today, time, ctx.tz).getTime();
      const ago = now - at;
      if (ago < 0 || ago > PILLBOX_LOOKBACK_MS) continue;

      const has = (metric: string) =>
        ctx.pillbox.some((r) => {
          const m = (r.metadata ?? {}) as DoseMeta;
          return r.metric === metric && m.medication_id === med.id && !!m.scheduled_for && Math.abs(Date.parse(m.scheduled_for) - at) < 60_000;
        });
      const metadata = { medication_id: med.id, scheduled_for: new Date(at).toISOString() };
      const dose = (metric: string, extra: Partial<Extract<ReadingSpec, { kind: "reading" }>> = {}): ReadingSpec => ({
        kind: "reading",
        moduleId: "pillbox",
        metric,
        value: 1,
        unit: "dosis",
        metadata,
        ...extra,
      });

      if (!has("dose_scheduled")) out.push(dose("dose_scheduled", { ts: metadata.scheduled_for }));
      if (has("dose_taken") || has("dose_missed")) continue;

      if (ctx.profile === "unstable") {
        if (ago > MISSED_AFTER_MIN * 60_000) out.push(dose("dose_missed", { episode: "Dosis omitida" }));
      } else {
        const delayMin = 3 + (hash(`${med.id}${time}${today}`) % 13);
        if (ago >= delayMin * 60_000) {
          out.push(dose("dose_taken", { ts: new Date(at + delayMin * 60_000).toISOString(), metadata: { ...metadata, delay_min: delayMin } }));
        }
      }
    }
  }
  return out;
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function specModule(s: ReadingSpec) {
  return s.kind === "bp" ? "bp" : s.moduleId;
}

/** "bp 128/80", "glucose 112 mg/dL", "pillbox dose_taken" — for the panel's event log */
export function describeSpec(s: ReadingSpec) {
  if (s.kind === "bp") return `bp ${s.systolic}/${s.diastolic}`;
  if (s.moduleId === "pillbox") return `pillbox ${s.metric}`;
  return `${s.moduleId} ${s.value} ${s.unit}`;
}
