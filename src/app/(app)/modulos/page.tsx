"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ScreenSkeleton, useCare } from "@/components/CareProvider";
import { Icon } from "@/components/ui";
import { manifestOf } from "@/lib/data";
import { moduleUi, sortModules } from "@/lib/modules";
import { getSupabase } from "@/lib/supabase/client";
import { getTextScale, setTextScale, TEXT_SCALES, type TextScale } from "@/lib/text-scale";

function ModuleIcon({ icon, muted }: { icon: string; muted?: boolean }) {
  return (
    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${muted ? "bg-canvas" : "bg-sunken"}`}>
      <Icon name={icon} size="1.75rem" className={muted ? "text-ink-muted" : "text-primary"} />
    </span>
  );
}

// 07 · Catálogo de módulos
export default function Catalog() {
  const router = useRouter();
  const { data, userId, refresh } = useCare();
  const supabase = getSupabase();
  // Rendered only on the client (CareProvider waits for the session), so reading <html> is safe
  const [scale, setScale] = useState<TextScale>(getTextScale);
  const [busy, setBusy] = useState<string | null>(null);

  if (!data) return <ScreenSkeleton />;

  const enabled = new Set(data.userModules.filter((u) => u.enabled).map((u) => u.module_id));
  const all = sortModules(data.modules, (m) => m.id);
  const active = all.filter((m) => m.status === "active" && enabled.has(m.id));
  const available = all.filter((m) => m.status === "active" && !enabled.has(m.id));
  const soon = all.filter((m) => m.status === "proposed");

  async function activate(moduleId: string) {
    setBusy(moduleId);
    await supabase.from("user_modules").upsert({ user_id: userId, module_id: moduleId, enabled: true, thresholds_source: "default", confirmed: true });
    await refresh();
    setBusy(null);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/bienvenida");
    router.refresh();
  }

  const row = "flex min-h-20 items-center gap-3.5 rounded-[20px] p-4";

  return (
    <div className="flex flex-col pb-8">
      <header className="flex flex-col gap-2 px-6 pt-6">
        <h1 className="text-h1 font-extrabold">Módulos</h1>
        <p className="text-body text-ink-muted">Conecte solo lo que necesita. Puede pausar un módulo cuando quiera.</p>
      </header>

      <h2 className="px-6 pt-6 pb-2.5 text-body-lg font-extrabold">Activos</h2>
      <div className="flex flex-col gap-3 px-6">
        {!active.length && <p className="text-body text-ink-muted">Todavía no tiene módulos activos.</p>}
        {active.map((m) => {
          const ui = moduleUi(m.id);
          return (
            <div key={m.id} className={`${row} border border-line bg-surface`}>
              <ModuleIcon icon={ui.icon} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-body-lg font-bold">{ui.name}</span>
                <span className="flex items-center gap-1.5 text-body font-bold text-ok">
                  <Icon name="check_circle" fill size="1.25rem" />
                  {ui.device} simulado
                </span>
              </div>
              <Link
                href={m.id === "pillbox" ? "/pastillero" : `/modulos/${m.id}`}
                className="flex min-h-14 min-w-14 flex-col items-center justify-center gap-0.5 text-small font-bold text-primary"
              >
                <Icon name="tune" size="1.6rem" />
                Ver
              </Link>
            </div>
          );
        })}
      </div>

      {available.length > 0 && (
        <>
          <h2 className="px-6 pt-7 pb-2.5 text-body-lg font-extrabold">Disponibles</h2>
          <div className="flex flex-col gap-3 px-6">
            {available.map((m) => {
              const ui = moduleUi(m.id);
              return (
                <div key={m.id} className={`${row} border border-line bg-surface`}>
                  <ModuleIcon icon={ui.icon} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-body-lg font-bold">{ui.name}</span>
                    <span className="text-body text-ink-muted">{manifestOf(m)?.expectedFrequency ?? ui.blurb}</span>
                  </div>
                  <button
                    type="button"
                    disabled={busy === m.id}
                    onClick={() => activate(m.id)}
                    className="min-h-14 cursor-pointer rounded-btn border-2 border-primary px-4 text-body font-bold text-primary active:bg-primary-soft disabled:opacity-45"
                  >
                    Activar
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      <h2 className="px-6 pt-7 pb-2.5 text-body-lg font-extrabold">Próximamente</h2>
      <div className="flex flex-col gap-3 px-6">
        {soon.map((m) => {
          const ui = moduleUi(m.id);
          return (
            <div key={m.id} className={`${row} bg-sunken`}>
              <ModuleIcon icon={ui.icon} muted />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-body-lg font-bold">{ui.name}</span>
                <span className="text-body text-ink-muted">{ui.blurb}</span>
              </div>
              <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full border-[1.5px] border-ink-subtle px-3 text-small font-bold text-ink-muted">
                <Icon name="schedule" size="1.15rem" />
                Pronto
              </span>
            </div>
          );
        })}
      </div>

      <h2 className="px-6 pt-8 pb-2.5 text-body-lg font-extrabold">Tamaño de la letra</h2>
      <div className="grid grid-cols-3 gap-3 px-6" role="radiogroup" aria-label="Tamaño de la letra">
        {TEXT_SCALES.map((s) => (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={scale === s.value}
            onClick={() => {
              setTextScale(s.value);
              setScale(s.value);
            }}
            className={`min-h-14 cursor-pointer rounded-btn border-2 px-2 text-body font-bold ${
              scale === s.value ? "border-primary bg-primary text-white" : "border-primary bg-surface text-primary"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="px-6 pt-8">
        <button type="button" onClick={signOut} className="flex min-h-14 cursor-pointer items-center gap-2 text-body-lg font-bold text-primary underline underline-offset-4">
          <Icon name="logout" size="1.6rem" />
          Salir de mi cuenta
        </button>
      </div>
    </div>
  );
}
