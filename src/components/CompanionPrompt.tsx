"use client";

import { MASCOT_HALO, MascotFace, type MascotState } from "@/components/Mascot";
import { Icon } from "@/components/ui";
import type { Persona } from "@/lib/mateo/prompt";

// Guided steps after login (/cuidadores, /mi-ficha): the companion centered, what it says below in a
// speech bubble, and "Repetir" (ACCESSIBILITY §7: voice always comes with text and can be repeated).

export function CompanionPrompt({
  persona,
  state,
  line,
  speaking,
  onRepeat,
  listening,
}: {
  persona: Persona;
  state: MascotState;
  line: string;
  speaking: boolean;
  onRepeat: () => void;
  listening?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      <span className={`relative block aspect-square w-[min(170px,42vw,22dvh)] shrink-0 rounded-full ${MASCOT_HALO[persona]} ${listening ? "listening" : ""}`}>
        <MascotFace persona={persona} state={state} className="absolute inset-0 h-full w-full" />
      </span>
      <div className="relative flex w-full flex-col gap-3 rounded-card border border-line bg-surface p-5" aria-live="polite">
        <span aria-hidden className="absolute -top-[9px] left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-t border-l border-line bg-surface" />
        <p className="text-lead font-semibold">{line || "Un momento…"}</p>
        <button
          type="button"
          onClick={onRepeat}
          className="inline-flex min-h-12 cursor-pointer items-center gap-1.5 self-start rounded-full bg-primary-soft px-3 text-body font-bold text-primary"
        >
          <Icon name={speaking ? "stop" : "volume_up"} fill size="1.4rem" />
          {speaking ? "Detener" : "Repetir"}
        </button>
      </div>
    </div>
  );
}

/** Companion picked on /acompanante (per device); Mateo by default */
export function savedPersona(): Persona {
  try {
    const saved = localStorage.getItem("vesta.persona");
    if (saved === "Mateo" || saved === "Emilia") return saved;
  } catch {}
  return "Mateo";
}
