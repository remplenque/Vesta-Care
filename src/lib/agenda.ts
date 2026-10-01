import { DEFAULT_TZ, localDateKey } from "./time";

// DEMO AGENDA — synthetic activities of the demo person (AGENTS.md §3.5, §3.7: fictional and
// declared). There is no events table yet (adding one is a migration: docs/OPEN-ISSUES.md), so for
// the demo the agenda lives here, with dates computed from "today" so it is always upcoming.
// Only the demo account (NEXT_PUBLIC_DEMO_USER_ID) gets it. Read by the Calendario screen and by
// Mateo's context, so the person can ask "¿qué tengo mañana?" or "¿cuándo es el café con Rosa?".

export type AgendaKind = "social" | "salud" | "familia" | "tramite" | "actividad";

export type AgendaEvent = {
  id: string;
  day: string; // "yyyy-mm-dd" in the person's timezone
  time: string; // "16:30"
  title: string;
  place: string | null;
  kind: AgendaKind;
  note: string | null;
};

export const AGENDA_ICON: Record<AgendaKind, string> = {
  social: "local_cafe",
  salud: "stethoscope",
  familia: "family_restroom",
  tramite: "receipt_long",
  actividad: "directions_walk",
};

// [days from today, time, title, place, kind, note]
const DEMO: [number, string, string, string | null, AgendaKind, string | null][] = [
  [0, "17:30", "Once con la vecina Carmen", "Casa de Carmen, depto 402", "social", "Llevar el queque de naranja"],
  [1, "10:30", "Control de presión con la Dra. Pérez", "CESFAM Providencia, box 7", "salud", "Llevar el carnet y la libreta de presión"],
  [1, "16:00", "Taller de memoria", "Centro comunitario (BondUP)", "actividad", null],
  [2, "11:00", "Café con los amigos del barrio", "Café Colonia, Av. Providencia 1980", "social", "Le toca invitar a don Héctor"],
  [3, "12:00", "Retirar remedios en la farmacia", "Farmacia del consultorio", "tramite", "Losartán y Metformina del mes"],
  [4, "13:00", "Almuerzo con Andrés y los nietos", "En casa", "familia", "Andrés trae empanadas"],
  [5, "09:30", "Ir a la feria", "Feria de calle Santa Isabel", "tramite", null],
  [6, "09:00", "Caminata en grupo por el parque", "Parque Inés de Suárez (BondUP)", "actividad", "Llevar agua y gorro"],
  [6, "18:00", "Cumpleaños de la nieta Sofía", "Casa de Andrés", "familia", "Cumple 8 años"],
  [8, "08:00", "Exámenes de sangre", "Laboratorio del CESFAM", "salud", "Ir en ayunas"],
  [9, "17:00", "Bingo solidario de la junta de vecinos", "Sede vecinal", "social", null],
];

function shift(key: string, days: number) {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

/** The demo person's agenda from today on (empty for any other account) */
export function agendaFor(userId: string | null | undefined, tz = DEFAULT_TZ, now = new Date()): AgendaEvent[] {
  if (!userId || userId !== process.env.NEXT_PUBLIC_DEMO_USER_ID) return [];
  const today = localDateKey(now, tz);
  return DEMO.map(([days, time, title, place, kind, note], i) => ({ id: `demo-${i}`, day: shift(today, days), time, title, place, kind, note }));
}

export function eventsOn(events: AgendaEvent[], day: string) {
  return events.filter((e) => e.day === day).sort((a, b) => a.time.localeCompare(b.time));
}
