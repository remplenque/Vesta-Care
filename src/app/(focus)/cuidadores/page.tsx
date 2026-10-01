"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useCare } from "@/components/CareProvider";
import { savedPersona } from "@/components/CompanionPrompt";
import { GuideConversation, SwitchToTyping, TalkFooter } from "@/components/GuideConversation";
import { Brand, Button, Icon } from "@/components/ui";
import { useGuide } from "@/hooks/useGuide";
import type { Persona } from "@/lib/mateo/prompt";
import { answerOf } from "@/lib/yesno";
import { displayMobile, spokenMobile, toChileanMobile } from "@/lib/phone";
import { getSupabase } from "@/lib/supabase/client";
import { firstName } from "@/lib/time";
import { HOME_PATH } from "@/lib/nav";

// After choosing the companion: a guided, spoken conversation to add caregivers (emergency_contacts).
// ask → phone → name → confirm → saved ("¿otra persona?") → … → the app. Every step is spoken by the
// companion and can be answered by voice, by typing or with big buttons (ACCESSIBILITY §6–7).
// "Ahora no" is always visible: adding someone is never required.

type Step = "ask" | "phone" | "name" | "confirm" | "saved";

function cleanName(text: string) {
  return text
    .replace(/^(se llama|es|ella es|el es|mi (hija|hijo|vecina|vecino|amiga|amigo|hermana|hermano|nieta|nieto))\s+/i, "")
    .replace(/[^\p{L}\s'-]/gu, "")
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function Guide() {
  const router = useRouter();
  const params = useSearchParams();
  const { userId, data, refresh } = useCare();
  const supabase = getSupabase();
  const [persona] = useState<Persona>(savedPersona);
  const [step, setStep] = useState<Step>("ask");
  const [phone, setPhone] = useState("");
  const [contactName, setContactName] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const spokeFirst = useRef(false);

  const name = firstName(data?.profile?.full_name);
  const existing = (data?.contacts ?? []).map((c) => firstName(c.name));

  // Voice or chat mode (chosen on /acompanante). Answers said out loud go to the current step.
  // What is shown and what is heard can differ: "9 1234 5678" on screen, digit by digit out loud.
  const answerRef = useRef<(text: string) => void>(() => {});
  const guide = useGuide(persona, (text) => answerRef.current(text));
  const { say } = guide;

  const prompts = useCallback(
    (s: Step, extra?: { saved?: string }) => {
      const hi = name ? `${name}, ` : "";
      switch (s) {
        case "ask": {
          const list = existing.length > 1 ? `${existing.slice(0, -1).join(", ")} y ${existing.at(-1)}` : existing[0];
          const has = existing.length ? ` Ya tiene a ${list}.` : "";
          return `${hi}¿quiere agregar a alguien de confianza que le cuide o le acompañe? Si pasa algo, esa persona recibe un aviso.${has}`;
        }
        case "phone":
          return guide.mode === "chat"
            ? "¿Cuál es el número de celular de esa persona? Escríbalo abajo."
            : "¿Cuál es el número de celular de esa persona? Dígamelo despacio.";
        case "name":
          return "Muy bien. ¿Y cómo se llama?";
        case "confirm":
          return "";
        case "saved":
          return `Listo, guardé a ${extra?.saved ?? contactName}. ¿Quiere agregar a otra persona?`;
      }
    },
    [contactName, existing, guide.mode, name],
  );

  // Greet once the person's data is here (so the companion can say their name)
  useEffect(() => {
    if (spokeFirst.current || !data) return;
    spokeFirst.current = true;
    say(prompts("ask"));
  }, [data, prompts, say]);

  // Next guided step: the medical record (/mi-ficha), which then continues to the app
  const finish = useCallback(() => {
    guide.quiet();
    const target = params.get("next");
    const next = target && target.startsWith("/") && !target.startsWith("//") ? target : HOME_PATH;
    router.replace(`/mi-ficha?next=${encodeURIComponent(next)}`);
  }, [guide, params, router]);

  function go(s: Step) {
    setStep(s);
    if (s !== "confirm") say(prompts(s));
  }

  function submitPhone(raw: string) {
    const e164 = toChileanMobile(raw);
    if (!e164) return say("Ese número no me calza. ¿Me lo dice de nuevo? Son 9 dígitos, por ejemplo 9 1234 5678.");
    setPhone(e164);
    go("name");
  }

  function submitName(raw: string) {
    const n = cleanName(raw);
    if (n.length < 2) return say("Disculpe, no le alcancé a escuchar el nombre. ¿Me lo repite, por favor?");
    setContactName(n);
    setStep("confirm");
    say(
      `Voy a guardar a ${n}, con el número ${displayMobile(phone)}. ¿Está bien?`,
      `Voy a guardar a ${n}, con el número ${spokenMobile(phone)}. ¿Está bien?`,
    );
  }

  async function save() {
    setBusy(true);
    const { error } = await supabase
      .from("emergency_contacts")
      .insert({ user_id: userId, name: contactName, relation: "cuidador", phone: phone });
    setBusy(false);
    if (error) return say("No pude guardarlo. ¿Lo intentamos de nuevo?");
    setAdded((a) => [...a, contactName]);
    refresh();
    setStep("saved");
    say(prompts("saved", { saved: contactName }));
  }

  function restart() {
    setPhone("");
    setContactName("");
    go("phone");
  }

  // Answers (said out loud) go to whatever the current step is asking
  function answer(text: string) {
    if (step === "phone") return submitPhone(text);
    if (step === "name") return submitName(text);
    const a = answerOf(text);
    if (step === "ask") return a === "yes" ? go("phone") : a === "no" ? finish() : say("¿Me dice sí o no, por favor? También puede tocar un botón.");
    if (step === "confirm") return a === "yes" ? save() : a === "no" ? restart() : say("¿Está bien así? Dígame sí o no.");
    if (step === "saved") return a === "yes" ? restart() : a === "no" ? finish() : say("¿Quiere agregar a otra persona? Dígame sí o no.");
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
    if (!value.trim()) return;
    guide.heard(step === "phone" ? `+56 ${value}` : value);
    if (step === "phone") submitPhone(value);
    else submitName(value);
    e.currentTarget.reset();
  }

  const field = "min-h-16 w-full min-w-0 flex-1 bg-transparent px-4 text-body-lg focus:outline-none";

  return (
    <div className={`flex flex-1 flex-col gap-4 px-6 pt-5 ${guide.mode === "voz" ? "pb-0" : "pb-6"}`}>
      <div className="flex items-center justify-between">
        <Brand size="sm" />
        <button type="button" onClick={finish} className="min-h-14 cursor-pointer px-2 text-body font-bold text-primary underline underline-offset-4">
          Ahora no
        </button>
      </div>

      <GuideConversation guide={guide} persona={persona} thinking={busy} />

      {added.length > 0 && (
        <p className="flex items-center gap-2 text-body text-ok">
          <Icon name="check_circle" fill size="1.4rem" />
          Agregado: {added.join(", ")}
        </p>
      )}

      {(step === "phone" || step === "name") && guide.mode === "chat" && (
        <form onSubmit={onType} className="flex flex-col gap-3">
          <label className="flex flex-col gap-2">
            <span className="text-body-lg font-bold">{step === "phone" ? "Número de celular" : "Nombre"}</span>
            <span className="flex min-h-16 items-center rounded-btn border-2 border-line-strong bg-surface focus-within:border-primary">
              {step === "phone" && <span className="border-r-2 border-line px-4 text-body-lg font-bold text-ink-muted">+56</span>}
              <input
                key={step}
                name="value"
                className={field}
                {...(step === "phone"
                  ? { type: "tel", inputMode: "tel" as const, placeholder: "9 1234 5678", autoComplete: "off" }
                  : { type: "text", placeholder: "Por ejemplo, María", autoComplete: "off", autoCapitalize: "words" })}
              />
            </span>
          </label>
          <Button type="submit">Seguir</Button>
        </form>
      )}

      {step === "confirm" && (
        <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
          <p className="text-title font-extrabold">{contactName}</p>
          <p className="text-body-lg text-ink-muted">+56 {displayMobile(phone)}</p>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-4">
        {step === "ask" && (
          <>
            <Button variant={guide.mode === "voz" ? "secondary" : "primary"} icon="person_add" onClick={() => tap("Sí, agregar a alguien", () => go("phone"))}>
              Sí, agregar a alguien
            </Button>
            <Button variant="muted" onClick={() => tap("No, por ahora no", finish)}>No, por ahora no</Button>
          </>
        )}
        {step === "confirm" && (
          <>
            <Button variant={guide.mode === "voz" ? "secondary" : "primary"} icon="check" onClick={() => tap("Sí, guardar", save)} disabled={busy}>
              {busy ? "Un momento…" : "Sí, guardar"}
            </Button>
            <Button variant="muted" icon="edit" onClick={() => tap("No, corregir", restart)}>No, corregir</Button>
          </>
        )}
        {step === "saved" && (
          <>
            <Button variant={guide.mode === "voz" ? "secondary" : "primary"} icon="person_add" onClick={() => tap("Sí, otra persona", restart)}>
              Sí, agregar otra persona
            </Button>
            <Button variant="muted" onClick={() => tap("No, seguir", finish)}>No, seguir</Button>
          </>
        )}
        <SwitchToTyping guide={guide} />
      </div>
      <TalkFooter guide={guide} />
    </div>
  );
}

// 01f · Cuidadores (after choosing the companion)
export default function CaregiversPage() {
  return (
    <Suspense>
      <Guide />
    </Suspense>
  );
}
