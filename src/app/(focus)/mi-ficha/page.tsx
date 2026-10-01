"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { savedPersona } from "@/components/CompanionPrompt";
import { GuideConversation, SwitchToTyping } from "@/components/GuideConversation";
import { useCare } from "@/components/CareProvider";
import { Brand, Button, Icon, ProgressBar, SimulatedNote } from "@/components/ui";
import { useGuide } from "@/hooks/useGuide";
import { asExtracted } from "@/lib/ficha";
import type { Persona } from "@/lib/mateo/prompt";
import { normalize } from "@/lib/mateo/safety";
import { getSupabase } from "@/lib/supabase/client";
import { firstName } from "@/lib/time";

// After the caregivers step: the medical record, guided by voice.
//   ask      → photo of the ficha / PDF / "No la tengo"
//   reading  → upload to Storage (medical-records/{uid}/) + medical_records row + /api/ficha/extract
//   list     → conditions: what the ficha found (to confirm) + what the person says or types; several
//   → saves to conditions (source "ficha" | "manual") and continues to /mis-remedios.
// Nothing extracted is saved without the person seeing it and pressing "Eso es todo" (AGENTS.md §3.8).
// The ficha's pills are proposed on /mis-remedios; its thresholds still need /onboarding/confirmar.

type Step = "ask" | "reading" | "list";
type Item = { id?: string; name: string; source: "ficha" | "manual" };

const DONE = /^(no|nada|nada mas|ninguna|ninguno|no tengo|no tengo ninguna|no tengo nada|eso es todo|eso seria|listo|no gracias|no, gracias)[.! ]*$/;

/** Offline fallback when the extraction agent is unavailable: splits on "y", commas, "también"… */
function splitConditions(text: string): string[] {
  return text
    .replace(/^(yo\s+)?(tengo|sufro de|padezco( de)?|me diagnosticaron|me dijeron que tengo|soy)\s+/i, "")
    .split(/,|;|\sy\s|\se\s|\stambién\s|\stambien\s|\sademás\s|\sademas\s/i)
    .map((t) => t.replace(/^(la|el|los|las|un|una|de)\s+/i, "").replace(/[.!?¿¡]/g, "").trim())
    .filter((t) => t.length > 1)
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1));
}

function sameName(a: string, b: string) {
  return normalize(a).trim() === normalize(b).trim();
}

function spokenList(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
}

function Guide() {
  const router = useRouter();
  const params = useSearchParams();
  const { userId, data } = useCare();
  const supabase = getSupabase();
  const [persona] = useState<Persona>(savedPersona);
  const [step, setStep] = useState<Step>("ask");
  const [items, setItems] = useState<Item[]>([]);
  const [original, setOriginal] = useState<Item[]>([]);
  const [pct, setPct] = useState(0);
  const [demoReading, setDemoReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const photo = useRef<HTMLInputElement>(null);
  const pdf = useRef<HTMLInputElement>(null);
  const textInput = useRef<HTMLInputElement>(null);
  const spokeFirst = useRef(false);
  const name = firstName(data?.profile?.full_name);

  // Voice or chat mode (chosen on /acompanante); answers said out loud go to the current step
  const answerRef = useRef<(text: string) => void>(() => {});
  const guide = useGuide(persona, (text) => answerRef.current(text));
  const { say } = guide;

  // What is already on file, so nothing is asked twice
  useEffect(() => {
    supabase
      .from("conditions")
      .select("id,name,source")
      .eq("user_id", userId)
      .then(({ data: rows }) => {
        const list = (rows ?? []).map((r) => ({ id: r.id, name: r.name, source: r.source === "ficha" ? "ficha" : "manual" }) as Item);
        setItems(list);
        setOriginal(list);
      });
  }, [supabase, userId]);

  useEffect(() => {
    if (spokeFirst.current || !data) return;
    spokeFirst.current = true;
    say(
      `${name ? `${name}, ` : ""}¿tiene su ficha médica a mano? Puede sacarle una foto o subir el PDF, y yo la leo. Si no la tiene, no importa: me cuenta usted.`,
    );
  }, [data, name, say]);

  // Progress creeps while the ficha is read; jumps to 100 when done
  useEffect(() => {
    if (step !== "reading") return;
    const t = setInterval(() => setPct((p) => Math.min(p + 4, 92)), 200);
    return () => clearInterval(t);
  }, [step]);

  // Next guided step: the pills (/mis-remedios); the ficha, if any, travels along to propose its pills
  const finish = useCallback(() => {
    guide.quiet();
    const target = params.get("next");
    const next = target && target.startsWith("/") && !target.startsWith("//") ? target : "/inicio";
    router.replace(`/mis-remedios?next=${encodeURIComponent(next)}${recordId ? `&record=${recordId}` : ""}`);
  }, [guide, params, recordId, router]);

  function toList(intro?: string) {
    setStep("list");
    const has = items.length ? ` Ya tengo anotado: ${spokenList(items.map((i) => i.name))}.` : "";
    say(intro ?? `Cuénteme, ¿qué enfermedades o condiciones tiene? Puede decirme varias, por ejemplo: hipertensión y diabetes.${has}`);
    setTimeout(() => textInput.current?.focus(), 50);
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setStep("reading");
    setPct(8);
    say("Gracias. Estoy leyendo su ficha, deme un momento.", undefined, false);

    const safe = f.name.normalize("NFD").replace(/[^\w.-]+/g, "-");
    const path = `${userId}/${Date.now()}-${safe}`;
    const up = await supabase.storage.from("medical-records").upload(path, f, { contentType: f.type || "application/octet-stream" });
    const rec = up.error ? null : await supabase.from("medical_records").insert({ user_id: userId, file_path: path }).select("id").single();
    if (!rec || rec.error) return toList("No pude leer la ficha. No se preocupe: cuénteme usted, ¿qué enfermedades o condiciones tiene?");
    setRecordId(rec.data.id);

    try {
      const res = await fetch("/api/ficha/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_path: path }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { extracted: unknown; stub?: boolean };
      const extracted = asExtracted(body.extracted);
      await supabase.from("medical_records").update({ extracted: body.extracted as never }).eq("id", rec.data.id);
      setDemoReading(Boolean(body.stub));
      setPct(100);
      const found = extracted.conditions.filter((c) => !items.some((i) => sameName(i.name, c)));
      setItems((list) => [...list, ...found.map((n) => ({ name: n, source: "ficha" as const }))]);
      const all = [...items.map((i) => i.name), ...found];
      toList(
        all.length
          ? `En su ficha encontré: ${spokenList(all)}. Revíselo abajo. Si falta alguna, dígamela o escríbala. Si sobra, tóquela para quitarla.`
          : "No encontré enfermedades en la ficha. Cuénteme usted, ¿qué enfermedades o condiciones tiene?",
      );
    } catch {
      toList("No pude leer la ficha. No se preocupe: cuénteme usted, ¿qué enfermedades o condiciones tiene?");
    }
  }

  // An agent (/api/conditions/extract) pulls only the condition names out of what was said:
  // "tengo la presión alta y también me dio diabetes" → Presión alta, Diabetes
  async function add(text: string) {
    setExtracting(true);
    let names: string[] = [];
    try {
      const res = await fetch("/api/conditions/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, known: items.map((i) => i.name) }),
      });
      const body = (await res.json()) as { conditions?: string[]; fallback?: boolean };
      names = !res.ok || body.fallback ? splitConditions(text) : (body.conditions ?? []);
    } catch {
      names = splitConditions(text);
    }
    setExtracting(false);
    const fresh = names.filter((n, idx) => !items.some((i) => sameName(i.name, n)) && names.findIndex((m) => sameName(m, n)) === idx);
    if (!fresh.length) return say("Disculpe, no le alcancé a entender qué enfermedad es. ¿Me lo repite, por favor?");
    setItems((list) => [...list, ...fresh.map((n) => ({ name: n, source: "manual" as const }))]);
    say(`Anoté ${spokenList(fresh)}. ¿Tiene alguna otra? Si no, toque «Eso es todo».`);
  }

  function remove(item: Item) {
    setItems((list) => list.filter((i) => i !== item));
    say(`Quité ${item.name}.`);
  }

  async function save() {
    setSaving(true);
    const removed = original.filter((o) => o.id && !items.some((i) => i.id === o.id));
    const added = items.filter((i) => !i.id);
    const del = removed.length ? await supabase.from("conditions").delete().in("id", removed.map((r) => r.id!)) : { error: null };
    const ins = added.length ? await supabase.from("conditions").insert(added.map((a) => ({ user_id: userId, name: a.name, source: a.source }))) : { error: null };
    setSaving(false);
    if (del.error || ins.error) return say("No pude guardarlo. ¿Lo intentamos de nuevo?");
    say(items.length ? "Listo, quedó anotado. Ahora sigamos con sus remedios." : "Muy bien. Ahora sigamos con sus remedios.", undefined, false);
    setTimeout(finish, 1800);
  }

  // The phone only opens the camera or the file picker from a tap, so by voice we point to the button
  function answer(text: string) {
    const t = normalize(text).trim();
    if (step === "ask") {
      if (/foto|camara/.test(t)) return say("Muy bien. Toque el botón grande que dice «Sacar una foto».", undefined, false);
      if (/pdf|archivo|documento/.test(t)) return say("Muy bien. Toque el botón «Subir un PDF».", undefined, false);
      if (/^no|no la tengo|no tengo/.test(t)) return toList();
      return say("¿Quiere sacarle una foto, subir el PDF, o prefiere contarme usted?");
    }
    if (step === "list") return DONE.test(t) ? save() : add(text);
  }
  useEffect(() => {
    answerRef.current = answer;
  });

  /** A tapped button counts as the person's answer (it shows in the chat) */
  function tap(label: string, action: () => void) {
    guide.quiet();
    guide.heard(label);
    action();
  }

  function onType(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = new FormData(e.currentTarget).get("value")?.toString() ?? "";
    if (value.trim()) {
      guide.heard(value);
      add(value);
    }
    e.currentTarget.reset();
  }

  const { speech } = guide;

  return (
    <div className="flex flex-1 flex-col gap-4 px-6 pt-5 pb-6">
      <div className="flex items-center justify-between">
        <Brand size="sm" />
        <button type="button" onClick={finish} className="min-h-14 cursor-pointer px-2 text-body font-bold text-primary underline underline-offset-4">
          Ahora no
        </button>
      </div>

      <GuideConversation guide={guide} persona={persona} thinking={step === "reading" || extracting} />

      <input ref={photo} type="file" accept="image/*" capture="environment" className="sr-only" onChange={onFile} aria-label="Sacar foto de la ficha" />
      <input ref={pdf} type="file" accept="application/pdf,.pdf,image/*" className="sr-only" onChange={onFile} aria-label="Elegir PDF de la ficha" />

      {step === "reading" && (
        <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5" aria-live="polite">
          <span className="text-body font-bold">Leyendo su ficha…</span>
          <ProgressBar pct={pct} thin />
        </div>
      )}

      {step === "list" && (
        <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5">
          <h2 className="text-body font-bold text-ink-muted">Sus enfermedades o condiciones</h2>
          {items.length === 0 ? (
            <p className="text-body-lg text-ink-muted">Todavía no hay ninguna anotada.</p>
          ) : (
            <ul className="flex flex-wrap gap-3">
              {items.map((i) => (
                <li key={i.id ?? `new-${i.name}`}>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    aria-label={`Quitar ${i.name}`}
                    className="inline-flex min-h-14 cursor-pointer items-center gap-2 rounded-full border-2 border-primary bg-primary-soft pr-3 pl-4 text-body-lg font-bold text-primary"
                  >
                    {i.name}
                    <Icon name="close" size="1.4rem" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {extracting && guide.mode === "voz" && <p className="text-body font-bold text-ink-muted" aria-live="polite">Anotando…</p>}
          {demoReading && <SimulatedNote>Lectura de ficha de demostración: revise que esté bien</SimulatedNote>}
          {guide.mode === "chat" && (
          <form onSubmit={onType} className="flex items-center gap-3 pt-1">
            <input
              ref={textInput}
              name="value"
              placeholder="Escriba una enfermedad"
              aria-label="Escriba una enfermedad o condición"
              autoComplete="off"
              className="min-h-14 min-w-0 flex-1 rounded-btn border-2 border-line-strong bg-surface px-4 text-body-lg focus:border-primary"
            />
            <button type="submit" disabled={extracting} className="flex min-h-14 cursor-pointer items-center gap-1.5 rounded-btn bg-primary px-4 text-body font-bold text-white disabled:opacity-45">
              <Icon name="add" size="1.5rem" />
              Agregar
            </button>
          </form>
          )}
        </section>
      )}

      <div className="mt-auto flex flex-col gap-4">
        {guide.mode === "voz" && step !== "reading" && (
          <Button variant={speech.listening ? "danger" : "secondary"} icon={speech.listening ? "stop" : "mic"} iconFill onClick={guide.toggleListen}>
            {speech.listening ? "Terminar de hablar" : "Tocar para hablar"}
          </Button>
        )}
        {step === "ask" && (
          <>
            <Button icon="photo_camera" onClick={() => tap("Sacar una foto", () => photo.current?.click())}>Sacar una foto</Button>
            <Button variant="secondary" icon="upload_file" onClick={() => tap("Subir un PDF", () => pdf.current?.click())}>Subir un PDF</Button>
            <Button variant="muted" onClick={() => tap("No la tengo", () => toList())}>No la tengo</Button>
          </>
        )}
        {step === "list" && (
          <Button icon="check" onClick={() => tap("Eso es todo", save)} disabled={saving || extracting}>
            {saving ? "Un momento…" : "Eso es todo"}
          </Button>
        )}
        <SwitchToTyping guide={guide} />
      </div>
    </div>
  );
}

// 01g · Ficha médica guiada (after the caregivers step)
export default function MedicalRecordGuide() {
  return (
    <Suspense>
      <Guide />
    </Suspense>
  );
}
