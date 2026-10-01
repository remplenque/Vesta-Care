"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";
import type { PersonaState } from "@/lib/demo-server";
import { DEMO_USER_ID } from "@/lib/demo";
import { moduleUi, sortModules } from "@/lib/modules";
import { PERSONAS, type Persona, type PersonaKey } from "@/lib/personas";
import { displayMobile } from "@/lib/phone";
import { getSupabase } from "@/lib/supabase/client";
import { ageFrom, firstName, initials, timeAgo } from "@/lib/time";

type LogEntry = { id: string; t: string; table: string; msg: string; color: string };

const COLORS = { readings: "#9FC2E6", alerts: "#F0A49A", outbound: "#E8C48A", ok: "#9FD3A8", info: "#C9C1B5" };
const POLL_MS = 3000;
// The live simulator runs inside Supabase (pg_cron, migration 08_device_simulator), not in this tab
const SIM_EVERY_S = 5;

type SimRow = { persona: string; active: boolean; emergency_since: string | null; last_tick: string | null };

const clock = () => new Date().toTimeString().slice(0, 8);

const PROFILE_STYLE: Record<Persona["profile"], { chip: string; icon: string }> = {
  stable: { chip: "bg-ok-soft text-ok", icon: "check_circle" },
  unstable: { chip: "bg-crit-soft text-crit", icon: "warning" },
  new: { chip: "bg-primary-soft text-primary", icon: "person_add" },
};

type Scenario = {
  name: string;
  icon: string;
  moduleId: string;
  level: "CRÍTICO" | "ATENCIÓN";
  desc: string;
  payload: string;
  run: (userId: string) => PromiseLike<{ error: unknown }>;
};

// 10 · Panel de escenarios (desktop, solo demo). Three simulated users run side by side; every
// reading goes through ingest_* and the SQL rules engine decides the alerts (AGENTS.md §3.1)
export default function ScenarioPanel() {
  const supabase = getSupabase();
  const [states, setStates] = useState<PersonaState[] | null>(null);
  const [stateError, setStateError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PersonaKey>("luis");
  const [sim, setSim] = useState<SimRow[] | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const seenAlerts = useRef<Partial<Record<PersonaKey, Map<string, string | null>>>>({});
  const seenMsgs = useRef<Set<string> | null>(null);
  const seenEmergency = useRef<Partial<Record<string, string | null>>>({});
  const openedAt = useRef(new Date().toISOString());

  const push = useCallback((table: string, msg: string, color: string) => {
    setLog((l) => [{ id: crypto.randomUUID(), t: clock(), table, msg, color }, ...l].slice(0, 60));
  }, []);

  const loadStates = useCallback(async () => {
    const res = await fetch("/api/demo/state", { cache: "no-store" });
    const body = (await res.json().catch(() => ({}))) as { personas?: PersonaState[]; error?: string };
    if (!res.ok) {
      setStateError(body.error ?? `HTTP ${res.status}`);
      return null;
    }
    setStateError(null);
    setStates(body.personas ?? []);
    return body.personas ?? [];
  }, []);

  // Poll the personas (alerts, acks, latest vitals) and the simulated WhatsApp feed for the event log
  useEffect(() => {
    const tick = async () => {
      const [personas, { data: feed }, { data: simRows }] = await Promise.all([
        loadStates(),
        supabase.rpc("get_whatsapp_feed", { p_since: openedAt.current }),
        supabase.rpc("sim_status"),
      ]);

      if (simRows) {
        setSim(simRows);
        for (const r of simRows) {
          const who = firstName(PERSONAS.find((p) => p.key === r.persona)?.fullName);
          const prev = seenEmergency.current[r.persona];
          if (prev !== undefined && !prev && r.emergency_since) push(`simulator · ${who}`, "emergencia en curso: abrió la app", COLORS.alerts);
          if (prev && !r.emergency_since) push(`simulator · ${who}`, "emergencia terminada: lecturas de vuelta en rango", COLORS.ok);
          seenEmergency.current[r.persona] = r.emergency_since;
        }
      }

      for (const s of personas ?? []) {
        const who = firstName(PERSONAS.find((p) => p.key === s.key)?.fullName);
        const prev = seenAlerts.current[s.key];
        const seen = new Map<string, string | null>();
        for (const a of [...s.alerts].reverse()) {
          if (prev && !prev.has(a.id)) push(`alerts · ${who}`, `level=${a.level} · ${a.message}`, COLORS.alerts);
          else if (prev && !prev.get(a.id) && a.ack_at) push(`alerts · ${who}`, `status=ack · ${who} confirmó que está bien`, COLORS.ok);
          seen.set(a.id, a.ack_at);
        }
        seenAlerts.current[s.key] = seen;
      }

      const seenM = seenMsgs.current ?? new Set<string>();
      for (const m of feed ?? []) {
        if (!seenM.has(m.id)) push("outbound_messages", `whatsapp_sim → ${m.contact_name} (${firstName(m.patient_name)})`, COLORS.outbound);
        seenM.add(m.id);
      }
      seenMsgs.current = seenM;
    };
    tick();
    const t = setInterval(tick, POLL_MS);
    return () => clearInterval(t);
  }, [supabase, loadStates, push]);

  const active = Object.fromEntries(PERSONAS.map((p) => [p.key, sim?.find((r) => r.persona === p.key)?.active ?? false])) as Record<PersonaKey, boolean>;
  const simOn = PERSONAS.some((p) => active[p.key]);
  const lastTickAt = sim?.map((r) => r.last_tick).filter(Boolean).sort().at(-1) ?? null;

  /** Pauses or resumes the Supabase simulator for some personas */
  async function setSimActive(keys: PersonaKey[], value: boolean) {
    await Promise.all(keys.map((k) => supabase.rpc("sim_set_active", { p_persona: k, p_active: value })));
    const { data } = await supabase.rpc("sim_status");
    if (data) setSim(data);
    push("simulator", `${value ? "activado" : "pausado"} · ${keys.map((k) => firstName(PERSONAS.find((p) => p.key === k)?.fullName)).join(", ")}`, COLORS.info);
  }

  const persona = PERSONAS.find((p) => p.key === selected)!;
  const state = states?.find((s) => s.key === selected);
  // Without the service key the panel can still fire scenarios at Luis
  const targetId = state?.userId ?? (selected === "luis" ? DEMO_USER_ID : "");
  const contactToken = state?.contacts[0]?.token;

  const ingest = (userId: string, moduleId: string, metric: string, value: number, unit: string) =>
    supabase.rpc("ingest_reading", { p_user_id: userId, p_module_id: moduleId, p_metric: metric, p_value: value, p_unit: unit, p_source: "scenario" });

  const scenarios: Scenario[] = [
    {
      name: "Crisis de presión",
      icon: "blood_pressure",
      moduleId: "bp",
      level: "CRÍTICO",
      desc: "185/115 mmHg. Dispara alerta urgente y aviso al contacto.",
      payload: "ingest_bp · systolic=185 diastolic=115",
      run: (id) => supabase.rpc("ingest_bp", { p_user_id: id, p_systolic: 185, p_diastolic: 115, p_source: "scenario" }),
    },
    {
      name: "Hipoglucemia",
      icon: "glucose",
      moduleId: "glucose",
      level: "CRÍTICO",
      desc: "Glucosa en 62 mg/dL, bajo el rango.",
      payload: "ingest_reading · glucose mg_dl=62",
      run: (id) => ingest(id, "glucose", "mg_dl", 62, "mg/dL"),
    },
    {
      name: "Dosis omitida",
      icon: "medication",
      moduleId: "pillbox",
      level: "ATENCIÓN",
      desc: "Un remedio sin registrar por más de 30 min.",
      payload: "ingest_reading · pillbox dose_missed=1",
      run: (id) => ingest(id, "pillbox", "dose_missed", 1, "dosis"),
    },
    {
      name: "Taquicardia",
      icon: "cardiology",
      moduleId: "heart_rate",
      level: "CRÍTICO",
      desc: "138 lpm en reposo.",
      payload: "ingest_reading · heart_rate bpm=138",
      run: (id) => ingest(id, "heart_rate", "bpm", 138, "lpm"),
    },
  ];

  async function fire(s: Scenario) {
    if (!targetId) return;
    setBusy(s.name);
    const who = firstName(persona.fullName);
    const before = state?.alerts[0]?.id;
    const { error } = await s.run(targetId);
    push(`readings · ${who}`, error ? `error · ${s.name}` : `${s.payload} · source=scenario`, error ? COLORS.alerts : COLORS.readings);
    // The rules engine skips repeats for 10 min per module unless the level escalates
    setTimeout(async () => {
      const latest = (await loadStates())?.find((x) => x.key === selected)?.alerts[0]?.id;
      if (!error && latest === before) push(`alerts · ${who}`, "sin alerta nueva (cooldown de 10 min por módulo)", COLORS.info);
      setBusy(null);
    }, 1500);
  }

  async function reset(mode: "full" | "onboarding") {
    setBusy(`reset-${mode}`);
    const who = firstName(persona.fullName);
    const res = await fetch("/api/demo/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ persona: selected, mode }) });
    const body = await res.json().catch(() => ({}));
    push(`reset_demo · ${who}`, res.ok ? `mode=${body.mode ?? mode} · listo` : `error · ${body.error ?? res.status}`, res.ok ? COLORS.ok : COLORS.alerts);
    delete seenAlerts.current[selected];
    await loadStates();
    setBusy(null);
  }

  const resets: { mode: "full" | "onboarding"; label: string; icon: string; primary: boolean }[] =
    persona.profile === "new"
      ? [{ mode: "onboarding", label: "Reiniciar como cuenta nueva", icon: "person_add", primary: true }]
      : persona.profile === "unstable"
        ? [{ mode: "full", label: "Reiniciar (7 días de historia)", icon: "history", primary: true }]
        : [
            { mode: "full", label: "Reiniciar (7 días de historia)", icon: "history", primary: true },
            { mode: "onboarding", label: "Reiniciar antes de la ficha", icon: "upload_file", primary: false },
          ];

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
          {contactToken && (
            <Link href={`/c/${contactToken}`} target="_blank" className="text-canvas underline underline-offset-4">
              Vista del contacto de {firstName(persona.fullName)}
            </Link>
          )}
          <Link href="/demo/whatsapp" target="_blank" className="text-canvas underline underline-offset-4">
            /demo/whatsapp
          </Link>
        </nav>
      </header>

      {stateError && (
        <p role="alert" className="mx-8 mt-8 rounded-card bg-warn-soft p-5 text-body text-warn">
          Los datos de las personas no están disponibles: {stateError}. Configura SUPABASE_SERVICE_ROLE_KEY (solo servidor). El simulador sigue
          corriendo en Supabase y los escenarios funcionan para Luis.
        </p>
      )}

      <div className="grid gap-8 p-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-body-lg font-extrabold">Usuarios simulados</h2>
            <button
              type="button"
              onClick={() => setSimActive(PERSONAS.map((p) => p.key), !simOn)}
              disabled={!sim}
              aria-pressed={simOn}
              className="flex min-h-14 cursor-pointer items-center gap-2.5 rounded-btn border-2 border-line bg-surface px-4 text-body disabled:cursor-default disabled:opacity-60"
            >
              <span className={`h-2.5 w-2.5 rounded-full ${simOn ? "bg-ok" : "bg-line-strong"}`} />
              {simOn ? `Simulador en Supabase · cada ${SIM_EVERY_S} s` : "Simulador en pausa"}
              {simOn && lastTickAt && <span className="font-mono text-[0.875rem] text-ink-subtle">último {new Date(lastTickAt).toTimeString().slice(0, 8)}</span>}
            </button>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            {PERSONAS.map((p) => (
              <PersonaCard
                key={p.key}
                persona={p}
                state={states?.find((s) => s.key === p.key)}
                selected={selected === p.key}
                active={active[p.key]}
                simOn={simOn}
                onSelect={() => setSelected(p.key)}
                onToggle={() => setSimActive([p.key], !active[p.key])}
              />
            ))}
          </div>

          <h2 className="text-body-lg font-extrabold">Disparar escenario a {persona.fullName}</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {scenarios.map((s, i) => {
              const crit = s.level === "CRÍTICO";
              const missingModule = state ? !state.modules.includes(s.moduleId) : false;
              return (
                <button
                  key={s.name}
                  type="button"
                  disabled={!targetId || missingModule || busy !== null}
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
                  <span className="text-small text-ink-muted">{missingModule ? `${firstName(persona.fullName)} no tiene activo el módulo ${moduleUi(s.moduleId).short}.` : s.desc}</span>
                  <span className="font-mono text-[0.875rem] text-ink-subtle">{s.payload}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {resets.map((r) => (
              <button
                key={r.mode}
                type="button"
                disabled={busy !== null}
                onClick={() => reset(r.mode)}
                className={`flex min-h-14 cursor-pointer items-center gap-2.5 rounded-2xl border-2 px-6 text-body font-bold disabled:opacity-60 ${
                  r.primary ? "border-primary text-primary" : "border-line-strong text-ink-muted"
                }`}
              >
                <Icon name={r.icon} size="1.5rem" />
                {busy === `reset-${r.mode}` ? "Reiniciando…" : r.label}
              </button>
            ))}
            {state?.email && (
              <span className="text-body text-ink-muted">
                PWA: entrar con el celular <span className="font-mono">{displayMobile(persona.loginPhone)}</span>
              </span>
            )}
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

function PersonaCard({
  persona: p,
  state,
  selected,
  active,
  simOn,
  onSelect,
  onToggle,
}: {
  persona: Persona;
  state?: PersonaState;
  selected: boolean;
  active: boolean;
  simOn: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const style = PROFILE_STYLE[p.profile];
  const age = ageFrom(p.birthDate);
  const open = state?.alerts.filter((a) => a.status === "open") ?? [];
  const crit = open.some((a) => a.level === "critical");
  const modules = sortModules(state?.modules ?? [], (m) => m);

  return (
    <div className={`flex flex-col gap-3 rounded-[20px] border-2 bg-surface p-5 ${selected ? "border-ink" : "border-line"}`}>
      <button type="button" onClick={onSelect} aria-pressed={selected} className="flex min-h-14 cursor-pointer items-center gap-3 text-left">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sunken text-body font-extrabold">{initials(p.fullName)}</span>
        <span className="flex flex-col">
          <span className="text-body-lg font-extrabold">{p.fullName}</span>
          <span className="text-body text-ink-muted">{age ? `${age} años` : ""}</span>
        </span>
      </button>

      <span className={`inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-small font-bold ${style.chip}`}>
        <Icon name={style.icon} size="1.1rem" />
        {p.label}
      </span>
      <p className="text-small text-ink-muted">{p.blurb}</p>

      {!state?.userId ? (
        <p className="text-body text-ink-muted">Cuenta sin crear. Selecciónala y usa “Reiniciar”.</p>
      ) : (
        <>
          <p className="text-body">{modules.length ? modules.map((m) => moduleUi(m).short).join(" · ") : "Sin módulos: falta el onboarding"}</p>
          {!!state.latest.length && (
            <p className="font-mono text-[0.875rem] text-ink-muted">
              {sortModules(state.latest, (l) => l.moduleId)
                .map((l) => `${moduleUi(l.moduleId).short} ${l.text}`)
                .join(" · ")}
              {state.lastReadingAt && ` · ${timeAgo(state.lastReadingAt)}`}
            </p>
          )}
          <p className={`text-body font-bold ${crit ? "text-crit" : open.length ? "text-warn" : "text-ok"}`}>
            {open.length ? `${open.length} alerta${open.length > 1 ? "s" : ""} abierta${open.length > 1 ? "s" : ""}` : "Sin alertas abiertas"}
          </p>
        </>
      )}

      <button
        type="button"
        onClick={onToggle}
        aria-pressed={active}
        className="mt-auto flex min-h-14 cursor-pointer items-center gap-2.5 rounded-btn border-2 border-line px-4 text-body"
      >
        <span className={`h-2.5 w-2.5 rounded-full ${active && simOn ? "bg-ok" : "bg-line-strong"}`} />
        {active ? "Incluido en el simulador" : "Pausado en el simulador"}
      </button>
    </div>
  );
}
