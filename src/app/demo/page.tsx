"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";
import type { ContactView } from "@/lib/contact-view";
import { DEMO_CONTACT_TOKEN, DEMO_USER_ID } from "@/lib/demo";
import { moduleUi } from "@/lib/modules";
import { getSupabase } from "@/lib/supabase/client";
import { ageFrom, initials } from "@/lib/time";

type LogEntry = { id: string; t: string; table: string; msg: string; color: string };

const COLORS = { readings: "#9FC2E6", alerts: "#F0A49A", outbound: "#E8C48A", ok: "#9FD3A8", info: "#C9C1B5" };
const SIM_EVERY_MS = 30_000;
const POLL_MS = 2500;

const rand = (lo: number, hi: number) => Math.round(lo + Math.random() * (hi - lo));
const clock = () => new Date().toTimeString().slice(0, 8);

type Scenario = {
  name: string;
  icon: string;
  level: "CRÍTICO" | "ATENCIÓN";
  desc: string;
  payload: string;
  run: () => PromiseLike<{ error: unknown }>;
};

// 10 · Panel de escenarios (desktop, solo demo). Every button goes through ingest_*;
// the SQL rules engine decides the alerts (AGENTS.md §3.1)
export default function ScenarioPanel() {
  const supabase = getSupabase();
  const [view, setView] = useState<ContactView | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [simOn, setSimOn] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const seenAlerts = useRef<Map<string, string | null> | null>(null);
  const seenMsgs = useRef<Set<string> | null>(null);
  const openedAt = useRef(new Date().toISOString());

  const push = useCallback((table: string, msg: string, color: string) => {
    setLog((l) => [{ id: crypto.randomUUID(), t: clock(), table, msg, color }, ...l].slice(0, 40));
  }, []);

  const configured = Boolean(DEMO_USER_ID && DEMO_CONTACT_TOKEN);

  // Poll alerts (via the contact view) and simulated WhatsApp messages to build the event log
  useEffect(() => {
    if (!configured) return;
    const tick = async () => {
      const [{ data: v }, { data: feed }] = await Promise.all([
        supabase.rpc("get_contact_view", { p_token: DEMO_CONTACT_TOKEN }),
        supabase.rpc("get_whatsapp_feed", { p_since: openedAt.current }),
      ]);
      const cv = v as unknown as ContactView | null;
      setView(cv);
      if (cv) {
        const first = seenAlerts.current === null;
        const seen = seenAlerts.current ?? new Map();
        for (const a of [...cv.alerts].reverse()) {
          if (!seen.has(a.id)) {
            if (!first) push("alerts", `level=${a.level} · ${a.message}`, COLORS.alerts);
          } else if (!seen.get(a.id) && a.ack_at && !first) {
            push("alerts", `status=ack · ${cv.patient.full_name?.split(" ")[0]} confirmó que está bien`, COLORS.ok);
          }
          seen.set(a.id, a.ack_at);
        }
        seenAlerts.current = seen;
      }
      const seenM = seenMsgs.current ?? new Set<string>();
      for (const m of feed ?? []) {
        if (!seenM.has(m.id)) push("outbound_messages", `whatsapp_sim → ${m.contact_name}`, COLORS.outbound);
        seenM.add(m.id);
      }
      seenMsgs.current = seenM;
    };
    tick();
    const t = setInterval(tick, POLL_MS);
    return () => clearInterval(t);
  }, [supabase, configured, push]);

  const ingest = useCallback(
    (moduleId: string, metric: string, value: number, unit: string, source: string) =>
      supabase.rpc("ingest_reading", { p_user_id: DEMO_USER_ID, p_module_id: moduleId, p_metric: metric, p_value: value, p_unit: unit, p_source: source }),
    [supabase],
  );

  const normalReadings = useCallback(async () => {
    const s = rand(118, 132);
    const d = rand(72, 82);
    const g = rand(98, 135);
    const hr = rand(64, 80);
    await Promise.all([
      supabase.rpc("ingest_bp", { p_user_id: DEMO_USER_ID, p_systolic: s, p_diastolic: d, p_source: "simulator" }),
      ingest("glucose", "mg_dl", g, "mg/dL", "simulator"),
      ingest("heart_rate", "bpm", hr, "lpm", "simulator"),
    ]);
    push("readings", `simulator · bp ${s}/${d} · glucose ${g} · bpm ${hr}`, COLORS.readings);
  }, [supabase, ingest, push]);

  // Background simulator: normal readings every 30 s while switched on
  useEffect(() => {
    if (!simOn || !configured) return;
    const t = setInterval(normalReadings, SIM_EVERY_MS);
    return () => clearInterval(t);
  }, [simOn, configured, normalReadings]);

  const scenarios: Scenario[] = [
    {
      name: "Crisis de presión",
      icon: "blood_pressure",
      level: "CRÍTICO",
      desc: "185/115 mmHg. Dispara alerta urgente y aviso al contacto.",
      payload: "ingest_bp · systolic=185 diastolic=115",
      run: () => supabase.rpc("ingest_bp", { p_user_id: DEMO_USER_ID, p_systolic: 185, p_diastolic: 115, p_source: "scenario" }),
    },
    {
      name: "Hipoglucemia",
      icon: "glucose",
      level: "CRÍTICO",
      desc: "Glucosa en 62 mg/dL, bajo el rango.",
      payload: "ingest_reading · glucose mg_dl=62",
      run: () => ingest("glucose", "mg_dl", 62, "mg/dL", "scenario"),
    },
    {
      name: "Dosis omitida",
      icon: "medication",
      level: "ATENCIÓN",
      desc: "Un remedio sin registrar por más de 30 min.",
      payload: "ingest_reading · pillbox dose_missed=1",
      run: () => ingest("pillbox", "dose_missed", 1, "dosis", "scenario"),
    },
    {
      name: "Taquicardia",
      icon: "cardiology",
      level: "CRÍTICO",
      desc: "138 lpm en reposo.",
      payload: "ingest_reading · heart_rate bpm=138",
      run: () => ingest("heart_rate", "bpm", 138, "lpm", "scenario"),
    },
  ];

  async function fire(s: Scenario) {
    setBusy(s.name);
    const before = view?.alerts[0]?.id;
    const { error } = await s.run();
    push("readings", error ? `error · ${s.name}` : `${s.payload} · source=scenario`, error ? COLORS.alerts : COLORS.readings);
    // The rules engine skips repeats for 10 min per module unless the level escalates
    setTimeout(async () => {
      const { data } = await supabase.rpc("get_contact_view", { p_token: DEMO_CONTACT_TOKEN });
      const latest = (data as unknown as ContactView | null)?.alerts[0]?.id;
      if (!error && latest === before) push("alerts", "sin alerta nueva (cooldown de 10 min por módulo)", COLORS.info);
      setBusy(null);
    }, 1500);
  }

  async function reset(mode: "full" | "onboarding") {
    setBusy(mode);
    const res = await fetch("/api/demo/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode }) });
    const body = await res.json().catch(() => ({}));
    push("reset_demo", res.ok ? `mode=${mode} · listo` : `error · ${body.error ?? res.status}`, res.ok ? COLORS.ok : COLORS.alerts);
    seenAlerts.current = null;
    setBusy(null);
  }

  const patient = view?.patient;
  const age = ageFrom(patient?.birth_date);

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="flex min-h-[72px] flex-wrap items-center justify-between gap-4 bg-ink px-8 py-3 text-canvas">
        <div className="flex items-center gap-3">
          <span className="h-4 w-4 rounded-full bg-brand" />
          <span className="text-body-lg font-extrabold">Vesta Care</span>
          <span className="rounded-md bg-brand px-2.5 py-1 font-mono text-[0.875rem] font-semibold text-ink">MODO DEMO</span>
        </div>
        <nav className="flex flex-wrap gap-5 text-body">
          <Link href="/" target="_blank" className="text-canvas underline underline-offset-4">
            Abrir PWA
          </Link>
          {DEMO_CONTACT_TOKEN && (
            <Link href={`/c/${DEMO_CONTACT_TOKEN}`} target="_blank" className="text-canvas underline underline-offset-4">
              Vista del contacto
            </Link>
          )}
          <Link href="/demo/whatsapp" target="_blank" className="text-canvas underline underline-offset-4">
            /demo/whatsapp
          </Link>
        </nav>
      </header>

      {!configured && (
        <p className="m-8 rounded-card bg-warn-soft p-5 text-body text-warn">
          Falta configurar NEXT_PUBLIC_DEMO_USER_ID y NEXT_PUBLIC_DEMO_CONTACT_TOKEN en .env.local.
        </p>
      )}

      <div className="grid gap-8 p-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-5 rounded-[20px] border border-line bg-surface px-6 py-5">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sunken text-body-lg font-extrabold">{initials(patient?.full_name)}</span>
            <div className="flex flex-1 flex-col">
              <span className="text-body-lg font-extrabold">
                {patient?.full_name ?? "Paciente demo"}
                {age ? ` · ${age}` : ""}
              </span>
              <span className="text-body text-ink-muted">
                {view?.modules.map((m) => moduleUi(m.module_id).short).join(" · ") || "Sin módulos activos"}
                {view ? ` · Contacto: ${view.contact.name} (${view.contact.relation ?? "contacto"})` : ""}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSimOn((s) => !s)}
              aria-pressed={simOn}
              className="flex min-h-14 cursor-pointer items-center gap-2.5 rounded-btn border-2 border-line px-4 text-body"
            >
              <span className={`h-2.5 w-2.5 rounded-full ${simOn ? "bg-ok" : "bg-line-strong"}`} />
              {simOn ? "Simulador generando lecturas cada 30 s" : "Simulador detenido"}
            </button>
          </div>

          <h2 className="text-body-lg font-extrabold">Disparar escenario</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {scenarios.map((s, i) => {
              const crit = s.level === "CRÍTICO";
              return (
                <button
                  key={s.name}
                  type="button"
                  disabled={!configured || busy !== null}
                  onClick={() => fire(s)}
                  className={`flex min-h-[168px] cursor-pointer flex-col gap-2.5 rounded-[20px] border-2 p-[22px] text-left text-ink hover:border-ink disabled:cursor-default disabled:opacity-60 ${
                    i === 0 ? "border-crit bg-crit-soft" : "border-line bg-surface"
                  }`}
                >
                  <span className="flex w-full items-center justify-between">
                    <Icon name={s.icon} size="2rem" className={crit ? "text-crit" : "text-warn"} />
                    <span className={`font-mono text-[0.875rem] font-semibold ${crit ? "text-crit" : "text-warn"}`}>{busy === s.name ? "ENVIANDO…" : s.level}</span>
                  </span>
                  <span className="text-title font-extrabold">{s.name}</span>
                  <span className="text-small text-ink-muted">{s.desc}</span>
                  <span className="font-mono text-[0.875rem] text-ink-subtle">{s.payload}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              disabled={!configured || busy !== null}
              onClick={normalReadings}
              className="flex min-h-14 cursor-pointer items-center gap-2.5 rounded-2xl border-2 border-primary px-6 text-body font-bold text-primary disabled:opacity-60"
            >
              <Icon name="restart_alt" size="1.5rem" />
              Enviar lecturas normales
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => reset("full")}
              className="flex min-h-14 cursor-pointer items-center gap-2.5 rounded-2xl border-2 border-primary px-6 text-body font-bold text-primary disabled:opacity-60"
            >
              <Icon name="history" size="1.5rem" />
              Reiniciar demo (7 días de historia)
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => reset("onboarding")}
              className="flex min-h-14 cursor-pointer items-center gap-2.5 rounded-2xl border-2 border-line-strong px-6 text-body font-bold text-ink-muted disabled:opacity-60"
            >
              <Icon name="upload_file" size="1.5rem" />
              Reiniciar antes de la ficha
            </button>
          </div>
        </div>

        <aside className="flex flex-col gap-3.5 rounded-[20px] bg-ink p-6 text-backdrop">
          <div className="flex items-center justify-between">
            <span className="text-body font-extrabold text-canvas">Eventos en tiempo real</span>
            <span className="font-mono text-[0.8rem] text-line-strong">cada {POLL_MS / 1000} s</span>
          </div>
          {!log.length && <p className="font-mono text-[0.875rem] text-line-strong">Esperando eventos…</p>}
          {log.map((l) => (
            <div key={l.id} className="grid grid-cols-[76px_1fr] gap-2.5 border-t border-[#3A342C] pt-2.5 font-mono text-[0.875rem] leading-normal">
              <span className="text-line-strong">{l.t}</span>
              <span className="flex flex-col">
                <span className="font-semibold" style={{ color: l.color }}>
                  {l.table}
                </span>
                <span>{l.msg}</span>
              </span>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
