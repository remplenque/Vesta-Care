import type { Alert, Medication, Reading } from "./data";
import { MISSED_AFTER_MIN, scheduleTimes } from "./pillbox";
import { DEFAULT_TZ, localDateKey, zonedTime } from "./time";

// Calendar of the person's activities, built only from what already exists: the medication
// schedule, the pillbox readings (taken / missed) and the alerts. Days are "yyyy-mm-dd" keys in
// the person's timezone; weeks start on Monday (Chile).

export type DoseState = "taken" | "missed" | "pending" | "later" | "unknown";
export type DayStatus = "ok" | "warn" | "crit" | "none" | "future";

export type CalDose = { key: string; time: string; at: Date; medication: Medication; state: DoseState; takenAt?: string };

export type CalDay = {
  key: string;
  date: Date; // noon of that day, for formatting
  doses: CalDose[];
  alerts: Alert[];
  isToday: boolean;
  isFuture: boolean;
  status: DayStatus;
};

// ---------------------------------------------------------------- Day keys

function parseKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return { y, m, d };
}

function fmtKey(t: number) {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function shiftDay(key: string, days: number) {
  const { y, m, d } = parseKey(key);
  return fmtKey(Date.UTC(y, m - 1, d + days));
}

export function shiftMonth(key: string, months: number) {
  const { y, m } = parseKey(key);
  return fmtKey(Date.UTC(y, m - 1 + months, 1));
}

/** Monday of the week that contains `key` */
export function weekStart(key: string) {
  const { y, m, d } = parseKey(key);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return shiftDay(key, -((dow + 6) % 7));
}

export function monthStart(key: string) {
  const { y, m } = parseKey(key);
  return fmtKey(Date.UTC(y, m - 1, 1));
}

export function sameMonth(a: string, b: string) {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function daysFrom(start: string, count: number) {
  return Array.from({ length: count }, (_, i) => shiftDay(start, i));
}

/** Monday-start weeks covering the whole month of `key` (4 to 6 weeks of 7 days) */
export function monthWeeks(key: string): string[][] {
  const first = monthStart(key);
  const weeks: string[][] = [];
  for (let w = weekStart(first); sameMonth(w, first) || w < first; w = shiftDay(w, 7)) weeks.push(daysFrom(w, 7));
  return weeks;
}

/** UTC instants that bound the local days [first, last] */
export function dayRange(first: string, last: string, tz = DEFAULT_TZ) {
  return { from: zonedTime(first, "00:00", tz), to: zonedTime(shiftDay(last, 1), "00:00", tz) };
}

export function dayDate(key: string, tz = DEFAULT_TZ) {
  return zonedTime(key, "12:00", tz);
}

// ---------------------------------------------------------------- Labels

const fmt = (opts: Intl.DateTimeFormatOptions, tz: string) => new Intl.DateTimeFormat("es-CL", { timeZone: tz, ...opts });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "29 sep" */
export function shortDate(key: string, tz = DEFAULT_TZ) {
  return fmt({ day: "numeric", month: "short" }, tz).format(dayDate(key, tz)).replace(".", "");
}

/** "Lunes 29 de septiembre" */
export function longDay(key: string, tz = DEFAULT_TZ) {
  return cap(fmt({ weekday: "long", day: "numeric", month: "long" }, tz).format(dayDate(key, tz)));
}

/** "Octubre de 2026" */
export function monthLabel(key: string, tz = DEFAULT_TZ) {
  return cap(fmt({ month: "long", year: "numeric" }, tz).format(dayDate(key, tz)));
}

// ---------------------------------------------------------------- Days

type DoseMeta = { medication_id?: string; scheduled_for?: string };

/** One entry per day with its doses (scheduled → taken / missed / pending) and alerts */
export function buildDays(
  keys: string[],
  meds: Medication[],
  pillbox: Pick<Reading, "metric" | "metadata" | "ts">[],
  alerts: Alert[],
  tz = DEFAULT_TZ,
  now = new Date(),
): CalDay[] {
  const today = localDateKey(now, tz);
  const metaOf = (r: Pick<Reading, "metadata">) => (r.metadata ?? {}) as DoseMeta;
  const pillboxDays = new Set(pillbox.map((r) => localDateKey(new Date(metaOf(r).scheduled_for ?? r.ts), tz)));

  return keys.map((key) => {
    const isToday = key === today;
    const isFuture = key > today;
    const hasData = pillboxDays.has(key) || isToday;

    const doses: CalDose[] = [];
    for (const med of meds) {
      for (const time of scheduleTimes(med)) {
        const at = zonedTime(key, time, tz);
        const match = (metric: string) =>
          pillbox.find((r) => {
            const m = metaOf(r);
            return r.metric === metric && m.medication_id === med.id && !!m.scheduled_for && Math.abs(Date.parse(m.scheduled_for) - at.getTime()) < 60_000;
          });
        const taken = match("dose_taken");
        const mins = (now.getTime() - at.getTime()) / 60_000;
        let state: DoseState;
        if (taken) state = "taken";
        else if (mins < 0) state = "later";
        else if (match("dose_missed")) state = "missed";
        else if (mins > MISSED_AFTER_MIN) state = hasData ? "missed" : "unknown";
        else state = "pending";
        doses.push({ key: `${med.id}-${time}`, time, at, medication: med, state, takenAt: taken?.ts });
      }
    }
    doses.sort((a, b) => a.at.getTime() - b.at.getTime() || a.medication.name.localeCompare(b.medication.name));

    const dayAlerts = alerts.filter((a) => localDateKey(new Date(a.ts), tz) === key);
    let status: DayStatus;
    if (isFuture) status = "future";
    else if (dayAlerts.some((a) => a.level === "critical")) status = "crit";
    else if (dayAlerts.length || doses.some((d) => d.state === "missed")) status = "warn";
    else if (doses.some((d) => d.state === "taken")) status = "ok";
    else status = "none";

    return { key, date: dayDate(key, tz), doses, alerts: dayAlerts, isToday, isFuture, status };
  });
}

/** "3 de 4 remedios" (so far) or "4 remedios programados" */
export function dosesSummary(day: CalDay) {
  if (!day.doses.length) return "Sin remedios";
  if (day.isFuture) return `${day.doses.length} remedio${day.doses.length > 1 ? "s" : ""} programado${day.doses.length > 1 ? "s" : ""}`;
  const due = day.doses.filter((d) => d.state !== "later" && d.state !== "unknown");
  if (!due.length) return day.doses.every((d) => d.state === "unknown") ? "Sin registro de remedios" : "Remedios más tarde";
  const taken = due.filter((d) => d.state === "taken").length;
  return `${taken} de ${due.length} remedios`;
}
