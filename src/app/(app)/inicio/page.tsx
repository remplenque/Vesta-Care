"use client";

import Link from "next/link";
import { ScreenSkeleton, useCare } from "@/components/CareProvider";
import { ModuleCard } from "@/components/ModuleCard";
import { Icon, MateoAvatar, ProgressBar, SimulatedNote, StatusBadge } from "@/components/ui";
import { pillboxCard, vitalCard, type CardModel } from "@/lib/cards";
import { moduleUi, sortModules, VITAL_MODULES } from "@/lib/modules";
import { medLabel, nextDose, todaySlots } from "@/lib/pillbox";
import { worstLevel } from "@/lib/rules";
import { statusFromLevel } from "@/lib/status";
import { firstName, formatLongDate, greeting, timeAgo } from "@/lib/time";
import { daysInRange, thresholdsFor, vitalSeries } from "@/lib/vitals";

function joinNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
}

function summaryText(cards: CardModel[], missed: number, upcoming: number) {
  const vitals = cards.filter((c) => c.moduleId !== "pillbox" && c.level);
  const out = vitals.filter((c) => c.level !== "ok").map((c) => moduleUi(c.moduleId).short.toLowerCase());
  const inRange = vitals.filter((c) => c.level === "ok").map((c) => `su ${moduleUi(c.moduleId).short.toLowerCase()}`);
  const parts: string[] = [];
  if (out.length) parts.push(`Revise su ${joinNames(out)}: ${out.length > 1 ? "están" : "está"} fuera de su rango.`);
  else if (inRange.length) parts.push(`${joinNames(inRange).replace(/^s/, "S")} ${inRange.length > 1 ? "están" : "está"} en rango.`);
  if (missed > 0) parts.push(missed === 1 ? "Un remedio de hoy no quedó registrado. ¿Se lo tomó?" : `${missed} remedios de hoy no quedaron registrados. ¿Se los tomó?`);
  if (upcoming > 0) parts.push(upcoming === 1 ? "Le queda un remedio por tomar hoy." : `Le quedan ${upcoming} remedios por tomar hoy.`);
  else if (!missed) parts.push("Ya registró todos sus remedios de hoy.");
  return parts.join(" ");
}

// 02 · Inicio
export default function Home() {
  const { data, tz } = useCare();
  if (!data) return <ScreenSkeleton />;

  const now = new Date();
  const enabled = data.userModules.filter((u) => u.enabled).map((u) => u.module_id);
  // Vital modules show when enabled, or when a simulator scenario sent readings today
  const recent = new Set(data.readings.filter((r) => now.getTime() - new Date(r.ts).getTime() < 86_400_000).map((r) => r.module_id));
  const ids = sortModules(
    [...new Set([...enabled, ...VITAL_MODULES.filter((m) => recent.has(m))])].filter((id) => VITAL_MODULES.includes(id) || id === "pillbox"),
    (id) => id,
  );
  const cards = ids.map((id) => (id === "pillbox" ? pillboxCard(data, tz, now) : vitalCard(id, data, now)));

  const slots = todaySlots(data.medications, data.readings, tz, now);
  const next = nextDose(slots);
  const pending = slots.filter((s) => s.status !== "taken").length;
  const takenToday = slots.length - pending;

  const overall = worstLevel(cards.map((c) => c.level ?? "ok"));
  const overallStatus = statusFromLevel(overall);
  const title = overall === "critical" ? "Una lectura necesita atención" : overall === "warn" ? "Hay algo que revisar" : "Todo en orden hoy";

  const openCritical = data.alerts.find((a) => a.level === "critical" && a.status === "open" && now.getTime() - new Date(a.ts).getTime() < 6 * 3_600_000);

  const bpSeries = enabled.includes("bp") ? vitalSeries("bp", data.readings, thresholdsFor("bp", data)) : [];
  const bpDays = daysInRange(bpSeries, tz, 7, now);
  const name = firstName(data.profile?.full_name);

  return (
    <div className="flex flex-col pb-6">
      <header className="flex flex-col gap-1 px-6 pt-6">
        <span className="text-body text-ink-muted">{formatLongDate(now, tz)}</span>
        <h1 className="text-h1 font-extrabold">
          {greeting(now, tz)}
          {name ? `, ${name}` : ""}
        </h1>
      </header>

      {openCritical && (
        <Link href={`/alerta/${openCritical.id}`} className="mx-6 mt-5 flex min-h-16 items-center gap-3 rounded-card bg-crit px-5 py-4 text-white">
          <Icon name="emergency" fill size="2rem" />
          <span className="flex flex-1 flex-col">
            <span className="text-body-lg font-extrabold">Alerta urgente</span>
            <span className="text-body">{openCritical.message} · {timeAgo(openCritical.ts, now)}</span>
          </span>
          <Icon name="chevron_right" size="1.75rem" />
        </Link>
      )}

      <section className="mx-6 mt-5 flex flex-col gap-3.5 rounded-card border border-line bg-surface p-6">
        <StatusBadge status={overallStatus} />
        <h2 className="text-title font-bold">{title}</h2>
        <div className="flex items-start gap-3">
          <MateoAvatar />
          <p className="text-body text-ink-muted">{summaryText(cards, slots.filter((s) => s.status === "missed").length, slots.filter((s) => s.status === "due" || s.status === "later").length)}</p>
        </div>
      </section>

      {next && (
        <Link href="/pastillero" className="mx-6 mt-4 flex items-center gap-4 rounded-card bg-primary px-6 py-5 text-white">
          <Icon name="schedule" size="2.25rem" />
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-body opacity-90">Próximo remedio</span>
            <span className="text-lead font-bold">
              {next.time} · {medLabel(next.medication)}
            </span>
          </span>
        </Link>
      )}

      {(bpDays.total > 0 || slots.length > 0) && (
        <section className="mx-6 mt-4 flex flex-col gap-4 rounded-card border border-line bg-surface px-6 py-5">
          <h2 className="text-body-lg font-bold">Sus objetivos</h2>
          {bpDays.total > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between gap-3 text-body">
                <span>Presión en rango</span>
                <span className="font-bold">
                  {bpDays.ok} de {bpDays.total} días
                </span>
              </div>
              <ProgressBar pct={(bpDays.ok / bpDays.total) * 100} tone="ok" />
            </div>
          )}
          {slots.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between gap-3 text-body">
                <span>Remedios de hoy</span>
                <span className="font-bold">
                  {takenToday} de {slots.length}
                </span>
              </div>
              <ProgressBar pct={(takenToday / slots.length) * 100} />
            </div>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-6 pt-7">
        <h2 className="text-lead font-extrabold">Sus módulos</h2>
        <SimulatedNote />
      </div>
      <div className="flex flex-col gap-4 px-6 pt-3.5">
        {cards.map((c) => (
          <ModuleCard
            key={c.moduleId}
            href={c.moduleId === "pillbox" ? "/pastillero" : `/modulos/${c.moduleId}`}
            name={c.name}
            icon={c.icon}
            value={c.value}
            unit={c.unit}
            status={c.status}
            trend={c.trend}
            range={c.range}
            progress={c.progress}
          />
        ))}
        {!cards.length && (
          <Link href="/modulos" className="flex min-h-16 items-center justify-center gap-2 rounded-card border-2 border-dashed border-line-strong text-body-lg font-bold text-primary">
            <Icon name="add" size="1.75rem" />
            Activar un módulo
          </Link>
        )}
      </div>

    </div>
  );
}
