"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useCare } from "@/components/CareProvider";
import { CompanionPrompt, savedPersona } from "@/components/CompanionPrompt";
import { Brand, Button, Icon } from "@/components/ui";
import { useCompanionVoice } from "@/hooks/useCompanionVoice";
import { saveMode, type GuideMode } from "@/hooks/useGuide";
import type { Persona } from "@/lib/mateo/prompt";
import { firstName } from "@/lib/time";
import { HOME_PATH } from "@/lib/nav";

// Right after choosing the companion, its own screen: how to do the rest of the getting-to-know-you
// steps. "voz" = hands-free (it speaks, then listens); "chat" = written, silent unless asked.
// Two different paths, see hooks/useGuide.ts. Stored per device (vesta.guide_mode).

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
  const [persona] = useState<Persona>(savedPersona);
  const [mode, setMode] = useState<GuideMode | null>(null);
  const [voiceOk] = useState(canListen);
  const spoke = useRef(false);
  const name = firstName(data?.profile?.full_name);
  const line = `${name ? `${name}, ` : ""}¿cómo prefiere que sigamos conociéndonos? Podemos hacerlo hablando o escribiendo, como le resulte más fácil.`;

  // The companion asks out loud once the person's name is here (the tap on "Seguir" allows audio)
  useEffect(() => {
    if (spoke.current || !data) return;
    spoke.current = true;
    voice.speak(line, persona);
  }, [data, line, persona, voice]);

  function choose(m: GuideMode) {
    setMode(m);
    voice.stop();
    if (m === "voz") voice.speak("Muy bien, sigamos hablando.", persona);
  }

  function next() {
    if (!mode) return;
    voice.stop();
    saveMode(mode);
    const target = params.get("next");
    const next = target && target.startsWith("/") && !target.startsWith("//") ? target : HOME_PATH;
    router.replace(`/cuidadores?next=${encodeURIComponent(next)}`);
  }

  return (
    <div className="flex flex-1 flex-col gap-5 px-6 pt-5 pb-6">
      <Brand size="sm" />

      <CompanionPrompt
        persona={persona}
        state={voice.speaking ? "speaking" : "idle"}
        line={line}
        speaking={voice.speaking}
        onRepeat={() => (voice.speaking ? voice.stop() : voice.speak(line, persona))}
      />

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
              onClick={() => choose(m.id)}
              className={`flex min-h-[96px] cursor-pointer items-center gap-4 rounded-card border-[3px] bg-surface px-4 py-3 text-left disabled:cursor-default disabled:opacity-60 ${
                on ? "border-primary" : "border-line-strong"
              }`}
            >
              <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${on ? "bg-primary text-white" : "bg-primary-soft text-primary"}`}>
                <Icon name={on ? "check" : m.icon} fill size="2.1rem" />
              </span>
              <span className="flex flex-col">
                <span className="text-title font-extrabold">{m.title}</span>
                <span className="text-body text-ink-muted">{disabled ? "Este navegador no permite hablar. Puede seguir escribiendo." : m.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-auto">
        <Button onClick={next} disabled={!mode}>
          {mode ? `Seguir ${mode === "voz" ? "hablando" : "escribiendo"}` : "Elija cómo seguir"}
        </Button>
      </div>
    </div>
  );
}

// 01e2 · Cómo seguir: voz o chat (after choosing the companion)
export default function HowToContinuePage() {
  return (
    <Suspense>
      <Chooser />
    </Suspense>
  );
}
