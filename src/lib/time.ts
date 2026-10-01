// Times are stored as UTC timestamptz and shown in profiles.timezone (AGENTS.md §5)

export const DEFAULT_TZ = "America/Santiago";

function parts(date: Date, tz: string) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), mi: get("minute"), s: get("second") };
}

/** yyyy-mm-dd of `date` in the given timezone */
export function localDateKey(date: Date, tz = DEFAULT_TZ) {
  const { y, m, d } = parts(date, tz);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** UTC instant for a wall-clock time (HH:MM) on a local date (yyyy-mm-dd) in tz */
export function zonedTime(dateKey: string, hhmm: string, tz = DEFAULT_TZ) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const p = parts(new Date(guess), tz);
  const offset = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - guess;
  return new Date(guess - offset);
}

export function formatTime(date: Date | string, tz = DEFAULT_TZ) {
  return new Intl.DateTimeFormat("es-CL", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    new Date(date),
  );
}

export function formatLongDate(date: Date, tz = DEFAULT_TZ) {
  const s = new Intl.DateTimeFormat("es-CL", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(date);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function weekdayShort(date: Date, tz = DEFAULT_TZ) {
  const s = new Intl.DateTimeFormat("es-CL", { timeZone: tz, weekday: "short" }).format(date).replace(".", "");
  return s.charAt(0).toUpperCase() + s.slice(1, 3);
}

function weekdayLong(date: Date, tz: string) {
  const w = new Intl.DateTimeFormat("es-CL", { timeZone: tz, weekday: "long" }).format(date);
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/** "Hoy", "Ayer" or the weekday name */
export function dayLabel(date: Date | string, tz = DEFAULT_TZ, now = new Date()) {
  const dt = new Date(date);
  const key = localDateKey(dt, tz);
  if (key === localDateKey(now, tz)) return "Hoy";
  if (key === localDateKey(new Date(now.getTime() - 86_400_000), tz)) return "Ayer";
  return weekdayLong(dt, tz);
}

/** "Hoy 13:11", "Ayer 21:30" or "Martes 14:20" */
export function formatDayTime(date: Date | string, tz = DEFAULT_TZ, now = new Date()) {
  return `${dayLabel(date, tz, now)} ${formatTime(date, tz)}`;
}

/** "hace 1 minuto", "hace 12 min", "hace 3 horas" */
export function timeAgo(date: Date | string, now = new Date()) {
  const min = Math.max(0, Math.round((now.getTime() - new Date(date).getTime()) / 60_000));
  if (min < 1) return "recién";
  if (min === 1) return "hace 1 minuto";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return h === 1 ? "hace 1 hora" : `hace ${h} horas`;
  const d = Math.round(h / 24);
  return d === 1 ? "hace 1 día" : `hace ${d} días`;
}

export function greeting(date: Date, tz = DEFAULT_TZ) {
  const { h } = parts(date, tz);
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

export function ageFrom(birthDate: string | null | undefined, now = new Date()) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

export function firstName(fullName: string | null | undefined) {
  return (fullName ?? "").trim().split(/\s+/)[0] || "";
}

export function initials(name: string | null | undefined) {
  return (name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
