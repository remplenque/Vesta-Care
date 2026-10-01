"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useCare, ScreenSkeleton } from "@/components/CareProvider";
import { StepHeader } from "@/components/StepHeader";
import { Button, Icon, MateoAvatar } from "@/components/ui";
import { manifestOf } from "@/lib/data";
import { asExtracted, formatTimes, parseTimes, suggestedModules, thresholdSummary, type ExtractedRecord } from "@/lib/ficha";
import { moduleUi, sortModules } from "@/lib/modules";
import { asThresholds, type Thresholds } from "@/lib/rules";
import { getSupabase } from "@/lib/supabase/client";

const row = "flex min-h-[72px] items-center justify-between gap-2 border-b border-line-soft last:border-b-0";
const editBtn = "flex min-h-14 min-w-20 cursor-pointer items-center justify-end gap-1.5 text-body font-bold text-primary";
const field = "min-h-14 w-full rounded-[14px] border-2 border-line-strong bg-surface px-3 text-body-lg focus:border-primary";

function EditButton({ onClick, editing }: { onClick: () => void; editing: boolean }) {
  return (
    <button type="button" className={editBtn} onClick={onClick}>
      <Icon name={editing ? "check" : "edit"} size="1.4rem" />
      {editing ? "Listo" : "Editar"}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface px-5 py-2">
      <h2 className="pt-3 pb-1 text-body font-bold text-ink-muted">{title}</h2>
      {children}
    </section>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-14 w-full cursor-pointer items-center gap-2 text-body font-bold text-primary">
      <Icon name="add" size="1.5rem" />
      {label}
    </button>
  );
}

function ConfirmRecord() {
  const router = useRouter();
  const params = useSearchParams();
  const { userId, data, refresh } = useCare();
  const supabase = getSupabase();
  const recordId = params.get("record");

  const [record, setRecord] = useState<ExtractedRecord | null>(recordId ? null : { conditions: [], medications: [], thresholds: {} });
  const [fromFicha, setFromFicha] = useState(false);
  const [mods, setMods] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!recordId) return;
    supabase
      .from("medical_records")
      .select("extracted")
      .eq("id", recordId)
      .single()
      .then(({ data }) => {
        const r = asExtracted(data?.extracted);
        setRecord(r);
        setFromFicha(true);
        setMods(suggestedModules(r));
      });
  }, [supabase, recordId]);

  if (!record || !data) return <ScreenSkeleton />;

  const available = sortModules(
    data.modules.filter((m) => m.status === "active"),
    (m) => m.id,
  );
  const thresholdsOf = (id: string): Thresholds =>
    record.thresholds[id] ?? asThresholds(manifestOf(data.modules.find((m) => m.id === id))?.defaultThresholds);

  const update = (patch: Partial<ExtractedRecord>) => setRecord({ ...record, ...patch });
  const toggleMod = (id: string) => setMods((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));

  async function confirm() {
    if (!record) return;
    setSaving(true);
    setError(false);
    const conditions = record.conditions.map((c) => c.trim()).filter(Boolean);
    const meds = record.medications.filter((m) => m.name.trim());

    const steps = [
      () => supabase.from("conditions").delete().eq("user_id", userId),
      () =>
        conditions.length
          ? supabase.from("conditions").insert(conditions.map((name) => ({ user_id: userId, name, source: fromFicha ? "ficha" : "manual" })))
          : null,
      () => supabase.from("medications").delete().eq("user_id", userId),
      () =>
        meds.length
          ? supabase
              .from("medications")
              .insert(meds.map((m) => ({ user_id: userId, name: m.name.trim(), dose: m.dose.trim() || null, schedule: { times: m.times } })))
          : null,
      () =>
        mods.length
          ? supabase.from("user_modules").upsert(
              mods.map((id) => ({
                user_id: userId,
                module_id: id,
                enabled: true,
                thresholds: id === "pillbox" ? null : thresholdsOf(id),
                thresholds_source: record.thresholds[id] ? "ficha" : "default",
                confirmed: true,
              })),
            )
          : null,
      () => (recordId ? supabase.from("medical_records").update({ extracted: record, confirmed: true }).eq("id", recordId) : null),
    ];
    for (const step of steps) {
      const res = await step();
      if (res?.error) {
        setSaving(false);
        setError(true);
        return;
      }
    }
    await refresh();
    router.push("/onboarding/contactos");
  }

  return (
    <>
      <StepHeader step={2} back="/onboarding/ficha" />
      <div className="flex items-start gap-3 px-6 pt-6">
        <MateoAvatar size={44} />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-h1 font-extrabold">{fromFicha ? "Esto es lo que entendí" : "Cuénteme de su salud"}</h1>
          <p className="text-body text-ink-muted">{fromFicha ? "Revise cada punto. Si algo no calza, corríjalo." : "Agregue sus condiciones y sus remedios."}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-6 pt-5">
        <Section title="Condiciones">
          {record.conditions.map((c, i) => {
            const key = `c${i}`;
            return (
              <div key={key} className={row}>
                {editing === key ? (
                  <input
                    className={field}
                    autoFocus
                    value={c}
                    aria-label="Condición"
                    onChange={(e) => update({ conditions: record.conditions.map((x, j) => (j === i ? e.target.value : x)) })}
                  />
                ) : (
                  <span className="text-body-lg">{c || "Sin nombre"}</span>
                )}
                <EditButton editing={editing === key} onClick={() => setEditing(editing === key ? null : key)} />
              </div>
            );
          })}
          <AddButton
            label="Agregar condición"
            onClick={() => {
              update({ conditions: [...record.conditions, ""] });
              setEditing(`c${record.conditions.length}`);
            }}
          />
        </Section>

        <Section title="Medicamentos">
          {record.medications.map((m, i) => {
            const key = `m${i}`;
            const setMed = (patch: Partial<typeof m>) =>
              update({ medications: record.medications.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div key={key} className={row}>
                {editing === key ? (
                  <div className="flex flex-1 flex-col gap-2 py-3">
                    <input className={field} autoFocus value={m.name} aria-label="Nombre del remedio" onChange={(e) => setMed({ name: e.target.value })} />
                    <input className={field} value={m.dose} aria-label="Dosis" placeholder="50 mg" onChange={(e) => setMed({ dose: e.target.value })} />
                    <input
                      className={field}
                      defaultValue={m.times.join(", ")}
                      aria-label="Horarios"
                      placeholder="08:00, 20:00"
                      onBlur={(e) => setMed({ times: parseTimes(e.target.value) })}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <span className="text-body-lg">{[m.name, m.dose].filter(Boolean).join(" ") || "Sin nombre"}</span>
                    <span className="text-body text-ink-subtle">{m.times.length ? formatTimes(m.times) : "Sin horario"}</span>
                  </div>
                )}
                <EditButton editing={editing === key} onClick={() => setEditing(editing === key ? null : key)} />
              </div>
            );
          })}
          <AddButton
            label="Agregar remedio"
            onClick={() => {
              update({ medications: [...record.medications, { name: "", dose: "", times: [] }] });
              setEditing(`m${record.medications.length}`);
            }}
          />
        </Section>

        {mods.some((id) => id !== "pillbox") && (
          <Section title="Cuándo avisar">
            {mods
              .filter((id) => id !== "pillbox")
              .map((id) => (
                <div key={id} className={row}>
                  <div className="flex flex-col py-2">
                    <span className="text-body-lg">{moduleUi(id).short}</span>
                    <span className="text-body text-ink-subtle">{thresholdSummary(id, thresholdsOf(id))}</span>
                  </div>
                </div>
              ))}
          </Section>
        )}

        <section className="flex flex-col gap-3 rounded-card bg-primary-soft p-5">
          <h2 className="text-body font-bold">Mateo activará estos módulos</h2>
          <div className="flex flex-wrap gap-2.5">
            {available.map((m) => {
              const on = mods.includes(m.id);
              const ui = moduleUi(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleMod(m.id)}
                  className={`inline-flex min-h-14 cursor-pointer items-center gap-2 rounded-full pr-4 pl-3 text-body font-semibold ${
                    on ? "bg-surface text-ink" : "border-2 border-dashed border-line-strong text-ink-muted"
                  }`}
                >
                  <Icon name={on ? ui.icon : "add"} size="1.5rem" className="text-primary" />
                  {ui.short}
                  {on && <Icon name="check" size="1.3rem" className="text-ok" />}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-3 p-6">
        {error && (
          <p role="alert" className="rounded-btn bg-warn-soft p-4 text-body text-warn">
            No pude guardarlo. ¿Lo intentamos de nuevo?
          </p>
        )}
        <Button icon="check" onClick={confirm} disabled={saving || !mods.length}>
          {saving ? "Guardando…" : "Sí, está correcto"}
        </Button>
      </div>
    </>
  );
}

// 01c · Confirmar lo que Mateo extrajo
export default function ConfirmPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <ConfirmRecord />
    </Suspense>
  );
}
