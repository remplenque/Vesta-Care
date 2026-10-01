import { anthropic } from "@ai-sdk/anthropic";
import { generateText, Output } from "ai";
import { z } from "zod";
import { loadCareData, type CareData } from "@/lib/data";
import { validateActions } from "@/lib/mateo/actions";
import { mateoContext } from "@/lib/mateo/context";
import { instructions, PERSONAS, type Persona } from "@/lib/mateo/prompt";
import {
  cleanSuggestions,
  emergencyReply,
  isEmergency,
  isMedicationQuestion,
  medicationReply,
  normalize,
  stripIngestionClaims,
} from "@/lib/mateo/safety";
import { getServerSupabase } from "@/lib/supabase/server";

// Mateo's chat (acta §6). Contract used by the chat screen:
//   POST { messages: { role: "user" | "assistant", content: string }[], persona?: "Mateo" | "Emilia" }
//     → { reply: string, suggestions: string[], actions: MateoAction[], fallback: boolean }
// actions are only PROPOSALS (validated against the person's data): the chat asks for confirmation
// and the app writes them with the user's session. See src/lib/mateo/actions.ts.
// Order: fixed safety filters (no network) → LLM with a read-only summary of the day → output guards.
// Mateo never diagnoses, never changes a dose and always points to a professional or 131 (AGENTS.md §3.6).
// Provider by configuration (docs/OPEN-ISSUES.md #4): ANTHROPIC_API_KEY + ANTHROPIC_MODEL.
// TODO(P3): tools (get_readings, explain_alert…) can replace the precomputed summary later.

type Msg = { role: "user" | "assistant"; content: string };

const START_SUGGESTIONS = ["¿Cómo estoy hoy?", "¿Qué hago?", "Cuénteme algo bonito"];
const SAFETY_SUGGESTIONS = ["Ya estoy mejor", "¿Qué hago?"];
const MEDICATION_SUGGESTIONS = ["Gracias", "¿Cómo estoy hoy?", "Conversemos de otra cosa"];

const schema = z.object({
  reply: z.string(),
  suggestions: z.array(z.string()),
  actions: z.array(
    z.object({
      type: z.enum(["dose_taken", "dose_not_taken", "add_medication"]),
      ref: z.string().nullable(),
      name: z.string().nullable(),
      strength: z.string().nullable(),
      quantity: z.number().nullable(),
      times: z.array(z.string()).nullable(),
    }),
  ),
});
const CONFIRM_SUGGESTIONS = ["Sí, anótelo", "No"];

async function loadForRequest(): Promise<{ data: CareData | null; signedIn: boolean }> {
  try {
    const supabase = await getServerSupabase();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { data: null, signedIn: false };
    // Same RLS-bound reads as the PWA: the server client carries the user's session
    return { data: await loadCareData(supabase as unknown as Parameters<typeof loadCareData>[0], auth.user.id), signedIn: true };
  } catch {
    return { data: null, signedIn: false };
  }
}

// "Me tomé el losartán" is handled by a small, history-free step: the conversation may contain an
// old "ya está anotado" that would make the chat model skip it. It only picks WHICH dose of today
// the person means; the code checks it and the app writes it.
const TOOK = /\b(me (la |lo |las |los )?tome|ya (me )?(la |lo |las |los )?tome|tome (el|la|los|las|mi|mis)\b|ya (la |lo )?tome)/;
const DIDNT = /\b(no (me )?(la |lo |las |los )?tome|se me olvido|olvide)/;

async function pickDose(text: string, doses: { ref: string; remedio: string; hora: string; estado: string }[]) {
  if (!doses.length) return null;
  const { output } = await generateText({
    model: anthropic(process.env.ANTHROPIC_MODEL || "claude-haiku-4-5"),
    instructions: `La persona dice que ya se tomó un remedio. Elige cuál de "remedios_de_hoy" es y devuelve su "ref".
- Si nombra el remedio, usa ese; si dice "de la mañana", "de la noche" o una hora, usa esa toma.
- Si no dice cuál y hay una sola toma pendiente que le toca ahora, usa esa.
- Prefiere tomas que no estén "registrada"; si la única que calza ya está "registrada", devuelve esa igual.
- Si no queda claro cuál es (por ejemplo, "me tomé la pastilla" y hay varias pendientes), devuelve ref null.`,
    prompt: JSON.stringify({ dice: text.slice(0, 300), remedios_de_hoy: doses }),
    output: Output.object({ schema: z.object({ ref: z.string().nullable() }) }),
    maxOutputTokens: 100,
    maxRetries: 0,
    timeout: 6_000,
  });
  return doses.find((d) => d.ref === output.ref) ?? null;
}

/** The day's state rides on the LAST user message, so it outranks older turns (an earlier
 *  "ya está anotado" in the history must not beat what the pillbox says now). The history starts
 *  at a user turn, as the API expects. */
function withState(messages: Msg[], ctx: unknown): Msg[] {
  const firstUser = messages.findIndex((m) => m.role === "user");
  const turns = firstUser < 0 ? [] : messages.slice(firstUser);
  const lastUser = turns.findLastIndex((m) => m.role === "user");
  if (lastUser < 0) return [{ role: "user", content: `<estado>${JSON.stringify(ctx)}</estado>` }];
  return turns.map((m, i) => (i === lastUser ? { ...m, content: `<estado>${JSON.stringify(ctx)}</estado>\n\n${m.content}` } : m));
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { messages?: Msg[]; persona?: string };
  const persona: Persona = PERSONAS.includes(body.persona as Persona) ? (body.persona as Persona) : "Mateo";
  const messages = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-12);
  const last = messages.findLast((m) => m.role === "user")?.content ?? "";

  const { data, signedIn } = await loadForRequest();
  // /api/ is public in proxy.ts and the LLM costs money: outside local dev it needs a session
  if (!signedIn && process.env.NODE_ENV === "production") {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const ctx = mateoContext(data);
  const name = ctx.persona.nombre ?? "";

  if (isEmergency(last)) {
    return Response.json({ reply: emergencyReply(name, ctx.contacto?.nombre), suggestions: SAFETY_SUGGESTIONS, fallback: true });
  }
  if (isMedicationQuestion(last)) {
    return Response.json({ reply: medicationReply(name), suggestions: MEDICATION_SUGGESTIONS, fallback: true });
  }

  // "Me tomé…": register it straight away (the sentence is the confirmation) → just "Anotado."
  const said = normalize(last);
  if (data && TOOK.test(said) && !DIDNT.test(said)) {
    try {
      const dose = await pickDose(last, ctx.remedios_de_hoy);
      if (dose?.estado === "registrada") {
        return Response.json({ reply: `Ya estaba anotado${name ? `, ${name}` : ""}. Bien hecho.`, suggestions: START_SUGGESTIONS, actions: [], fallback: false });
      }
      const actions = dose
        ? validateActions([{ type: "dose_taken", ref: dose.ref, name: null, strength: null, quantity: null, times: null }], data, data.profile?.timezone ?? undefined)
        : [];
      if (actions.length) return Response.json({ reply: "Anotado.", suggestions: START_SUGGESTIONS, actions, fallback: false });
    } catch (err) {
      console.error("[mateo] pickDose failed, continuing with the chat:", err instanceof Error ? err.message : err);
    }
  }

  try {
    const { output } = await generateText({
      model: anthropic(process.env.ANTHROPIC_MODEL || "claude-haiku-4-5"),
      instructions: instructions(persona),
      messages: withState(messages, ctx),
      output: Output.object({ schema }),
      maxOutputTokens: 700,
      maxRetries: 0,
      timeout: 10_000, // voice: a long wait feels broken, so fail fast and fall back
    });
    const actions = validateActions(output.actions, data, data?.profile?.timezone ?? undefined);
    if (output.actions.length !== actions.length) console.warn("[mateo] dropped proposals:", JSON.stringify(output.actions));
    // "¿Se la tomó?" is fine to ask now: the app records a dose only when the person confirms it
    const reply = actions.length ? output.reply : stripIngestionClaims(output.reply, name);
    const suggestions = actions.length ? CONFIRM_SUGGESTIONS : cleanSuggestions(output.suggestions);
    return Response.json({ reply, suggestions: suggestions.length ? suggestions : START_SUGGESTIONS, actions, fallback: false });
  } catch (err) {
    console.error("[mateo] LLM unavailable, using fallback:", err instanceof Error ? err.message : err);
    const reply = /qu[eé] hago|mareado|mareo|dolor|me siento mal/i.test(last)
      ? "Siéntese y respire con calma. No tome pastillas extra por su cuenta. Si el mareo aumenta, le duele el pecho o le cuesta hablar, llame al 131 ahora."
      : `Disculpe${name ? `, ${name}` : ""}, ahora no puedo pensar bien la respuesta. ¿Lo intentamos de nuevo en un momento? Si se siente mal, llame al 131.`;
    return Response.json({ reply, suggestions: START_SUGGESTIONS, fallback: true });
  }
}
