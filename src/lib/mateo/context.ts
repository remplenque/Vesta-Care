import type { CareData } from "@/lib/data";
import { moduleUi, sortModules, VITAL_MODULES } from "@/lib/modules";
import { medLabel, scheduleTimes, todaySlots, type DoseStatus } from "@/lib/pillbox";
import type { Level } from "@/lib/rules";
import { agendaFor } from "@/lib/agenda";
import { DEFAULT_TZ, firstName, formatDayTime, formatTime, localDateKey } from "@/lib/time";
import { daysInRange, rangeLabel, thresholdsFor, vitalSeries } from "@/lib/vitals";

/** "hoy", "mañana", "pasado mañana" or "el lunes 5 de octubre" */
function spokenDay(day: string, today: string, tz: string) {
  const at = new Date(`${day}T12:00:00Z`);
  const diff = Math.round((at.getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86_400_000);
  if (diff === 0) return "hoy";
  if (diff === 1) return "mañana";
  if (diff === 2) return "pasado mañana";
  return `el ${new Intl.DateTimeFormat("es-CL", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(at)}`;
}

/** Stable id of one dose of today: "<medication id>|08:00" */
export const slotRef = (medicationId: string, time: string) => `${medicationId}|${time}`;

// Read-only summary of the person's day for the model. Built in code, never the raw tables:
// the model words things, it does not compute or decide (AGENTS.md §3.1).

const LEVEL_WORDS: Record<Level, string> = { ok: "en rango", warn: "atención", critical: "alerta" };
const DOSE_WORDS: Record<DoseStatus, string> = {
  taken: "registrada",
  due: "le toca ahora",
  missed: "no quedó registrada",
  later: "más tarde",
};

export function mateoContext(data: CareData | null, now = new Date()) {
  const tz = data?.profile?.timezone ?? DEFAULT_TZ;
  const today = localDateKey(now, tz);
  const name = firstName(data?.profile?.full_name);
  const contact = data?.contacts.find((c) => c.phone) ?? data?.contacts[0];

  const enabled = new Set((data?.userModules ?? []).filter((u) => u.enabled).map((u) => u.module_id));
  const vitals = sortModules(
    VITAL_MODULES.filter((id) => enabled.has(id)),
    (id) => id,
  ).map((id) => {
    const series = vitalSeries(id, data!.readings, thresholdsFor(id, data!));
    const last = series.at(-1);
    const isToday = last ? localDateKey(new Date(last.ts), tz) === today : false;
    return {
      modulo: moduleUi(id).name,
      ultima: last ? `${last.text} ${moduleUi(id).unit ?? ""}`.trim() : "sin lecturas",
      hora: last ? formatTime(last.ts, tz) : null,
      de_hoy: isToday,
      estado: last ? LEVEL_WORDS[last.level] : "sin datos",
    };
  });

  // "ref" lets the model point at one dose when the person says they took it (or didn't): the
  // app confirms with the person and then writes it, never the model (AGENTS.md §3.8)
  const remedios = todaySlots(data?.medications ?? [], data?.readings ?? [], tz, now).map((s) => ({
    ref: slotRef(s.medication.id, s.time),
    remedio: medLabel(s.medication),
    hora: s.time,
    estado: DOSE_WORDS[s.status],
  }));
  const guardados = (data?.medications ?? []).map((m) => ({ nombre: m.name, dosis: m.dose, horas: scheduleTimes(m) }));

  const alertas = (data?.alerts ?? [])
    .filter((a) => a.status === "open")
    .slice(0, 3)
    .map((a) => ({
      modulo: moduleUi(a.module_id).name,
      nivel: a.level === "critical" ? "alerta" : "atención",
      mensaje: a.message,
      hora: formatTime(a.ts, tz),
    }));

  const objetivos = (data?.goals ?? []).slice(0, 4).map((g) => g.description);

  // Last 7 days of each vital, summarised in code (the model words it, it doesn't compute it)
  const weekAgo = now.getTime() - 7 * 86_400_000;
  const semana = VITAL_MODULES.filter((id) => enabled.has(id)).map((id) => {
    const series = vitalSeries(id, data!.readings, thresholdsFor(id, data!)).filter((r) => new Date(r.ts).getTime() >= weekAgo);
    const values = series.map((r) => r.primary);
    const days = daysInRange(series, tz, 7, now);
    const avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
    const lo = series.reduce<(typeof series)[number] | null>((m, r) => (!m || r.primary < m.primary ? r : m), null);
    const hi = series.reduce<(typeof series)[number] | null>((m, r) => (!m || r.primary > m.primary ? r : m), null);
    return {
      modulo: moduleUi(id).name,
      unidad: moduleUi(id).unit ?? "",
      lecturas: series.length,
      promedio: avg,
      minimo: lo ? `${lo.text} (${formatDayTime(lo.ts, tz, now)})` : null,
      maximo: hi ? `${hi.text} (${formatDayTime(hi.ts, tz, now)})` : null,
      dias_en_rango: `${days.ok} de ${days.total}`,
      rango: rangeLabel(id, thresholdsFor(id, data!)),
    };
  });

  // Pills registered in the last 7 days (before today): taken vs scheduled
  const today0 = localDateKey(now, tz);
  const pastPills = (data?.readings ?? []).filter(
    (r) => r.module_id === "pillbox" && new Date(r.ts).getTime() >= weekAgo && localDateKey(new Date(r.ts), tz) !== today0,
  );
  const remediosSemana = {
    programados: pastPills.filter((r) => r.metric === "dose_scheduled").length,
    registrados: pastPills.filter((r) => r.metric === "dose_taken").length,
  };

  // Upcoming activities (demo agenda), with the day said the way people say it
  const agenda = agendaFor(data?.profile?.id, tz, now)
    .slice(0, 14)
    .map((e) => ({ cuando: spokenDay(e.day, today0, tz), hora: e.time, que: e.title, donde: e.place, nota: e.note, tipo: e.kind }));

  return {
    persona: { nombre: name || null },
    hora_local: formatTime(now, tz),
    contacto: contact ? { nombre: firstName(contact.name), relacion: contact.relation } : null,
    lecturas_de_hoy: vitals,
    remedios_de_hoy: remedios,
    remedios_guardados: guardados,
    alertas_abiertas: alertas,
    ultimos_7_dias: semana,
    remedios_ultimos_7_dias: remediosSemana,
    agenda,
    objetivos,
    nota: "Todos los dispositivos son simulados. Apoyo a la decisión, no diagnóstico.",
  };
}
