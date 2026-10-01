import type { Persona } from "@/lib/mateo/prompt";

// The companion's face (comic-strip style, original characters). It is also the mic button on
// /mateo. States: idle (slow blink, gentle float), listening (raised brows), thinking (eyes up),
// speaking (mouth moves). All motion stops with prefers-reduced-motion (globals.css).

export type MascotState = "idle" | "listening" | "thinking" | "speaking";

const INK = "mascot-ink";

function Emilia() {
  return (
    <g className="mascot-float">
      <path className={INK} fill="#6B3F2A" d="M52 112 C42 62 72 34 110 34 C148 34 178 62 168 112 L176 188 C160 194 146 190 140 186 L80 186 C74 190 60 194 44 188 Z" />
      <path className={INK} fill="#C27A2C" d="M38 222 C42 194 70 180 110 180 C150 180 178 194 182 222 Z" />
      <path className={INK} fill="#FFFFFF" d="M94 181 L110 198 L126 181 Z" />
      <path className={INK} fill="#F5C9A3" d="M62 88 C64 62 84 52 110 52 C136 52 156 62 158 88 L162 126 C164 158 140 174 110 174 C80 174 56 158 58 126 Z" />
      <path className={INK} fill="#6B3F2A" d="M60 100 C56 62 84 46 112 48 C142 50 162 68 160 100 C152 80 134 68 108 70 C90 72 72 82 60 100 Z" />
      <path stroke="#9A6648" strokeWidth="2.5" strokeLinecap="round" fill="none" d="M84 60 q20 -6 40 2 M56 132 q-4 22 2 40 M164 132 q4 22 -2 40" />
      <circle className={INK} cx="60" cy="146" r="4.5" fill="#F4C04E" strokeWidth="2.5" />
      <circle className={INK} cx="160" cy="146" r="4.5" fill="#F4C04E" strokeWidth="2.5" />
      <g className="mascot-brows">
        <path fill="none" stroke="#4A2C1D" strokeWidth="3.5" strokeLinecap="round" d="M82 94 q9 -6 18 -1 M120 93 q9 -5 18 1" />
      </g>
      <g className="mascot-eyes">
        <ellipse cx="92" cy="108" rx="4.2" ry="7" fill="#1E1E1E" />
        <ellipse cx="128" cy="108" rx="4.2" ry="7" fill="#1E1E1E" />
        <path stroke="#1E1E1E" strokeWidth="2.5" strokeLinecap="round" d="M86 102 l-5 -3 M134 102 l5 -3" />
      </g>
      <circle cx="76" cy="134" r="8" fill="#F28B82" opacity=".45" />
      <circle cx="144" cy="134" r="8" fill="#F28B82" opacity=".45" />
      <ellipse className={INK} cx="110" cy="125" rx="8" ry="6.5" fill="#EF9C7E" />
      <path className={`${INK} mascot-smile`} fill="#9B2D3A" d="M86 142 Q110 172 134 142 Q110 152 86 142 Z" />
      <ellipse className={`${INK} mascot-talk`} cx="110" cy="151" rx="11" ry="9.5" fill="#9B2D3A" />
    </g>
  );
}

function Mateo() {
  return (
    <g className="mascot-float">
      <path className={INK} fill="#24425C" d="M30 222 C34 190 66 174 110 174 C154 174 186 190 190 222 Z" />
      <path className={INK} fill="#E8B48C" d="M88 150 L88 182 Q110 194 132 182 L132 150 Z" />
      <path className={INK} fill="#FFFFFF" d="M84 176 L110 196 L136 176 L132 204 L110 194 L88 204 Z" />
      <ellipse className={INK} cx="58" cy="112" rx="10" ry="14" fill="#E8B48C" />
      <ellipse className={INK} cx="162" cy="112" rx="10" ry="14" fill="#E8B48C" />
      <path className={INK} fill="#E8B48C" d="M62 84 C64 58 84 48 110 48 C136 48 156 58 158 84 L160 132 L144 160 Q110 178 76 160 L60 132 Z" />
      <path fill="#3B2A20" opacity=".22" d="M64 126 L76 156 Q110 174 144 156 L156 126 C150 146 132 154 110 154 C88 154 70 146 64 126 Z" />
      <path className={INK} fill="#2F2620" d="M60 96 C54 58 80 38 112 38 C144 38 168 58 160 96 L156 80 C150 70 140 66 128 66 C118 60 104 58 96 66 C84 66 70 72 64 82 Z" />
      <path className={INK} fill="none" d="M96 66 C100 54 110 46 122 44" />
      <g className="mascot-brows">
        <path fill="none" stroke="#2B1E16" strokeWidth="7" strokeLinecap="round" d="M80 92 L100 90 M120 90 L140 92" />
      </g>
      <g className="mascot-eyes">
        <ellipse cx="91" cy="106" rx="4.2" ry="7" fill="#1E1E1E" />
        <ellipse cx="129" cy="106" rx="4.2" ry="7" fill="#1E1E1E" />
      </g>
      <ellipse className={INK} cx="110" cy="124" rx="11" ry="9" fill="#E08C72" />
      <path className={`${INK} mascot-smile`} fill="#5A2323" d="M90 142 Q110 164 130 142 Q110 150 90 142 Z" />
      <ellipse className={`${INK} mascot-talk`} cx="110" cy="148" rx="10" ry="8.5" fill="#5A2323" />
    </g>
  );
}

export function MascotFace({ persona, state = "idle", className = "" }: { persona: Persona; state?: MascotState; className?: string }) {
  return (
    <svg viewBox="0 0 220 220" aria-hidden className={`mascot mascot-${state} ${className}`}>
      {persona === "Emilia" ? <Emilia /> : <Mateo />}
    </svg>
  );
}

/** Background halo per companion (warm for Emilia, blue for Mateo) */
export const MASCOT_HALO: Record<Persona, string> = { Mateo: "bg-primary-soft", Emilia: "bg-warn-soft" };
