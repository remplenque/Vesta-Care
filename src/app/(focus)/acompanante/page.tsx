"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useCare } from "@/components/CareProvider";
import { MASCOT_HALO, MascotFace } from "@/components/Mascot";
import { Brand, Button, Icon } from "@/components/ui";
import { useCompanionVoice } from "@/hooks/useCompanionVoice";
import { saveMode, type GuideMode } from "@/hooks/useGuide";
import { PERSONAS, type Persona } from "@/lib/mateo/prompt";
import { firstName } from "@/lib/time";

// After login: the person picks who keeps them company (Mateo or Emilia), sees the face and hears
// the voice before deciding. One tap on a card = choose + hear it; one tap on "Seguir" = done.
// The choice is per device (localStorage "vesta.persona", same key the /mateo tab reads).
// Then: how to do the rest of the getting-to-know-you steps, "voz" (hands-free: it speaks and then
// listens) or "chat" (written, silent unless asked). Two different paths, see hooks/useGuide.ts.

const PERSONA_KEY = "vesta.persona";
const BLURB: Record<Persona, string> = {
  Mateo: "Tranquilo y cercano",
  Emilia: "Cálida y alegre",
};
const MODES: { id: GuideMode; icon: string; title: string; blurb: string }[] = [
  { id: "voz", icon: "record_voice_over", title: "Hablando", blurb: "Le pregunto en voz alta y usted me responde con su voz" },
  { id: "chat", icon: "chat", title: "Escribiendo", blurb: "Como un chat: leo y escribo, sin sonido" },
];

function canListen() {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

function Chooser() {
  const router = useRouter();
  const params = useSearchParams();
  const { data } = useCare();
  const voice = useCompanionVoice();
  const [chosen, setChosen] = useState<Persona | null>(() => {
    try {
      const saved = localStorage.getItem(PERSONA_KEY);
      return PERSONAS.includes(saved as Persona) ? (saved as Persona) : null;
    } catch {
      return null;
    }
  });
  const [testing, setTesting] = useState<Persona | null>(null);
  const [mode, setMode] = useState<GuideMode | null>(null);
  const [voiceOk] = useState(canListen);
  const name = firstName(data?.profile?.full_name);

  function pick(p: Persona) {
    setChosen(p);
    setTesting(p);
    voice.speak(
      `¡Hola${name ? `, ${name}` : ""}! Soy ${p}. Así suena mi voz. Voy a acompañarle cada día. ¿Prefiere que sigamos hablando o escribiendo?`,
      p,
    );
  }

  function next() {
    if (!chosen || !mode) return;
    voice.stop();
    try {
      localStorage.setItem(PERSONA_KEY, chosen);
    } catch {}
    saveMode(mode);
    // Next: the guided caregivers step, which then continues to where the person was going
    const target = params.get("next");
    const next = target && target.startsWith("/") && !target.startsWith("//") ? target : "/inicio";
    router.replace(`/cuidadores?next=${encodeURIComponent(next)}`);
  }

  return (
    <div className="flex flex-1 flex-col gap-5 px-6 pt-5 pb-6">
      <Brand size="sm" />
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 font-extrabold">{name ? `${name}, ¿con quién quiere conversar?` : "¿Con quién quiere conversar?"}</h1>
        <p className="text-body-lg text-ink-muted">Toque una cara para escuchar su voz. Puede cambiarlo cuando quiera.</p>
      </div>

      <div role="radiogroup" aria-label="Acompañante" className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
        {PERSONAS.map((p) => {
          const selected = chosen === p;
          const speaking = testing === p && voice.speaking;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => pick(p)}
              className={`flex cursor-pointer flex-col items-center gap-3 rounded-card border-[3px] bg-surface px-3 pt-4 pb-4 text-center ${
                selected ? "border-primary" : "border-line-strong"
              }`}
            >
              <span className={`relative block aspect-square w-full max-w-[160px] rounded-full ${MASCOT_HALO[p]}`}>
                <MascotFace persona={p} state={speaking ? "speaking" : "idle"} className="absolute inset-0 h-full w-full" />
              </span>
              <span className="text-title font-extrabold">{p}</span>
              <span className="text-body text-ink-muted">{BLURB[p]}</span>
              <span className={`inline-flex min-h-12 items-center gap-1.5 rounded-full px-3 text-body font-bold ${selected ? "bg-primary text-white" : "bg-primary-soft text-primary"}`}>
                <Icon name={speaking ? "graphic_eq" : selected ? "check_circle" : "volume_up"} fill size="1.4rem" />
                {speaking ? "Hablando…" : selected ? "Elegido" : "Escuchar"}
              </span>
            </button>
          );
        })}
      </div>

      {chosen && (
        <button
          type="button"
          onClick={() => pick(chosen)}
          className="inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 self-center rounded-btn px-4 text-body font-bold text-primary underline underline-offset-4"
        >
          <Icon name="replay" size="1.5rem" />
          Escuchar de nuevo a {chosen}
        </button>
      )}

      {chosen && (
        <section className="flex flex-col gap-3">
          <h2 className="text-title font-extrabold">¿Cómo prefiere que sigamos?</h2>
          <div role="radiogroup" aria-label="Cómo seguir" className="flex flex-col gap-3">
            {MODES.map((m) => {
              const disabled = m.id === "voz" && !voiceOk;
              const on = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={disabled}
                  onClick={() => setMode(m.id)}
                  className={`flex min-h-[88px] cursor-pointer items-center gap-4 rounded-card border-[3px] bg-surface px-4 py-3 text-left disabled:cursor-default disabled:opacity-60 ${
                    on ? "border-primary" : "border-line-strong"
                  }`}
                >
                  <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${on ? "bg-primary text-white" : "bg-primary-soft text-primary"}`}>
                    <Icon name={on ? "check" : m.icon} fill size="1.9rem" />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-lead font-extrabold">{m.title}</span>
                    <span className="text-body text-ink-muted">{disabled ? "Este navegador no permite hablar. Puede seguir escribiendo." : m.blurb}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div className="mt-auto">
        <Button onClick={next} disabled={!chosen || !mode}>
          {!chosen ? "Elija a su acompañante" : !mode ? "Elija cómo seguir" : `Seguir con ${chosen}`}
        </Button>
      </div>
    </div>
  );
}

// 01e · Elegir acompañante (after login)
export default function CompanionPage() {
  return (
    <Suspense>
      <Chooser />
    </Suspense>
  );
}
