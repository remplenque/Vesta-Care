"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BrandSymbol, Icon } from "@/components/ui";
import { splitContactLink } from "@/lib/demo";
import { getSupabase } from "@/lib/supabase/client";
import { dayLabel, formatTime } from "@/lib/time";
import type { Database } from "@/types/supabase";

type FeedRow = Database["public"]["Functions"]["get_whatsapp_feed"]["Returns"][number];

const POLL_MS = 3000;

// 09 · /demo/whatsapp · Mensajería simulada. Nothing here is ever sent (AGENTS.md §3.7)
export default function WhatsappSim() {
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [contactId, setContactId] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = getSupabase();
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const load = () => supabase.rpc("get_whatsapp_feed", { p_since: since }).then(({ data }) => data && setRows(data));
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, []);

  const contacts = useMemo(() => {
    const m = new Map<string, { id: string; name: string; patient: string }>();
    rows.forEach((r) => r.contact_id && m.set(r.contact_id, { id: r.contact_id, name: r.contact_name, patient: r.patient_name }));
    return [...m.values()];
  }, [rows]);

  const active = contactId ?? contacts[0]?.id ?? null;
  const messages = rows.filter((r) => r.contact_id === active);
  const current = contacts.find((c) => c.id === active);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  return (
    <div className="flex min-h-dvh justify-center bg-backdrop">
      <div className="flex min-h-dvh w-full max-w-[430px] flex-col bg-[#EAE6E0]">
        <div className="sticky top-0 z-10 bg-[#2B2F36] text-white">
          <div className="flex items-center gap-3 px-4 pt-3 pb-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-canvas">
              <BrandSymbol className="h-7 w-7" />
            </span>
            <div className="flex flex-1 flex-col">
              <span className="text-body font-bold">Vesta Care · Alertas</span>
              <span className="text-[0.95rem] opacity-80">{current ? `Chat de ${current.name}` : "Sin mensajes todavía"}</span>
            </div>
            <span className="rounded-md bg-brand px-2 py-1 font-mono text-[0.8rem] font-semibold text-ink">SIMULADO</span>
          </div>
          {contacts.length > 1 && (
            <div className="flex gap-2 overflow-x-auto px-4 pb-3">
              {contacts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setContactId(c.id)}
                  className={`min-h-11 shrink-0 cursor-pointer rounded-full px-4 text-[0.95rem] font-bold ${c.id === active ? "bg-white text-ink" : "bg-white/15 text-white"}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mx-auto mt-3 rounded-[10px] bg-warn-soft px-3 py-1.5 text-center text-[0.9rem] text-warn">
          Simulador de WhatsApp: no se envía ningún mensaje real
        </div>

        <div className="flex flex-1 flex-col gap-2.5 px-3.5 py-4">
          {messages.map((m, i) => {
            const day = dayLabel(m.ts);
            const showDay = i === 0 || day !== dayLabel(messages[i - 1].ts);
            const { text, token } = splitContactLink(m.body);
            const urgent = m.body.startsWith("🚨");
            return (
              <div key={m.id} className="flex flex-col gap-2.5">
                {showDay && <div className="self-center rounded-[10px] bg-canvas px-3 py-1 text-[0.9rem] text-ink-muted">{day}</div>}
                <div className="flex max-w-[85%] flex-col gap-2 self-start rounded-[4px_16px_16px_16px] bg-white px-3 pt-2.5 pb-1.5 text-[1.0625rem] leading-snug">
                  {urgent && <span className="font-extrabold text-crit">ALERTA URGENTE · {m.patient_name}</span>}
                  <span>{urgent ? text.replace(/^🚨\s*Vesta Care:\s*/, "") : text}</span>
                  {token && (
                    <Link href={`/c/${token}`} className="flex flex-col overflow-hidden rounded-[10px] bg-[#F3F0EB] no-underline">
                      <span className="h-1.5 bg-crit" />
                      <span className="flex flex-col gap-0.5 px-3 py-2.5">
                        <span className="font-bold text-ink">Ver estado de {m.patient_name.split(" ")[0]} en vivo</span>
                        <span className="text-[0.9rem] text-ink-muted">/c/{token.slice(0, 8)}…</span>
                      </span>
                    </Link>
                  )}
                  <span className="self-end text-[0.8rem] text-ink-subtle">{formatTime(m.ts)}</span>
                </div>
              </div>
            );
          })}
          {!messages.length && (
            <p className="mt-10 text-center text-body text-ink-muted">Cuando se dispare una alerta urgente, el mensaje aparecerá aquí.</p>
          )}
          <div ref={bottom} />
        </div>

        <div className="sticky bottom-0 flex items-center gap-2 bg-[#EAE6E0] px-2.5 pt-2.5 pb-5">
          <div className="flex min-h-12 flex-1 items-center rounded-full bg-white px-[18px] text-[1.0625rem] text-ink-subtle">Solo lectura</div>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2B2F36] text-white" aria-hidden>
            <Icon name="mic" size="1.5rem" />
          </span>
        </div>
      </div>
    </div>
  );
}
