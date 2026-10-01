"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { firstName } from "@/lib/time";
import { useCare } from "./CareProvider";
import { Button, Icon, Sheet, SimulatedNote } from "./ui";

// Panic button, always visible on the left of the bottom bar. Asks first (docs/ACCESSIBILITY.md
// §6: confirmation with buttons that say the action) so a stray tap never raises an alarm.
// On "Sí, pedir ayuda" it goes through the same path as any device: a reading of the SOS module
// (sos_pressed = 1, source 'manual') that the SQL rules engine always turns into a critical alert,
// with a simulated WhatsApp to every emergency contact (AGENTS.md §3.1, §3.7).

// Bottom-bar icons grow with the text size, up to a cap that keeps the bar in one row
export const BAR_ICON = "clamp(28px,1.9rem,34px)";

function joinNames(names: string[]) {
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} y ${names.at(-1)}` : (names[0] ?? "");
}

export function PanicButton() {
  const router = useRouter();
  const { userId, data } = useCare();
  const [asking, setAsking] = useState(false);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const names = (data?.contacts ?? []).map((c) => firstName(c.name));

  useEffect(() => {
    if (!asking) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !sending && setAsking(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [asking, sending]);

  async function askForHelp() {
    setSending(true);
    setFailed(false);
    const supabase = getSupabase();
    const { error } = await supabase.rpc("ingest_reading", {
      p_user_id: userId,
      p_module_id: "sos",
      p_metric: "sos_pressed",
      p_value: 1,
      p_unit: "evento",
      p_source: "manual",
    });
    if (error) {
      setSending(false);
      setFailed(true);
      return;
    }
    // The new alert (or the one still open: the engine waits 10 min before repeating) opens on its
    // own through CareProvider's Realtime; this is the fallback if that hasn't happened yet
    const { data: alert } = await supabase
      .from("alerts")
      .select("id")
      .eq("user_id", userId)
      .eq("module_id", "sos")
      .order("ts", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSending(false);
    setAsking(false);
    setTimeout(() => {
      if (alert && !window.location.pathname.startsWith("/alerta/")) router.push(`/alerta/${alert.id}`);
    }, 1200);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAsking(true)}
        aria-haspopup="dialog"
        className="flex min-h-16 min-w-[68px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-btn border-2 border-crit-deep bg-crit px-[10px] font-extrabold text-white active:bg-crit-deep"
      >
        <Icon name="sos" fill size={BAR_ICON} />
        Ayuda
      </button>

      {asking && (
        <Sheet onClose={() => !sending && setAsking(false)}>
          <h2 className="flex items-center gap-2 text-h1 font-extrabold text-crit">
            <Icon name="sos" fill size="2.25rem" />
            ¿Pide ayuda ahora?
          </h2>
          <p className="text-body-lg text-pretty">
            {names.length
              ? `Avisaré de inmediato a ${joinNames(names)} y verán cómo está.`
              : "Todavía no tiene contactos de emergencia. Si es urgente, llame al 131."}
          </p>
          <SimulatedNote>WhatsApp simulado: no se envía ningún mensaje real</SimulatedNote>
          {failed && (
            <p role="alert" className="rounded-btn bg-warn-soft p-4 text-body text-warn">
              No pude avisar. ¿Lo intentamos de nuevo? Si es urgente, llame al 131.
            </p>
          )}
          <Button variant="danger" icon="sos" onClick={askForHelp} disabled={sending}>
            {sending ? "Avisando…" : "Sí, pedir ayuda"}
          </Button>
          <a
            href="tel:131"
            className="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-btn border-2 border-crit px-5 text-body-lg font-bold text-crit active:bg-crit-soft"
          >
            <Icon name="call" size="1.75rem" />
            Llamar al 131
          </a>
          <Button variant="muted" onClick={() => setAsking(false)} disabled={sending} autoFocus>
            No, volver
          </Button>
        </Sheet>
      )}
    </>
  );
}
