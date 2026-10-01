"use client";

import { useEffect, useRef } from "react";
import { CompanionPrompt } from "@/components/CompanionPrompt";
import { MASCOT_HALO, MascotFace, type MascotState } from "@/components/Mascot";
import { Icon } from "@/components/ui";
import type { useGuide } from "@/hooks/useGuide";
import type { Persona } from "@/lib/mateo/prompt";

// How a guided step looks in each mode (see useGuide):
//   voz  → big face + the current question in a bubble + what the mic is hearing
//   chat → small face + the whole exchange as chat bubbles (the newest at the bottom)

type Guide = ReturnType<typeof useGuide>;

export function GuideConversation({ guide, persona, thinking }: { guide: Guide; persona: Persona; thinking?: boolean }) {
  const { mode, voice, speech, line, log } = guide;
  const state: MascotState = speech.listening ? "listening" : thinking ? "thinking" : voice.speaking ? "speaking" : "idle";
  const box = useRef<HTMLDivElement>(null);

  // Keep the newest message in view (after it has been laid out)
  useEffect(() => {
    if (mode !== "chat") return;
    const id = requestAnimationFrame(() => box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" }));
    return () => cancelAnimationFrame(id);
  }, [log.length, mode, thinking]);

  if (mode === "voz") {
    return (
      <div className="flex flex-col gap-3">
        <CompanionPrompt persona={persona} state={state} line={line} speaking={voice.speaking} listening={speech.listening} onRepeat={guide.repeat} />
        <p role="status" className={`min-h-7 text-center text-body font-bold ${speech.listening ? "text-crit" : "text-ink-muted"}`}>
          {speech.listening ? (speech.interim ? `"${speech.interim}…"` : "Le escucho…") : thinking ? "Un momento…" : voice.speaking ? `${persona} está hablando` : ""}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className={`relative block aspect-square w-16 shrink-0 rounded-full ${MASCOT_HALO[persona]}`}>
          <MascotFace persona={persona} state={state} className="absolute inset-0 h-full w-full" />
        </span>
        <span className="text-lead font-extrabold">{persona}</span>
      </div>
      <div ref={box} className="flex max-h-[44dvh] flex-col gap-3 overflow-y-auto overscroll-contain rounded-card border border-line bg-sunken p-3" aria-live="polite">
        {log.map((m, i) =>
          m.from === "companion" ? (
            <div key={i} className="flex flex-col items-start gap-1.5">
              <p className="max-w-[90%] rounded-[22px_22px_22px_6px] border border-line bg-surface px-4 py-3 text-body-lg">{m.text}</p>
              {i === log.length - 1 && (
                <button type="button" onClick={guide.repeat} className="inline-flex min-h-12 cursor-pointer items-center gap-1.5 rounded-full bg-primary-soft px-3 text-body font-bold text-primary">
                  <Icon name={voice.speaking ? "stop" : "volume_up"} fill size="1.3rem" />
                  {voice.speaking ? "Detener" : "Escuchar"}
                </button>
              )}
            </div>
          ) : (
            <p key={i} className="max-w-[85%] self-end rounded-[22px_22px_6px_22px] bg-primary px-4 py-3 text-body-lg text-white">
              {m.text}
            </p>
          ),
        )}
        {thinking && <p className="self-start rounded-[22px_22px_22px_6px] border border-line bg-surface px-4 py-3 text-body-lg text-ink-muted">Anotando…</p>}
      </div>
    </div>
  );
}

/** Voice mode: small link to switch to typing; chat mode: nothing */
export function SwitchToTyping({ guide }: { guide: Guide }) {
  if (guide.mode !== "voz") return null;
  return (
    <button
      type="button"
      onClick={() => guide.setMode("chat")}
      className="inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 self-center px-3 text-body font-bold text-primary underline underline-offset-4"
    >
      <Icon name="keyboard" size="1.5rem" />
      Prefiero escribir
    </button>
  );
}
