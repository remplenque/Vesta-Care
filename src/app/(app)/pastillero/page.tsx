"use client";

import { useState } from "react";
import { ScreenSkeleton, useCare } from "@/components/CareProvider";
import { Button, Icon, ProgressBar, SimulatedNote, Toast } from "@/components/ui";
import { medLabel, todaySlots, type DoseSlot } from "@/lib/pillbox";
import { getSupabase } from "@/lib/supabase/client";
import { formatTime } from "@/lib/time";

type Row = { time: string; slots: DoseSlot[] };

function TimeRail({ time, highlight, last }: { time: string; highlight?: boolean; last?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-body ${highlight ? "font-extrabold text-primary" : "font-bold"}`}>{time}</span>
      {!last && <div className="mt-2 w-0.5 flex-1 bg-track-off" />}
    </div>
  );
}

// 04 · Pastillero
export default function Pillbox() {
  const { data, tz, userId, refresh } = useCare();
  const supabase = getSupabase();
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; readingId: string } | null>(null);
  if (!data) return <ScreenSkeleton />;

  const now = new Date();
  const slots = todaySlots(data.medications, data.readings, tz, now);
  const taken = slots.filter((s) => s.status === "taken").length;
  const dueKey = slots.find((s) => s.status === "due")?.key;

  // Future doses at the same time share one card, like the design's "Más tarde"
  const rows: Row[] = [];
  for (const s of slots) {
    const prev = rows.at(-1);
    if (s.status === "later" && prev && prev.time === s.time && prev.slots.every((x) => x.status === "later")) prev.slots.push(s);
    else rows.push({ time: s.time, slots: [s] });
  }

  async function markTaken(slot: DoseSlot) {
    setBusy(slot.key);
    const { data: id, error } = await supabase.rpc("ingest_reading", {
      p_user_id: userId,
      p_module_id: "pillbox",
      p_metric: "dose_taken",
      p_value: 1,
      p_unit: "dosis",
      p_source: "manual",
      p_metadata: { medication_id: slot.medication.id, scheduled_for: slot.at.toISOString(), via: "app" },
    });
    setBusy(null);
    if (error || !id) return;
    setToast({ text: `${slot.medication.name} marcada como tomada`, readingId: id });
    refresh();
  }

  async function undo() {
    if (!toast) return;
    await supabase.from("readings").delete().eq("id", toast.readingId);
    setToast(null);
    refresh();
  }

  return (
    <div className="flex flex-col pb-6">
      <header className="flex flex-col gap-1 px-6 pt-6">
        <span className="text-body text-ink-muted">Hoy, {new Intl.DateTimeFormat("es-CL", { timeZone: tz, weekday: "long", day: "numeric" }).format(now)}</span>
        <h1 className="text-h1 font-extrabold">Pastillero</h1>
      </header>

      {slots.length > 0 && (
        <div className="mx-6 mt-4 flex flex-col gap-2">
          <div className="flex justify-between text-body">
            <span>Tomados hoy</span>
            <span className="font-extrabold">
              {taken} de {slots.length}
            </span>
          </div>
          <ProgressBar pct={(taken / slots.length) * 100} />
        </div>
      )}

      <div className="flex flex-col px-6 pt-6">
        {!slots.length && <p className="rounded-card bg-sunken p-5 text-body-lg">Todavía no hay remedios en su pastillero.</p>}
        {rows.map((row, i) => {
          const isLast = i === rows.length - 1;
          const first = row.slots[0];

          if (first.status === "later") {
            return (
              <div key={`${row.time}-later`} className="grid grid-cols-[64px_1fr] gap-3">
                <TimeRail time={row.time} last={isLast} />
                <div className="mb-3 flex flex-col gap-1 rounded-[20px] border border-dashed border-line-strong p-4">
                  {row.slots.map((s) => (
                    <span key={s.key} className="text-body-lg font-bold">
                      {medLabel(s.medication)}
                    </span>
                  ))}
                  <span className="flex items-center gap-1.5 text-body text-ink-muted">
                    <Icon name="schedule" size="1.4rem" />
                    Más tarde
                  </span>
                </div>
              </div>
            );
          }

          return (
            <div key={first.key} className="grid grid-cols-[64px_1fr] gap-3">
              <TimeRail time={row.time} highlight={first.key === dueKey} last={isLast} />
              {first.status === "taken" && (
                <div className="mb-3 flex items-center gap-3.5 rounded-[20px] border border-line bg-surface p-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ok text-white">
                    <Icon name="check" size="1.9rem" />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-body-lg font-bold">{medLabel(first.medication)}</span>
                    <span className="text-body font-bold text-ok">
                      Tomada {formatTime(first.takenAt!, tz)}
                      {first.late ? " · con atraso" : ""}
                    </span>
                  </span>
                </div>
              )}
              {first.status === "missed" && (
                <div className="mb-3 flex flex-col gap-3 rounded-[20px] border-2 border-warn-icon bg-surface p-4">
                  <div className="flex items-center gap-3.5">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-warn-soft text-warn">
                      <Icon name="help" size="1.9rem" />
                    </span>
                    <span className="flex flex-col">
                      <span className="text-body-lg font-bold">{medLabel(first.medication)}</span>
                      <span className="text-body font-bold text-warn">No quedó registrada</span>
                    </span>
                  </div>
                  <p className="text-body text-ink-muted">¿Se la tomó? Si no, no tome doble dosis.</p>
                  <Button variant="secondary" disabled={busy === first.key} onClick={() => markTaken(first)}>
                    Sí, me la tomé
                  </Button>
                </div>
              )}
              {first.status === "due" && (
                <div className={`mb-3 flex flex-col gap-3.5 rounded-[20px] bg-surface p-4 ${first.key === dueKey ? "border-2 border-primary" : "border border-line"}`}>
                  <span className="text-body-lg font-bold">{medLabel(first.medication)}</span>
                  <button
                    type="button"
                    disabled={busy === first.key}
                    onClick={() => markTaken(first)}
                    className="flex min-h-[72px] cursor-pointer items-center justify-center gap-3 rounded-btn bg-primary text-body-lg font-bold text-white active:bg-primary-hover disabled:opacity-45"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-white">
                      <Icon name="check" size="1.75rem" />
                    </span>
                    Marcar como tomada
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <SimulatedNote className="mt-2">Pastillero simulado</SimulatedNote>
      </div>

      {toast && (
        <Toast onClose={() => setToast(null)} action={{ label: "Deshacer", onClick: undo }}>
          {toast.text}
        </Toast>
      )}
    </div>
  );
}
