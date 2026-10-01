"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ScreenSkeleton, useCare } from "@/components/CareProvider";
import { RangeBar } from "@/components/ModuleCard";
import { BackButton, Button, Icon, MateoAvatar, StatusBadge, Toast } from "@/components/ui";
import { vitalCard } from "@/lib/cards";
import { moduleUi, VITAL_MODULES } from "@/lib/modules";
import { getSupabase } from "@/lib/supabase/client";
import { dayLabel, timeAgo } from "@/lib/time";
import { dailyPoints, daysInRange, thresholdsFor, vitalSeries, type DayPoint } from "@/lib/vitals";
import { DASHBOARD_PATH } from "@/lib/nav";

const rand = (lo: number, hi: number) => Math.round(lo + Math.random() * (hi - lo));

function WeekChart({ points, band }: { points: DayPoint[]; band: [number, number] }) {
  const values = points.flatMap((p) => (p.value == null ? [] : [p.value]));
  const lo = Math.min(band[0], ...values) - 8;
  const hi = Math.max(band[1], ...values) + 8;
  const y = (v: number) => ((v - lo) / (hi - lo)) * 100;

  return (
    <>
      <div className="relative mt-6 h-[200px]" role="img" aria-label={`Últimos 7 días: ${points.map((p) => `${p.day} ${p.text}`).join(", ")}`}>
        <div
          className="absolute inset-x-0 rounded-xl border-t-2 border-dashed border-ok bg-ok-soft"
          style={{ bottom: `${y(band[0])}%`, height: `${y(band[1]) - y(band[0])}%` }}
        />
        <div className="absolute right-1.5 text-small font-bold text-ok" style={{ bottom: `calc(${y(band[1])}% + 2px)` }}>
          {band[1]}
        </div>
        <div className="absolute inset-0 grid grid-cols-7">
          {points.map((p) =>
            p.value == null ? (
              <div key={p.key} />
            ) : (
              <div key={p.key} className="relative">
                <div
                  className={`absolute left-1/2 border-[3px] border-white ${p.out ? "h-[22px] w-[22px] rounded-[4px] bg-warn-icon" : "h-5 w-5 rounded-full bg-primary"}`}
                  style={{ bottom: `${y(p.value)}%`, transform: `translate(-50%, 50%) rotate(${p.out ? 45 : 0}deg)` }}
                />
                <div
                  className={`absolute inset-x-0 text-center text-small ${p.out ? "font-extrabold text-warn" : p.isToday ? "font-extrabold" : "font-semibold"}`}
                  style={{ bottom: `calc(${y(p.value)}% + 14px)` }}
                >
                  {p.text}
                </div>
              </div>
            ),
          )}
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-small text-ink-muted">
        {points.map((p) => (
          <span key={p.key} className={p.isToday ? "font-extrabold text-ink" : ""}>
            {p.day}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-4 border-t border-line-soft pt-3 text-small text-ink-muted">
        <span className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-full bg-primary" />
          En rango
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rotate-45 bg-warn-icon" />
          Fuera de rango
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-[18px] border-t-2 border-dashed border-ok bg-ok-soft" />
          Objetivo
        </span>
      </div>
    </>
  );
}

// 03 · Detalle de módulo
export default function ModuleDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, tz, userId, refresh } = useCare();
  const [toast, setToast] = useState<string | null>(null);
  const [measuring, setMeasuring] = useState(false);

  useEffect(() => {
    if (id === "pillbox") router.replace("/pastillero");
  }, [id, router]);

  if (!data) return <ScreenSkeleton />;
  if (!VITAL_MODULES.includes(id)) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <BackButton href="/modulos" label="Módulos" />
        <p className="text-body-lg">Este módulo todavía no tiene una vista de detalle.</p>
      </div>
    );
  }

  const now = new Date();
  const ui = moduleUi(id);
  const t = thresholdsFor(id, data);
  const card = vitalCard(id, data, now);
  const series = vitalSeries(id, data.readings, t);
  const last = series.at(-1);
  const points = dailyPoints(series, tz, 7, now);
  const week = daysInRange(series, tz, 7, now);
  const band = (ui.primaryMetric && t[ui.primaryMetric]?.normal) || ui.scale || [0, 100];
  const worst = series
    .filter((r) => r.level !== "ok" && now.getTime() - new Date(r.ts).getTime() < 7 * 86_400_000)
    .sort((a, b) => b.primary - a.primary)[0];

  const worstDay = worst ? dayLabel(worst.ts, tz, now) : "";
  const when = worstDay === "Hoy" || worstDay === "Ayer" ? worstDay : `El ${worstDay.toLowerCase()}`;
  const note = week.total
    ? `Esta semana estuvo en rango ${week.ok} de ${week.total} días.${
        worst ? ` ${when} llegó a ${worst.text}. Vale la pena comentarlo en su próximo control.` : " Siga así."
      }`
    : "Todavía no tengo lecturas de esta semana.";

  async function measure() {
    setMeasuring(true);
    const supabase = getSupabase();
    let text = "";
    if (id === "bp") {
      const s = rand(118, 134);
      const d = rand(72, 84);
      await supabase.rpc("ingest_bp", { p_user_id: userId, p_systolic: s, p_diastolic: d, p_source: "simulator" });
      text = `${s}/${d} mmHg`;
    } else {
      const v = id === "glucose" ? rand(96, 140) : rand(64, 82);
      await supabase.rpc("ingest_reading", { p_user_id: userId, p_module_id: id, p_metric: ui.primaryMetric!, p_value: v, p_unit: ui.unit, p_source: "simulator" });
      text = `${v} ${ui.unit}`;
    }
    await refresh();
    setMeasuring(false);
    setToast(`Medición simulada: ${text}`);
  }

  return (
    <div className="flex flex-col pb-6">
      <div className="px-4 pt-2">
        <BackButton onClick={() => (history.length > 1 ? router.back() : router.push(DASHBOARD_PATH))} />
      </div>
      <header className="flex items-center gap-3 px-6 pt-2">
        <Icon name={ui.icon} size="2rem" className="text-primary" />
        <h1 className="text-h1 font-extrabold">{ui.name}</h1>
      </header>

      <section className="mx-6 mt-5 flex flex-col gap-3.5 rounded-card border border-line bg-surface p-6">
        <span className="text-body text-ink-muted">{last ? `Última lectura · ${timeAgo(last.ts, now)}` : "Sin lecturas todavía"}</span>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-hero font-extrabold tracking-tight">{last?.text ?? "—"}</span>
          <span className="text-body-lg font-semibold text-ink-muted">{ui.unit}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={last ? card.status : "none"} />
          <span className="flex items-center gap-1.5 text-body text-ink-muted">
            <Icon name={card.trend.icon} size="1.5rem" />
            {card.trend.text}
          </span>
        </div>
        {card.range && (
          <div className="mt-1.5">
            <RangeBar range={{ ...card.range, marker: last ? card.range.marker ?? null : null }} status={card.status} />
          </div>
        )}
      </section>

      <section className="mx-6 mt-4 flex flex-col gap-4 rounded-card border border-line bg-surface p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-body-lg font-bold">Últimos 7 días</h2>
          {id === "bp" && <span className="text-body text-ink-muted">Sistólica</span>}
        </div>
        <WeekChart points={points} band={band as [number, number]} />
      </section>

      <section className="mx-6 mt-4 flex items-start gap-3.5 rounded-card bg-sunken p-5">
        <MateoAvatar size={44} />
        <div className="flex flex-col gap-1.5">
          <span className="text-body font-bold">Mateo</span>
          <p className="text-body">{note}</p>
        </div>
      </section>

      <div className="mt-auto flex flex-col gap-2 p-6">
        <Button icon="add" onClick={measure} disabled={measuring}>
          {measuring ? "Midiendo…" : "Medir ahora"}
        </Button>
        <span className="text-center text-small text-ink-subtle">El {ui.device?.toLowerCase()} es simulado</span>
      </div>

      {toast && (
        <Toast icon="science" onClose={() => setToast(null)}>
          {toast}
        </Toast>
      )}
    </div>
  );
}
