"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ScreenSkeleton, useCare } from "@/components/CareProvider";
import { Icon, SimulatedNote, StatusBadge } from "@/components/ui";
import {
  buildDays,
  dayRange,
  daysFrom,
  dosesSummary,
  longDay,
  monthLabel,
  monthStart,
  monthWeeks,
  sameMonth,
  shiftDay,
  shiftMonth,
  shortDate,
  weekStart,
  type CalDay,
  type DayStatus,
  type DoseState,
} from "@/lib/calendar";
import type { Alert, Reading } from "@/lib/data";
import { moduleUi, sortModules, VITAL_MODULES } from "@/lib/modules";
import { medLabel } from "@/lib/pillbox";
import { STATUS } from "@/lib/status";
import { getSupabase } from "@/lib/supabase/client";
import { formatTime, localDateKey } from "@/lib/time";
import { AGENDA_ICON, agendaFor, eventsOn } from "@/lib/agenda";

// Calendario: the person's week (default) or month. Week = one row per day that opens to show the
// remedies of that day, the measurements and the alerts. Month = one row per week with a mark per
// day; touching a week opens it. Built from the medication schedule, pillbox readings and alerts.

type Mode = "week" | "month";
type RangeData = { key: string; pillbox: Pick<Reading, "metric" | "metadata" | "ts">[]; alerts: Alert[] };

const DAY_STATUS: Record<DayStatus, { icon: string; label: string; text: string; marker: string }> = {
  ok: { icon: STATUS.ok.icon, label: "Todo bien", text: STATUS.ok.text, marker: "bg-ok-soft" },
  warn: { icon: STATUS.warn.icon, label: "Revisar", text: STATUS.warn.text, marker: "bg-warn-soft" },
  crit: { icon: STATUS.crit.icon, label: "Alerta", text: STATUS.crit.text, marker: "bg-crit-soft" },
  none: { icon: "remove", label: "Sin datos", text: "text-ink-subtle", marker: "bg-sunken" },
  future: { icon: "schedule", label: "Próximo", text: "text-ink-muted", marker: "bg-canvas" },
};

const DOSE: Record<DoseState, { icon: string; label: string; text: string }> = {
  taken: { icon: "check_circle", label: "Tomado", text: "text-ok" },
  missed: { icon: "error", label: "Sin registrar", text: "text-warn" },
  pending: { icon: "schedule", label: "Toca ahora", text: "text-primary" },
  later: { icon: "schedule", label: "Más tarde", text: "text-ink-muted" },
  unknown: { icon: "remove", label: "Sin datos", text: "text-ink-subtle" },
};

export default function CalendarPage() {
  const { data, userId, tz } = useCare();
  const today = localDateKey(new Date(), tz);
  const [mode, setMode] = useState<Mode>("week");
  const [anchor, setAnchor] = useState(today);
  const [openDay, setOpenDay] = useState<string | null>(today);
  const [range, setRange] = useState<RangeData | null>(null);

  const weeks = mode === "week" ? [daysFrom(weekStart(anchor), 7)] : monthWeeks(anchor);
  const first = weeks[0][0];
  const last = weeks.at(-1)!.at(-1)!;
  const rangeKey = `${first}_${last}`;

  useEffect(() => {
    let cancelled = false;
    const { from, to } = dayRange(first, last, tz);
    const supabase = getSupabase();
    Promise.all([
      supabase
        .from("readings")
        .select("metric, metadata, ts")
        .eq("user_id", userId)
        .eq("module_id", "pillbox")
        .gte("ts", from.toISOString())
        .lt("ts", to.toISOString())
        .limit(2000),
      supabase.from("alerts").select("*").eq("user_id", userId).gte("ts", from.toISOString()).lt("ts", to.toISOString()).order("ts").limit(1000),
    ]).then(([p, a]) => {
      if (!cancelled) setRange({ key: `${first}_${last}`, pillbox: p.data ?? [], alerts: a.data ?? [] });
    });
    return () => {
      cancelled = true;
    };
  }, [first, last, tz, userId]);

  if (!data) return <ScreenSkeleton />;
  const ready = range?.key === rangeKey;
  const days = ready ? buildDays(weeks.flat(), data.medications, range.pillbox, range.alerts, tz) : [];
  const byKey = new Map(days.map((d) => [d.key, d]));

  const showsToday = mode === "week" ? weekStart(anchor) === weekStart(today) : sameMonth(anchor, today);
  const title = mode === "week" ? `${shortDate(first, tz)} – ${shortDate(last, tz)}` : monthLabel(anchor, tz);
  const unit = mode === "week" ? "semana" : "mes";

  function move(step: number) {
    setAnchor((a) => (mode === "week" ? shiftDay(weekStart(a), 7 * step) : shiftMonth(a, step)));
    setOpenDay(null);
  }

  function switchMode(m: Mode) {
    setMode(m);
    setAnchor(today);
    setOpenDay(m === "week" ? today : null);
  }

  function openWeek(start: string) {
    setMode("week");
    setAnchor(start);
    setOpenDay(null);
  }

  return (
    <div className="flex flex-col gap-5 px-5 pt-5 pb-8">
      <h1 className="text-h1 font-extrabold">Su calendario</h1>

      <div role="group" aria-label="Ver por" className="grid grid-cols-2 rounded-full border-2 border-line-strong bg-surface p-1">
        {(["week", "month"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => switchMode(m)}
            className={`min-h-14 cursor-pointer rounded-full text-body-lg font-bold ${mode === m ? "bg-primary text-white" : "text-ink-muted"}`}
          >
            {m === "week" ? "Semana" : "Mes"}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-center text-title font-extrabold" aria-live="polite">
          {title}
        </p>
        {/* Side by side when they fit; stacked with very large text */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3">
          <button
            type="button"
            onClick={() => move(-1)}
            className="flex min-h-14 cursor-pointer items-center justify-center gap-1 rounded-btn border-2 border-line-strong bg-surface px-3 text-body-lg font-bold"
          >
            <Icon name="chevron_left" size="1.75rem" />
            Anterior
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            className="flex min-h-14 cursor-pointer items-center justify-center gap-1 rounded-btn border-2 border-line-strong bg-surface px-3 text-body-lg font-bold"
          >
            Siguiente
            <Icon name="chevron_right" size="1.75rem" />
          </button>
        </div>
        {!showsToday && (
          <button type="button" onClick={() => switchMode(mode)} className="min-h-14 cursor-pointer text-body-lg font-bold text-primary underline underline-offset-4">
            Volver a {unit === "semana" ? "esta semana" : "este mes"}
          </button>
        )}
      </div>

      {!ready ? (
        <div className="flex flex-col gap-3" aria-hidden>
          {Array.from({ length: mode === "week" ? 7 : 5 }, (_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-card bg-sunken motion-reduce:animate-none" />
          ))}
        </div>
      ) : mode === "week" ? (
        <ul className="flex flex-col gap-3">
          {days.map((d) => (
            <DayRow key={d.key} day={d} open={openDay === d.key} onToggle={() => setOpenDay(openDay === d.key ? null : d.key)} />
          ))}
        </ul>
      ) : (
        <MonthView weeks={weeks} byKey={byKey} anchor={anchor} onOpenWeek={openWeek} />
      )}

      <Legend />
    </div>
  );
}

// ---------------------------------------------------------------- Week

function DayRow({ day, open, onToggle }: { day: CalDay; open: boolean; onToggle: () => void }) {
  const { tz, userId } = useCare();
  const plans = eventsOn(agendaFor(userId, tz), day.key);
  const s = DAY_STATUS[day.status];
  const crit = day.alerts.filter((a) => a.level === "critical").length;
  const panelId = `dia-${day.key}`;

  return (
    <li className={`rounded-card border-2 bg-surface ${day.isToday ? "border-primary" : "border-line"}`}>
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={onToggle} className="flex min-h-[76px] w-full cursor-pointer items-center gap-4 px-4 py-3 text-left">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${s.marker}`}>
          <Icon name={s.icon} fill size="1.75rem" className={s.text} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body-lg font-extrabold">
            {longDay(day.key, tz)}
            {day.isToday && <span className="ml-2 rounded-full bg-primary px-2.5 py-0.5 text-small font-bold text-white">Hoy</span>}
          </span>
          <span className="text-body text-ink-muted">
            {dosesSummary(day)}
            {plans.length > 0 && (
              <span className="font-bold text-primary">
                {" · "}
                {plans.length} actividad{plans.length > 1 ? "es" : ""}
              </span>
            )}
            {day.alerts.length > 0 && (
              <span className={`font-bold ${crit ? "text-crit" : "text-warn"}`}>
                {" · "}
                {day.alerts.length} alerta{day.alerts.length > 1 ? "s" : ""}
              </span>
            )}
          </span>
        </span>
        <Icon name={open ? "expand_less" : "expand_more"} size="1.9rem" className="shrink-0 text-ink-muted" />
      </button>
      {open && (
        <div id={panelId}>
          <DayDetail day={day} />
        </div>
      )}
    </li>
  );
}

function DayDetail({ day }: { day: CalDay }) {
  const { data, userId, tz } = useCare();
  const [counts, setCounts] = useState<{ moduleId: string; n: number }[] | null>(null);
  const vitals = sortModules(
    (data?.userModules ?? []).filter((u) => u.enabled && VITAL_MODULES.includes(u.module_id)).map((u) => u.module_id),
    (m) => m,
  );
  const vitalsKey = vitals.join(",");

  // Measurements of that day, counted on demand (the simulator can send many per day)
  useEffect(() => {
    if (day.isFuture) return;
    let cancelled = false;
    const { from, to } = dayRange(day.key, day.key, tz);
    const supabase = getSupabase();
    Promise.all(
      vitalsKey
        .split(",")
        .filter(Boolean)
        .map(async (m) => {
          const { count } = await supabase
            .from("readings")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("module_id", m)
            .eq("metric", moduleUi(m).primaryMetric ?? "")
            .gte("ts", from.toISOString())
            .lt("ts", to.toISOString());
          return { moduleId: m, n: count ?? 0 };
        }),
    ).then((c) => !cancelled && setCounts(c));
    return () => {
      cancelled = true;
    };
  }, [day.key, day.isFuture, tz, userId, vitalsKey]);

  const plans = eventsOn(agendaFor(userId, tz), day.key);

  return (
    <div className="flex flex-col gap-4 border-t border-line px-4 pt-4 pb-5">
      {plans.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="flex items-center gap-2 text-body-lg font-extrabold">
            <Icon name="event" size="1.6rem" className="text-primary" />
            Actividades
          </h3>
          <ul className="flex flex-col gap-2">
            {plans.map((e) => (
              <li key={e.id} className="flex items-start gap-3 rounded-btn bg-sunken px-3 py-2.5">
                <Icon name={AGENDA_ICON[e.kind]} size="1.5rem" className="mt-0.5 text-primary" />
                <span className="flex flex-col">
                  <span className="text-body-lg font-bold">
                    {e.time} · {e.title}
                  </span>
                  {e.place && <span className="text-body text-ink-muted">{e.place}</span>}
                  {e.note && <span className="text-body text-ink-muted">{e.note}</span>}
                </span>
              </li>
            ))}
          </ul>
          <SimulatedNote>Agenda de demostración</SimulatedNote>
        </section>
      )}
      <section className="flex flex-col gap-2">
        <h3 className="flex items-center gap-2 text-body-lg font-extrabold">
          <Icon name="medication" size="1.6rem" className="text-primary" />
          Remedios
        </h3>
        {!day.doses.length && <p className="text-body text-ink-muted">No tiene remedios programados.</p>}
        <ul className="flex flex-col gap-1.5">
          {day.doses.map((d) => {
            const st = DOSE[d.state];
            return (
              <li key={d.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-btn bg-canvas px-3 py-2.5">
                <span className="w-14 shrink-0 font-mono text-body font-bold">{d.time}</span>
                <span className="min-w-0 flex-1 text-body">{medLabel(d.medication)}</span>
                <span className={`ml-auto flex shrink-0 items-center gap-1 text-small font-bold ${st.text}`}>
                  <Icon name={st.icon} fill size="1.2rem" />
                  {d.state === "taken" && d.takenAt ? formatTime(d.takenAt, tz) : st.label}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {!day.isFuture && vitals.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="flex items-center gap-2 text-body-lg font-extrabold">
            <Icon name="monitor_heart" size="1.6rem" className="text-primary" />
            Mediciones
          </h3>
          {!counts ? (
            <p className="text-body text-ink-muted">Un momento…</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {counts.map((c) => (
                <li key={c.moduleId} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-btn bg-canvas px-3 py-2.5 text-body">
                  <Icon name={moduleUi(c.moduleId).icon} size="1.5rem" className="text-primary" />
                  <span className="flex-1">{moduleUi(c.moduleId).name}</span>
                  <span className={`ml-auto font-bold ${c.n ? "text-ink" : "text-ink-subtle"}`}>{c.n ? `${c.n} ${c.n === 1 ? "medición" : "mediciones"}` : "Sin mediciones"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!day.isFuture && (
        <section className="flex flex-col gap-2">
          <h3 className="flex items-center gap-2 text-body-lg font-extrabold">
            <Icon name="notifications" size="1.6rem" className="text-primary" />
            Alertas
          </h3>
          {!day.alerts.length && <p className="text-body text-ink-muted">Ninguna alerta este día.</p>}
          <ul className="flex flex-col gap-1.5">
            {[...day.alerts].reverse().map((a) => (
              <li key={a.id}>
                <Link href={`/alerta/${a.id}`} className="flex min-h-14 items-center gap-3 rounded-btn bg-canvas px-3 py-2.5">
                  <span className="w-14 shrink-0 font-mono text-body font-bold">{formatTime(a.ts, tz)}</span>
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                    <StatusBadge status={a.level === "critical" ? "crit" : "warn"} size="sm" />
                    <span className="text-body">{a.message}</span>
                  </span>
                  <Icon name="chevron_right" size="1.5rem" className="shrink-0 text-ink-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Month

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

function MonthView({ weeks, byKey, anchor, onOpenWeek }: { weeks: string[][]; byKey: Map<string, CalDay>; anchor: string; onOpenWeek: (start: string) => void }) {
  const { tz } = useCare();
  const month = monthStart(anchor);

  return (
    <div className="flex flex-col gap-2">
      <div aria-hidden className="grid grid-cols-[repeat(7,minmax(0,1fr))_1.9rem] gap-1 px-3 text-center text-small font-bold text-ink-muted">
        {WEEKDAYS.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
        <span />
      </div>
      <p className="px-1 text-body text-ink-muted">Toque una semana para ver cada día.</p>
      <ul className="flex flex-col gap-2">
        {weeks.map((week) => {
          const days = week.map((k) => byKey.get(k)).filter((d): d is CalDay => Boolean(d));
          const alerts = days.reduce((n, d) => n + d.alerts.length, 0);
          const due = days.flatMap((d) => d.doses.filter((x) => x.state !== "later" && x.state !== "unknown"));
          const taken = due.filter((x) => x.state === "taken").length;
          const label = `Semana del ${longDay(week[0], tz)} al ${longDay(week[6], tz)}: ${
            due.length ? `${taken} de ${due.length} remedios tomados` : "sin remedios registrados"
          }${alerts ? `, ${alerts} alerta${alerts > 1 ? "s" : ""}` : ""}. Ver detalle`;
          return (
            <li key={week[0]}>
              <button
                type="button"
                onClick={() => onOpenWeek(week[0])}
                aria-label={label}
                className="grid min-h-[76px] w-full cursor-pointer grid-cols-[repeat(7,minmax(0,1fr))_1.9rem] items-center gap-1 rounded-card border-2 border-line bg-surface px-3 py-2"
              >
                {week.map((k) => {
                  const d = byKey.get(k);
                  const s = DAY_STATUS[d?.status ?? "none"];
                  const inMonth = sameMonth(k, month);
                  return (
                    <span key={k} className={`flex flex-col items-center gap-0.5 ${inMonth ? "" : "opacity-40"}`}>
                      <span className={`text-body font-bold ${d?.isToday ? "rounded-full bg-primary px-1.5 text-white" : ""}`}>{Number(k.slice(8))}</span>
                      <Icon name={s.icon} fill size="1.25rem" className={s.text} />
                    </span>
                  );
                })}
                <Icon name="chevron_right" size="1.75rem" className="text-ink-muted" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Legend() {
  const items: DayStatus[] = ["ok", "warn", "crit", "none", "future"];
  return (
    <section aria-label="Qué significa cada marca" className="flex flex-wrap gap-x-4 gap-y-2 rounded-card bg-sunken px-4 py-3">
      {items.map((k) => (
        <span key={k} className="flex items-center gap-1.5 text-small font-bold text-ink-muted">
          <Icon name={DAY_STATUS[k].icon} fill size="1.2rem" className={DAY_STATUS[k].text} />
          {DAY_STATUS[k].label}
        </span>
      ))}
    </section>
  );
}
