import type { CareData } from "@/lib/data";
import { moduleUi, sortModules, VITAL_MODULES } from "@/lib/modules";
import { medLabel, todaySlots, type DoseStatus } from "@/lib/pillbox";
import type { Level } from "@/lib/rules";
import { DEFAULT_TZ, firstName, formatTime, localDateKey } from "@/lib/time";
import { thresholdsFor, vitalSeries } from "@/lib/vitals";

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

  const remedios = enabled.has("pillbox")
    ? todaySlots(data!.medications, data!.readings, tz, now).map((s) => ({
        remedio: medLabel(s.medication),
        hora: s.time,
        estado: DOSE_WORDS[s.status],
      }))
    : [];

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

  return {
    persona: { nombre: name || null },
    hora_local: formatTime(now, tz),
    contacto: contact ? { nombre: firstName(contact.name), relacion: contact.relation } : null,
    lecturas_de_hoy: vitals,
    remedios_de_hoy: remedios,
    alertas_abiertas: alertas,
    objetivos,
    nota: "Todos los dispositivos son simulados. Apoyo a la decisión, no diagnóstico.",
  };
}
