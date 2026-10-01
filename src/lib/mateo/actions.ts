import type { CareData } from "@/lib/data";
import { medLabel, todaySlots } from "@/lib/pillbox";
import { DEFAULT_TZ } from "@/lib/time";
import { normalize } from "./safety";

// Changes Mateo can PROPOSE from the chat. The model never writes anything: /api/mateo validates
// each proposal against the person's real data, the chat shows it as a card, and only after the
// person confirms ("Sí, anótelo") does the app write it with the user's session (AGENTS.md §3.8).
//   dose_taken      → readings.dose_taken via ingest_reading (same as the Pastillero's button).
//                     Exception agreed with the team: written right away when the person says they
//                     took it (that sentence is the confirmation); the chat says "Anotado" and offers
//                     "Deshacer". The other two still wait for "sí".
//   dose_not_taken  → removes today's dose_taken record for that dose (same as its "Deshacer")
//   add_medication  → new row in medications (dose "50 mg · 1 pastilla", schedule.times)

export type MateoAction =
  | { type: "dose_taken"; ref: string; label: string }
  | { type: "dose_not_taken"; ref: string; label: string }
  | { type: "add_medication"; name: string; dose: string | null; times: string[]; label: string };

/** Loose shape the model returns (flat, nullable fields: easier for structured output) */
export type RawAction = {
  type: "dose_taken" | "dose_not_taken" | "add_medication";
  ref: string | null;
  name: string | null;
  strength: string | null;
  quantity: number | null;
  times: string[] | null;
};

function qty(q: number | null) {
  if (q == null || q <= 0 || q > 10) return null;
  return q === 0.5 ? "½ pastilla" : q === 1 ? "1 pastilla" : `${q} pastillas`;
}

const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;

/** Keeps only proposals that make sense for this person right now; drops the rest silently */
export function validateActions(raw: RawAction[], data: CareData | null, tz = DEFAULT_TZ): MateoAction[] {
  if (!data) return [];
  const slots = todaySlots(data.medications, data.readings, tz);
  const out: MateoAction[] = [];
  for (const a of raw.slice(0, 3)) {
    if (a.type === "dose_taken" || a.type === "dose_not_taken") {
      const slot = slots.find((s) => `${s.medication.id}|${s.time}` === a.ref);
      if (!slot) continue;
      if (a.type === "dose_taken" && slot.status === "taken") continue; // already registered
      if (a.type === "dose_not_taken" && slot.status !== "taken") continue; // nothing to undo
      if (out.some((o) => "ref" in o && o.ref === a.ref)) continue;
      out.push({
        type: a.type,
        ref: a.ref!,
        label: `${a.type === "dose_taken" ? "Anotar como tomada" : "Quitar la marca de tomada"}: ${medLabel(slot.medication)} de las ${slot.time}`,
      });
    } else if (a.type === "add_medication") {
      const name = (a.name ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
      if (name.length < 2) continue;
      if (data.medications.some((m) => normalize(m.name) === normalize(name))) continue; // already saved
      const dose = [a.strength?.trim() || null, qty(a.quantity)].filter(Boolean).join(" · ") || null;
      const times = [...new Set((a.times ?? []).filter((t) => HHMM.test(t)).map((t) => t.padStart(5, "0")))].sort();
      const proper = name.charAt(0).toUpperCase() + name.slice(1);
      out.push({
        type: "add_medication",
        name: proper,
        dose,
        times,
        label: `Agregar ${[proper, dose].filter(Boolean).join(" ")}${times.length ? `, a las ${times.join(" y ")}` : ", sin hora"}`,
      });
    }
  }
  return out;
}
