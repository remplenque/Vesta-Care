"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ScreenSkeleton, useCare } from "@/components/CareProvider";
import { BackButton, Button, Icon, MateoAvatar, Sheet, StatusBadge } from "@/components/ui";
import { alertCopy } from "@/lib/alert-copy";
import type { Alert } from "@/lib/data";
import { moduleUi } from "@/lib/modules";
import { getSupabase } from "@/lib/supabase/client";
import { firstName, formatTime, timeAgo } from "@/lib/time";
import { thresholdsFor } from "@/lib/vitals";
import { HOME_PATH } from "@/lib/nav";

type Notified = { ts: string; contact: { name: string; relation: string | null } | null };

// 05 · Alerta (crítica o de atención) + 05b · Confirmar "Estoy bien"
export default function AlertScreen() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, tz, userId } = useCare();
  const supabase = getSupabase();
  const [alert, setAlert] = useState<Alert | null>(null);
  const [valueText, setValueText] = useState<string | null>(null);
  const [notified, setNotified] = useState<Notified[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: a } = await supabase.from("alerts").select("*").eq("id", id).maybeSingle();
      if (cancelled) return;
      if (!a) return setMissing(true);
      setAlert(a);

      // Blood pressure reads as systolic/diastolic from the same reading group
      let text = a.value != null ? String(Number(a.value)) : null;
      if (a.module_id === "bp" && a.reading_id) {
        const { data: r } = await supabase.from("readings").select("reading_group").eq("id", a.reading_id).maybeSingle();
        if (r?.reading_group) {
          const { data: pair } = await supabase.from("readings").select("metric, value").eq("reading_group", r.reading_group);
          const sys = pair?.find((p) => p.metric === "systolic")?.value;
          const dia = pair?.find((p) => p.metric === "diastolic")?.value;
          if (sys != null && dia != null) text = `${Number(sys)}/${Number(dia)}`;
        }
      }
      const { data: msgs } = await supabase
        .from("outbound_messages")
        .select("ts, contact:emergency_contacts(name, relation)")
        .eq("alert_id", a.id)
        .order("ts");
      if (cancelled) return;
      setValueText(text);
      setNotified((msgs as unknown as Notified[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, id]);

  if (missing) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <BackButton href={HOME_PATH} label="Inicio" />
        <p className="text-body-lg">No encontré esta alerta.</p>
      </div>
    );
  }
  if (!alert || !data) return <ScreenSkeleton />;

  const now = new Date();
  const critical = alert.level === "critical";
  const copy = alertCopy(alert, thresholdsFor(alert.module_id, data));
  const ui = moduleUi(alert.module_id);
  const contact = data.contacts.find((c) => c.phone) ?? data.contacts[0];
  const acked = alert.status === "ack";
  // Only the original alert messages, not the "está bien" follow-up
  const notifiedNames = [
    ...new Set(
      notified
        .slice(0, Math.max(1, data.contacts.length))
        .flatMap((n) => (n.contact ? [`${firstName(n.contact.name)}${n.contact.relation ? ` (${n.contact.relation})` : ""}`] : [])),
    ),
  ];

  async function imOk() {
    if (!alert) return;
    setSaving(true);
    const ackAt = new Date().toISOString();
    await supabase.from("alerts").update({ status: "ack", ack_at: ackAt }).eq("id", alert.id);
    // Simulated WhatsApp only: nothing real is ever sent (AGENTS.md §3.7)
    if (critical && data?.contacts.length) {
      const name = data.profile?.full_name ?? "Su familiar";
      await supabase.from("outbound_messages").insert(
        data.contacts.map((c) => ({
          user_id: userId,
          alert_id: alert.id,
          contact_id: c.id,
          body: `✅ Vesta Care: ${name} confirmó que está bien después de la alerta (${alert.message}).`,
        })),
      );
    }
    setSaving(false);
    setConfirming(false);
    setAlert({ ...alert, status: "ack", ack_at: ackAt });
  }

  const tone = critical
    ? { page: "bg-crit-deep text-white", sub: "opacity-90", pill: "bg-white text-crit-deep" }
    : { page: "bg-canvas text-ink", sub: "text-ink-muted", pill: "" };

  return (
    <div className={`flex min-h-dvh flex-col ${tone.page}`}>
      <div className="px-4 pt-2">
        <button type="button" onClick={() => router.push(HOME_PATH)} className="inline-flex min-h-14 cursor-pointer items-center gap-1.5 px-3 text-body font-bold">
          <Icon name="arrow_back" size="1.75rem" />
          Inicio
        </button>
      </div>

      <div className="flex flex-col gap-3.5 px-6 pt-2">
        {critical ? (
          <span className={`inline-flex min-h-11 items-center gap-2 self-start rounded-full pr-[18px] pl-3 text-body-lg font-extrabold ${tone.pill}`}>
            <Icon name="emergency" fill size="1.6rem" />
            Urgente
          </span>
        ) : (
          <StatusBadge status="warn" />
        )}
        <h1 className="text-lead font-bold">{copy.title}</h1>
        {alert.module_id !== "pillbox" && alert.module_id !== "sos" && valueText && (
          <div className="flex flex-wrap items-baseline gap-2.5">
            <span className="text-alarm font-extrabold tracking-tight">{valueText}</span>
            <span className="text-lead font-semibold">{ui.unit}</span>
          </div>
        )}
        <span className={`text-body ${tone.sub}`}>
          {alert.module_id === "sos" ? "Pedido" : "Medido"} {timeAgo(alert.ts, now)}
        </span>
      </div>

      <section className="mx-4 mt-6 flex flex-col gap-4 rounded-card bg-surface p-[22px] text-ink">
        <div className="flex items-start gap-3">
          <MateoAvatar size={44} />
          <p className="text-body-lg text-pretty">{alert.explanation ?? copy.explain}</p>
        </div>
        <h2 className="border-t border-line-soft pt-3.5 text-body font-extrabold">Qué hacer ahora</h2>
        <ol className="flex flex-col gap-3">
          {copy.steps.map((s, i) => (
            <li key={s} className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-crit-soft text-body font-extrabold text-crit-deep">{i + 1}</span>
              <span className="text-body-lg leading-snug">{s}</span>
            </li>
          ))}
        </ol>
      </section>

      {notified.length > 0 && (
        <div className={`mx-4 mt-4 flex items-center gap-3 rounded-btn px-[18px] py-3.5 ${critical ? "bg-white/15" : "bg-sunken"}`}>
          <Icon name="mark_chat_read" fill size="1.75rem" />
          <span className="text-body leading-snug">
            Ya avisamos a {notifiedNames.join(" y ")} · {formatTime(notified[0].ts, tz)}
          </span>
        </div>
      )}

      {acked && (
        <div className={`mx-4 mt-4 flex items-center gap-3 rounded-btn px-[18px] py-3.5 ${critical ? "bg-white text-ok" : "bg-ok-soft text-ok"}`}>
          <Icon name="check_circle" fill size="1.75rem" />
          <span className="text-body font-bold">Usted confirmó que está bien · {formatTime(alert.ack_at!, tz)}</span>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-3 px-4 pt-5 pb-6">
        {alert.module_id === "pillbox" ? (
          <Button href="/pastillero" icon="medication">
            Ir al pastillero
          </Button>
        ) : (
          <Button href="tel:131" variant={critical ? "inverse" : "danger"} icon="call" iconFill className="text-lead font-extrabold">
            Llamar al 131
          </Button>
        )}
        <div className="grid grid-cols-2 gap-3">
          {contact?.phone ? (
            <Button href={`tel:${contact.phone.replace(/\s+/g, "")}`} variant={critical ? "outline-inverse" : "secondary"} icon="call" className="text-body">
              Llamar a {firstName(contact.name)}
            </Button>
          ) : (
            <span />
          )}
          {acked ? (
            <Button href={HOME_PATH} variant={critical ? "outline-inverse" : "secondary"} icon="home" className="text-body">
              Ir al inicio
            </Button>
          ) : (
            <Button onClick={() => setConfirming(true)} variant={critical ? "outline-inverse" : "secondary"} icon="check" className="text-body">
              Estoy bien
            </Button>
          )}
        </div>
      </div>

      {confirming && (
        <Sheet dark={critical} onClose={() => setConfirming(false)}>
          <h2 className="mt-2 text-h1 font-extrabold text-ink">¿Se siente bien?</h2>
          <p className="text-body-lg text-ink-muted text-pretty">
            {critical && contact ? `Le diremos a ${firstName(contact.name)} que usted está bien. ` : ""}
            Le recomendamos medirse de nuevo en 10 minutos.
          </p>
          <Button icon="check" onClick={imOk} disabled={saving}>
            {saving ? "Un momento…" : "Sí, estoy bien"}
          </Button>
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            Volver a la alerta
          </Button>
        </Sheet>
      )}
    </div>
  );
}
