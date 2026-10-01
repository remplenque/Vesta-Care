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

// ---------------------------------------------------------------- Activities on offer
// DEMO: activities that partner organisations for older adults publish (Vesta would receive them
// from those partners). The person hears about them from Mateo or sees them in the Calendario, and
// signs up with one tap or by saying yes. Synthetic and declared ("Actividades de demostración").

export type Offer = {
  id: string;
  day: string;
  time: string;
  title: string;
  place: string;
  provider: string;
  price: string;
  spots: number;
  kind: AgendaKind;
};

// [id, days from today, time, title, place, provider, price, spots left, kind]
const OFFERS: [string, number, string, string, string, string, string, number, AgendaKind][] = [
  ["tango", 1, "18:00", "Clase de tango para principiantes", "Centro cultural del barrio", "BondUP", "Gratis", 6, "actividad"],
  ["yoga-silla", 2, "10:00", "Yoga en silla", "Sede del Club del Adulto Mayor", "Club del Adulto Mayor", "Gratis", 4, "actividad"],
  ["celular", 3, "15:30", "Taller: WhatsApp y videollamadas", "Biblioteca municipal", "Programa municipal Adulto Mayor", "Gratis", 10, "actividad"],
  ["coro", 4, "17:00", "Ensayo abierto del coro", "Parroquia del barrio", "Club del Adulto Mayor", "Gratis", 8, "social"],
  ["paseo", 5, "08:30", "Paseo de día a la costa", "Sale desde la plaza principal", "Programa municipal Adulto Mayor", "$5.000", 3, "social"],
  ["cine", 7, "16:00", "Cine con descuento: matiné", "Centro cultural del barrio", "BondUP", "$2.000", 12, "social"],
  ["nutricion", 8, "11:00", "Charla: comer rico y sano", "CESFAM, sala de reuniones", "CESFAM", "Gratis", 15, "salud"],
];

/** Activities on offer from today on (demo account only) */
export function offersFor(userId: string | null | undefined, tz = DEFAULT_TZ, now = new Date()): Offer[] {
  if (!userId || userId !== process.env.NEXT_PUBLIC_DEMO_USER_ID) return [];
  const today = localDateKey(now, tz);
  return OFFERS.map(([id, days, time, title, place, provider, price, spots, kind]) => ({ id, day: shift(today, days), time, title, place, provider, price, spots, kind }));
}

// Sign-ups are kept on the device for now (no events table yet: docs/OPEN-ISSUES.md). The chat
// sends them to /api/mateo so Mateo knows them too.
const SIGNUPS_KEY = "vesta.signups";

export function readSignups(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SIGNUPS_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function setSignup(offerId: string, on: boolean) {
  const next = new Set(readSignups());
  if (on) next.add(offerId);
  else next.delete(offerId);
  try {
    localStorage.setItem(SIGNUPS_KEY, JSON.stringify([...next]));
    window.dispatchEvent(new Event("vesta-signups"));
  } catch {}
  return [...next];
}

/** The demo person's agenda from today on, plus the activities they signed up for */
export function agendaFor(userId: string | null | undefined, tz = DEFAULT_TZ, now = new Date(), signups: string[] = []): AgendaEvent[] {
  if (!userId || userId !== process.env.NEXT_PUBLIC_DEMO_USER_ID) return [];
  const today = localDateKey(now, tz);
  const own = DEMO.map(([days, time, title, place, kind, note], i) => ({ id: `demo-${i}`, day: shift(today, days), time, title, place, kind, note }));
  const joined = offersFor(userId, tz, now)
    .filter((o) => signups.includes(o.id))
    .map((o) => ({ id: `offer-${o.id}`, day: o.day, time: o.time, title: o.title, place: o.place, kind: o.kind, note: `Inscripción confirmada · ${o.provider} · ${o.price}` }));
  return [...own, ...joined];
}

export function eventsOn(events: AgendaEvent[], day: string) {
  return events.filter((e) => e.day === day).sort((a, b) => a.time.localeCompare(b.time));
}
