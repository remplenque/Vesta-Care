"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Brand, Icon, StatusBadge } from "@/components/ui";
import { viewThresholds, type ContactView } from "@/lib/contact-view";
import { moduleUi, sortModules } from "@/lib/modules";
import { evaluateLevel, worstLevel } from "@/lib/rules";
import { STATUS, statusFromLevel } from "@/lib/status";
import { getSupabase } from "@/lib/supabase/client";
import { ageFrom, DEFAULT_TZ, firstName, formatDayTime, formatTime } from "@/lib/time";

// Anonymous visitors get no Realtime on RLS tables, so the view polls the RPC
const POLL_MS = 5000;

type Row = { moduleId: string; value: string; ts: string; status: ReturnType<typeof statusFromLevel> | null };

function readingRows(view: ContactView): Row[] {
  const byModule = new Map<string, ContactView["latest_readings"]>();
  for (const r of view.latest_readings) {
    if (r.module_id === "pillbox") continue;
    byModule.set(r.module_id, [...(byModule.get(r.module_id) ?? []), r]);
  }
  const rows = [...byModule.entries()].map(([moduleId, rs]) => {
    const t = viewThresholds(view, moduleId);
    const known = Object.keys(t).length > 0;
    const level = worstLevel(rs.map((r) => evaluateLevel(Number(r.value), t[r.metric])));
    const ts = rs.map((r) => r.ts).sort().at(-1)!;
    const ui = moduleUi(moduleId);
    let value = rs.map((r) => Number(r.value)).join(" ");
    if (moduleId === "bp") {
      const sys = rs.find((r) => r.metric === "systolic")?.value;
      const dia = rs.find((r) => r.metric === "diastolic")?.value;
      value = `${Number(sys)}/${Number(dia)}`;
    } else if (ui.unit && moduleId !== "glucose") {
      value = `${value} ${ui.unit}`;
    }
    return { moduleId, value, ts, status: known ? statusFromLevel(level) : null };
  });
  return sortModules(rows, (r) => r.moduleId);
}

// 08 · /c/[token] · Vista del contacto (solo lectura)
export default function ContactPage() {
  const { token } = useParams<{ token: string }>();
  const [view, setView] = useState<ContactView | null | undefined>(undefined);

  useEffect(() => {
    const supabase = getSupabase();
    const load = () =>
      supabase.rpc("get_contact_view", { p_token: token }).then(({ data, error }) => {
        if (error) return setView((v) => (v === undefined ? null : v));
        setView((data as unknown as ContactView) ?? null);
      });
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [token]);

  if (view === undefined) {
    return <div className="mx-auto min-h-dvh max-w-[480px] bg-canvas p-6 text-body-lg" aria-busy="true">Un momento…</div>;
  }
  if (view === null) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-4 bg-canvas p-6">
        <Brand size="sm" />
        <h1 className="text-h1 font-extrabold">Este enlace no es válido</h1>
        <p className="text-body-lg text-ink-muted">Pídale a su familiar que le comparta el enlace de nuevo desde Vesta Care.</p>
      </div>
    );
  }

  const tz = view.patient.timezone ?? DEFAULT_TZ;
  const now = new Date();
  const patientFirst = firstName(view.patient.full_name);
  const age = ageFrom(view.patient.birth_date, now);
  const rows = readingRows(view);
  const urgent = view.alerts.find((a) => a.level === "critical" && now.getTime() - new Date(a.ts).getTime() < 12 * 3_600_000);
  const urgentRow = urgent && rows.find((r) => r.moduleId === urgent.module_id);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-canvas">
      <div className="flex items-center justify-between px-6 pt-4">
        <Brand size="sm" />
        <span className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-line-strong px-3 py-1 text-small text-ink-muted">
          <Icon name="visibility" size="1.15rem" />
          Solo lectura
        </span>
      </div>

      <header className="flex flex-col gap-0.5 px-6 pt-5">
        <span className="text-body text-ink-muted">
          Hola {firstName(view.contact.name)}, así está {patientFirst}
        </span>
        <h1 className="text-h1 font-extrabold">
          {view.patient.full_name}
          {age ? `, ${age}` : ""}
        </h1>
      </header>

      {urgent ? (
        <section className="mx-6 mt-4 flex flex-col gap-3 rounded-card border-2 border-crit bg-surface p-[22px]">
          <StatusBadge status="crit" />
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-metric font-extrabold">{urgent.module_id === "bp" && urgentRow ? urgentRow.value : Number(urgent.value)}</span>
            <span className="text-body-lg font-semibold text-ink-muted">{moduleUi(urgent.module_id).unit}</span>
          </div>
          <span className="text-body text-ink-muted">
            {moduleUi(urgent.module_id).name} · {formatDayTime(urgent.ts, tz, now)}
          </span>
          <div className="flex flex-col gap-2 border-t border-line-soft pt-3">
            {urgent.ack_at ? (
              <span className="flex items-center gap-2 text-body">
                <Icon name="check_circle" fill size="1.4rem" className="text-ok" />
                {patientFirst} confirmó que está bien · {formatTime(urgent.ack_at, tz)}
              </span>
            ) : (
              <span className="flex items-center gap-2 text-body">
                <Icon name="hourglass_top" size="1.4rem" className="text-warn" />
                Aún no responde la alerta
              </span>
            )}
          </div>
        </section>
      ) : (
        <section className="mx-6 mt-4 flex flex-col gap-3 rounded-card border border-line bg-surface p-[22px]">
          <StatusBadge status="ok" label="Todo en orden" />
          <p className="text-body text-ink-muted">No hay alertas urgentes en las últimas 12 horas.</p>
        </section>
      )}

      <h2 className="px-6 pt-6 pb-2 text-body-lg font-extrabold">Últimas lecturas</h2>
      <div className="mx-6 rounded-card border border-line bg-surface px-[18px] py-1">
        {!rows.length && <p className="py-5 text-body text-ink-muted">Todavía no hay lecturas.</p>}
        {rows.map((r) => {
          const ui = moduleUi(r.moduleId);
          return (
            <div key={r.moduleId} className="flex min-h-[72px] items-center gap-3 border-b border-line-soft last:border-b-0">
              <Icon name={ui.icon} size="1.6rem" className="text-primary" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-body font-bold">{ui.name}</span>
                <span className="text-small text-ink-subtle">{formatDayTime(r.ts, tz, now)}</span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-body-lg font-extrabold">{r.value}</span>
                {r.status && <StatusBadge status={r.status} size="sm" />}
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="px-6 pt-6 pb-2 text-body-lg font-extrabold">Alertas recientes</h2>
      <div className="mx-6 flex flex-col gap-2.5 pb-7">
        {!view.alerts.length && <p className="text-body text-ink-muted">Sin alertas.</p>}
        {view.alerts.slice(0, 5).map((a) => {
          const s = STATUS[statusFromLevel(a.level)];
          return (
            <div key={a.id} className="flex items-start gap-3 rounded-btn border border-line bg-surface px-4 py-3.5">
              <Icon name={s.icon} fill size="1.5rem" className={a.level === "critical" ? "text-crit" : "text-warn-icon"} />
              <div className="flex flex-col gap-0.5">
                <span className="text-body font-bold">{a.message}</span>
                <span className="text-small text-ink-muted">
                  {formatDayTime(a.ts, tz, now)} · {s.label}
                  {a.ack_at ? " · Respondida" : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-auto flex items-center gap-2 border-t border-line px-6 pt-4 pb-6 text-small text-ink-subtle">
        <span className="h-2.5 w-2.5 rounded-full bg-ok" />
        Se actualiza solo cada {POLL_MS / 1000} segundos · Datos de dispositivos simulados
      </div>
    </div>
  );
}
