import type { RangeInfo } from "@/components/ModuleCard";
import type { CareData } from "./data";
import { moduleUi } from "./modules";
import { medLabel, nextDose, todaySlots } from "./pillbox";
import type { Level } from "./rules";
import { statusFromLevel, type StatusKey } from "./status";
import { timeAgo } from "./time";
import { rangeLabel, scalePos, thresholdsFor, trendOf, vitalSeries, type Trend } from "./vitals";

export type CardModel = {
  moduleId: string;
  name: string;
  icon: string;
  value: string;
  unit?: string;
  status: StatusKey;
  level: Level | null;
  trend: Trend;
  range?: RangeInfo;
  progress?: { pct: number; label: string };
  foot: string;
};

const DAY = 86_400_000;

export function vitalCard(moduleId: string, data: CareData, now = new Date()): CardModel {
  const ui = moduleUi(moduleId);
  const t = thresholdsFor(moduleId, data);
  const series = vitalSeries(moduleId, data.readings, t);
  const last = series.at(-1);
  const fresh = last && now.getTime() - new Date(last.ts).getTime() < DAY;
  const primary = ui.primaryMetric ? t[ui.primaryMetric] : undefined;
  const scale = ui.scale ?? [0, 100];

  const range: RangeInfo | undefined = primary
    ? {
        bandL: scalePos(primary.normal[0], scale),
        bandW: ((primary.normal[1] - primary.normal[0]) / (scale[1] - scale[0])) * 100,
        marker: fresh ? scalePos(last.primary, scale) : null,
        label: rangeLabel(moduleId, t),
      }
    : undefined;

  if (!fresh) {
    return {
      moduleId,
      name: ui.name,
      icon: ui.icon,
      value: "—",
      unit: ui.unit,
      status: "none",
      level: null,
      trend: { icon: "help", text: "Sin lecturas hoy" },
      range,
      foot: last ? `Última lectura ${timeAgo(last.ts, now)}` : `Revise que el ${ui.device?.toLowerCase() ?? "equipo"} esté encendido`,
    };
  }

  return {
    moduleId,
    name: ui.name,
    icon: ui.icon,
    value: last.text,
    unit: ui.unit,
    status: statusFromLevel(last.level),
    level: last.level,
    trend: trendOf(series, t, moduleId),
    range,
    foot: `${timeAgo(last.ts, now).replace(/^./, (c) => c.toUpperCase())} · ${ui.device} simulado`,
  };
}

export function pillboxCard(data: CareData, tz: string, now = new Date()): CardModel {
  const slots = todaySlots(data.medications, data.readings, tz, now);
  const taken = slots.filter((s) => s.status === "taken").length;
  const missed = slots.filter((s) => s.status === "missed");
  const next = nextDose(slots);
  const base = { moduleId: "pillbox", name: "Pastillero", icon: "medication", unit: "tomadas" };

  if (!slots.length) {
    return { ...base, value: "—", status: "none", level: null, trend: { icon: "help", text: "Sin remedios" }, foot: "Agregue sus remedios" };
  }
  const pct = (taken / slots.length) * 100;
  if (missed.length) {
    const m = missed[0];
    return {
      ...base,
      value: `${taken} de ${slots.length}`,
      status: "warn",
      level: "warn",
      trend: { icon: "schedule", text: "No quedó registrada" },
      progress: { pct, label: `${m.time} ${medLabel(m.medication)} · ¿se la tomó?` },
      foot: "Pastillero simulado conectado",
    };
  }
  return {
    ...base,
    value: `${taken} de ${slots.length}`,
    status: "ok",
    level: "ok",
    trend: { icon: "schedule", text: "Al día" },
    progress: { pct, label: next ? `Próxima: ${next.time} ${medLabel(next.medication)}` : "Todas las de hoy tomadas" },
    foot: "Pastillero simulado conectado",
  };
}
