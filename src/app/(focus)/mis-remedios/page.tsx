"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { savedPersona } from "@/components/CompanionPrompt";
import { GuideConversation, SwitchToTyping } from "@/components/GuideConversation";
import { useCare } from "@/components/CareProvider";
import { Brand, Button, Icon, SimulatedNote } from "@/components/ui";
import { useGuide } from "@/hooks/useGuide";
import { asExtracted } from "@/lib/ficha";
import type { Persona } from "@/lib/mateo/prompt";
import { normalize } from "@/lib/mateo/safety";
import { getSupabase } from "@/lib/supabase/client";
import { firstName } from "@/lib/time";
import { HOME_PATH } from "@/lib/nav";

// After the medical record step: the pills the person takes, guided by voice.
// Each pill: name (required), strength ("50 mg", recommended) and how many per take (optional).
// Said out loud → an agent (/api/medications/extract) pulls name/strength/quantity out of the
// sentence; typed → a short form. Pills from the ficha (?record=) are proposed to confirm.
// Saved to medications (dose = "50 mg · 1 pastilla", schedule.times from the ficha or empty).
// Mateo never suggests or changes a dose: the screen only records what the person says (§3.6).

type Med = { name: string; strength: string | null; quantity: number | null; times?: string[]; fromFicha?: boolean };
const UNITS = ["mg", "g", "mcg"] as const;
const QUANTITIES = [0.5, 1, 2, 3];
const DONE = /^(no|nada|nada mas|ninguna|ninguno|no tomo|no tomo nada|no tomo ninguna|eso es todo|eso seria|listo|no gracias|no, gracias)[.! ]*$/;

function qtyLabel(q: number | null) {
  if (q == null) return null;
  if (q === 0.5) return "½ pastilla";
  return q === 1 ? "1 pastilla" : `${q} pastillas`;
}
function spokenQty(q: number | null) {
  if (q == null) return "";
  if (q === 0.5) return "media pastilla";
  return q === 1 ? "una pastilla" : `${q} pastillas`;
}
function spokenStrength(s: string | null) {
  if (!s) return "";
  return s.replace(/\bmcg\b/, "microgramos").replace(/\bmg\b/, "miligramos").replace(/\bg\b/, "gramos").replace(/\bml\b/, "mililitros");
}
function spokenMed(m: Med) {
  return [m.name, m.strength ? `de ${spokenStrength(m.strength)}` : "", spokenQty(m.quantity)].filter(Boolean).join(" ");
}
function doseText(m: Med) {
  return [m.strength, qtyLabel(m.quantity)].filter(Boolean).join(" · ") || null;
}
function spokenList(names: string[]) {
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
}
const same = (a: string, b: string) => normalize(a).trim() === normalize(b).trim();

/** Offline fallback when the extraction agent is unavailable */
function parseOffline(text: string): Med[] {
  const s = text.trim();
  const strength = s.match(/(\d+(?:[.,]\d+)?)\s*(mcg|microgramos?|mg|miligramos?|g\b|gramos?)/i);
  const unit = strength ? (/^mc|^micro/i.test(strength[2]) ? "mcg" : /^m/i.test(strength[2]) || Number(strength[1].replace(",", ".")) >= 5 ? "mg" : "g") : null;
  const qty = /\bmedia\b/i.test(s) ? 0.5 : /\b(una|1)\s+(pastilla|vez)/i.test(s) ? 1 : /\b(dos|2)\s+pastillas/i.test(s) ? 2 : null;
  const name = s
    .replace(/^(yo\s+)?(tomo|me tomo|uso)\s+/i, "")
    .split(/\s+de\s+\d|\s+\d|,/)[0]
    .trim();
  if (name.length < 2) return [];
  return [{ name: name.charAt(0).toUpperCase() + name.slice(1), strength: strength ? `${strength[1].replace(",", ".")} ${unit}` : null, quantity: qty }];
}

function Guide() {
  const router = useRouter();
  const params = useSearchParams();
  const { userId, data, refresh } = useCare();
  const supabase = getSupabase();
  const [persona] = useState<Persona>(savedPersona);
  const [items, setItems] = useState<Med[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", amount: "", unit: "mg" as (typeof UNITS)[number], quantity: null as number | null });
  const spokeFirst = useRef(false);
  const name = firstName(data?.profile?.full_name);
  const saved = data?.medications ?? [];

  // Voice or chat mode (chosen on /acompanante); "eso es todo" said out loud saves
  const answerRef = useRef<(text: string) => void>(() => {});
  const guide = useGuide(persona, (text) => answerRef.current(text));
  const { say } = guide;

  // Pills found in the ficha (if the person uploaded one) are proposed, not saved
  useEffect(() => {
    if (spokeFirst.current || !data) return;
    spokeFirst.current = true;
    const hi = name ? `${name}, ` : "";
    const has = data.medications.length ? ` Ya tengo anotado: ${spokenList(data.medications.map((m) => m.name))}.` : "";
    const ask = `${hi}¿qué pastillas toma? Dígame el nombre y de cuántos miligramos es cada una. Por ejemplo: Losartán de 50 miligramos, una pastilla.${has}`;
    const recordId = params.get("record");
    if (!recordId) {
      void Promise.resolve().then(() => say(ask)); // speak after the first paint, like the ficha branch
      return;
    }
    supabase
      .from("medical_records")
      .select("extracted")
      .eq("id", recordId)
      .single()
      .then(({ data: rec }) => {
        const found = asExtracted(rec?.extracted)
          .medications.filter((m) => !data.medications.some((s) => same(s.name, m.name)))
          .map((m) => ({ name: m.name, strength: m.dose || null, quantity: null, times: m.times, fromFicha: true }));
        if (!found.length) return say(ask);
        setItems(found);
        say(`En su ficha encontré: ${spokenList(found.map((m) => m.name))}. Revíselas abajo. Si falta alguna, dígamela o escríbala.`);
      });
  }, [data, name, params, say, supabase]);

  const finish = useCallback(() => {
    guide.quiet();
    const target = params.get("next");
    router.replace(target && target.startsWith("/") && !target.startsWith("//") ? target : HOME_PATH);
  }, [guide, params, router]);

  /** Adds new pills or fills in what was missing (strength / quantity) of one already on the list */
  function merge(found: Med[]) {
    const added: Med[] = [];
    let next = [...items];
    for (const m of found) {
      if (saved.some((s) => same(s.name, m.name))) continue;
      const i = next.findIndex((x) => same(x.name, m.name));
      if (i >= 0) next[i] = { ...next[i], strength: m.strength ?? next[i].strength, quantity: m.quantity ?? next[i].quantity };
      else next = [...next, m];
      added.push(i >= 0 ? next[i] : m);
    }
    setItems(next);
    if (!added.length) return say("Disculpe, no le alcancé a entender qué pastilla es. ¿Me la repite, por favor?");
    const missing = added.find((m) => !m.strength);
    const heard = `Anoté ${spokenList(added.map(spokenMed))}.`;
    const ask = missing ? ` ¿Sabe de cuántos miligramos es ${missing.name}?` : " ¿Toma alguna otra?";
    say(`Anoté ${spokenList(added.map((m) => [m.name, doseText(m)].filter(Boolean).join(" ")))}.${ask}`, heard + ask);
  }

  async function addSpoken(text: string) {
    setBusy(true);
    let found: Med[] = [];
    try {
      const res = await fetch("/api/medications/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, known: [...saved.map((s) => s.name), ...items.map((i) => i.name)], last: items.at(-1)?.name }),
      });
      const body = (await res.json()) as { medications?: Med[]; fallback?: boolean };
      found = !res.ok || body.fallback ? parseOffline(text) : (body.medications ?? []);
    } catch {
      found = parseOffline(text);
    }
    setBusy(false);
    merge(found);
  }

  function addTyped(e: FormEvent) {
    e.preventDefault();
    const n = form.name.trim();
    if (n.length < 2) return say("Escriba el nombre de la pastilla, por favor.");
    const amount = form.amount.trim().replace(",", ".");
    guide.heard([n, amount && `${amount} ${form.unit}`, form.quantity != null && `${form.quantity === 0.5 ? "½" : form.quantity} por vez`].filter(Boolean).join(" · "));
    merge([{ name: n.charAt(0).toUpperCase() + n.slice(1), strength: amount ? `${amount} ${form.unit}` : null, quantity: form.quantity }]);
    setForm({ name: "", amount: "", unit: "mg", quantity: null });
  }

  function remove(m: Med) {
    setItems((list) => list.filter((x) => x !== m));
    say(`Quité ${m.name}.`);
  }

  async function save() {
    if (!items.length) {
      say("Muy bien. Vamos a la aplicación.", undefined, false);
      return setTimeout(finish, 1500);
    }
    setSaving(true);
    const { error } = await supabase
      .from("medications")
      .insert(items.map((m) => ({ user_id: userId, name: m.name, dose: doseText(m), schedule: { times: m.times ?? [] } })));
    setSaving(false);
    if (error) return say("No pude guardarlo. ¿Lo intentamos de nuevo?");
    refresh();
    say("Listo, quedaron anotadas. Vamos a la aplicación.", undefined, false);
    setTimeout(finish, 1800);
  }

  useEffect(() => {
    answerRef.current = (text) => (DONE.test(normalize(text).trim()) ? save() : addSpoken(text));
  });
  const { speech } = guide;
  const field = "min-h-14 w-full min-w-0 rounded-btn border-2 border-line-strong bg-surface px-4 text-body-lg focus:border-primary";
  const chip = (on: boolean) =>
    `min-h-14 min-w-14 cursor-pointer rounded-full border-2 px-4 text-body-lg font-bold ${on ? "border-primary bg-primary text-white" : "border-line-strong bg-surface text-ink"}`;

  return (
    <div className="flex flex-1 flex-col gap-4 px-6 pt-5 pb-6">
      <div className="flex items-center justify-between">
        <Brand size="sm" />
        <button type="button" onClick={finish} className="min-h-14 cursor-pointer px-2 text-body font-bold text-primary underline underline-offset-4">
          Ahora no
        </button>
      </div>

      <GuideConversation guide={guide} persona={persona} thinking={busy} />

      {(saved.length > 0 || items.length > 0) && (
        <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5" aria-live="polite">
          <h2 className="text-body font-bold text-ink-muted">Sus pastillas</h2>
          <ul className="flex flex-col gap-3">
            {saved.map((m) => (
              <li key={m.id} className="flex min-h-14 items-center gap-3">
                <Icon name="check_circle" fill size="1.6rem" className="text-ok" />
                <span className="flex flex-col">
                  <span className="text-body-lg font-bold">{m.name}</span>
                  {m.dose && <span className="text-body text-ink-muted">{m.dose}</span>}
                </span>
              </li>
            ))}
            {items.map((m) => (
              <li key={`new-${m.name}`} className="flex min-h-14 items-center gap-3 border-t border-line-soft pt-3">
                <Icon name="medication" size="1.6rem" className="text-primary" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body-lg font-bold">{m.name}</span>
                  <span className={`text-body ${m.strength ? "text-ink-muted" : "text-warn"}`}>{doseText(m) ?? "Falta: de cuántos mg es"}</span>
                </span>
                <button
                  type="button"
                  onClick={() => remove(m)}
                  className="flex min-h-14 cursor-pointer items-center gap-1 rounded-btn px-2 text-body font-bold text-primary"
                  aria-label={`Quitar ${m.name}`}
                >
                  <Icon name="close" size="1.4rem" />
                  Quitar
                </button>
              </li>
            ))}
          </ul>
          {busy && guide.mode === "voz" && <p className="text-body font-bold text-ink-muted">Anotando…</p>}
          {items.some((m) => m.fromFicha) && <SimulatedNote>Lectura de ficha de demostración: revise que esté bien</SimulatedNote>}
        </section>
      )}

      {guide.mode === "chat" && (
      <form onSubmit={addTyped} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5">
        <h2 className="text-body font-bold text-ink-muted">O escríbala aquí</h2>
        <label className="flex flex-col gap-1.5">
          <span className="text-body-lg font-bold">Nombre de la pastilla</span>
          <input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Por ejemplo, Losartán" autoComplete="off" />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-body-lg font-bold">¿De cuánto es cada pastilla?</span>
          <div className="flex flex-wrap items-center gap-3">
            <input
              className={`${field} w-28 flex-none`}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d.,]/g, "") })}
              inputMode="decimal"
              placeholder="50"
              aria-label="Cantidad de miligramos o gramos"
            />
            <div role="radiogroup" aria-label="Unidad" className="flex gap-2">
              {UNITS.map((u) => (
                <button key={u} type="button" role="radio" aria-checked={form.unit === u} onClick={() => setForm({ ...form, unit: u })} className={chip(form.unit === u)}>
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-body-lg font-bold">
            ¿Cuántas toma cada vez? <span className="font-normal text-ink-muted">(opcional)</span>
          </span>
          <div role="radiogroup" aria-label="Cuántas toma cada vez" className="flex flex-wrap gap-3">
            {QUANTITIES.map((q) => (
              <button
                key={q}
                type="button"
                role="radio"
                aria-checked={form.quantity === q}
                onClick={() => setForm({ ...form, quantity: form.quantity === q ? null : q })}
                className={chip(form.quantity === q)}
              >
                {q === 0.5 ? "½" : q}
              </button>
            ))}
          </div>
        </div>
        <Button type="submit" variant="secondary" icon="add">
          Agregar pastilla
        </Button>
      </form>
      )}

      <div className="mt-auto flex flex-col gap-4">
        {guide.mode === "voz" && (
          <Button variant={speech.listening ? "danger" : "secondary"} icon={speech.listening ? "stop" : "mic"} iconFill onClick={guide.toggleListen}>
            {speech.listening ? "Terminar de hablar" : "Tocar para hablar"}
          </Button>
        )}
        <Button
          icon="check"
          onClick={() => {
            guide.quiet();
            guide.heard("Eso es todo");
            save();
          }}
          disabled={saving || busy}
        >
          {saving ? "Un momento…" : items.length ? "Eso es todo, guardar" : "Eso es todo"}
        </Button>
        <SwitchToTyping guide={guide} />
      </div>
    </div>
  );
}

// 01h · Remedios guiados (after the medical record step)
export default function MedicationsGuide() {
  return (
    <Suspense>
      <Guide />
    </Suspense>
  );
}
