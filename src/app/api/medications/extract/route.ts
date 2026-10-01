import { anthropic } from "@ai-sdk/anthropic";
import { generateText, Output } from "ai";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";

// Extracts the pills the person says or types on /mis-remedios.
//   POST { text, known?: string[], last?: string } → { medications: Med[], fallback: boolean }
//   Med = { name, strength: "50 mg" | null, quantity: number | null }
// "tomo losartán de cincuenta miligramos, una en la mañana" → [{ Losartán, "50 mg", 1 }].
// It only transcribes what was said: never suggests, completes or corrects a dose (AGENTS.md §3.6).
// The person sees each pill on screen and confirms before saving (§3.8).

const med = z.object({
  name: z.string(),
  strength: z.string().nullable(),
  quantity: z.number().nullable(),
});
const schema = z.object({ medications: z.array(med) });

const INSTRUCTIONS = `Extraes los remedios (pastillas) que una persona mayor dice que toma. El texto viene de un dictado por voz en español de Chile y puede tener errores de transcripción y relleno.

Para cada remedio devuelve:
- name: el nombre del remedio, con mayúscula inicial y bien escrito si el dictado lo deformó ("lo sartán" → "Losartán", "metformina" → "Metformina"). No lo cambies por otro remedio.
- strength: de cuánto es cada pastilla, con números y la unidad abreviada: "cincuenta miligramos" → "50 mg", "un gramo" → "1 g", "cien microgramos" → "100 mcg". Si no lo dice, null. Si dice "gramos" con un número de 5 o más (por ejemplo "50 gramos"), es casi seguro que quiso decir miligramos: escribe "mg".
- quantity: cuántas pastillas toma cada vez, como número ("una" → 1, "media" → 0.5, "dos" → 2). Si no lo dice, null.

REGLAS
- Solo lo que la persona dijo. Nunca inventes ni completes una dosis, y nunca sugieras cambiarla.
- Si dice solo el número sin unidad ("metformina 850"), usa "mg".
- Solo los remedios que toma LA PERSONA que habla. Ignora los que toma otra persona y los que dice que NO toma o que dejó:
  "mi señora toma omeprazol, yo no" → lista vacía; "antes tomaba aspirina, ya no" → lista vacía; "mi hijo me compra el losartán" → Losartán (lo toma quien habla).
- Ignora enfermedades y horarios.
- Si solo dice los miligramos o la cantidad sin nombrar el remedio ("es de 50", "tomo dos"), aplícalo al remedio de "ultimo" y devuelve ese nombre.
- Si un remedio ya está en "ya_anotados" y la persona agrega datos nuevos de él, devuélvelo con el mismo nombre.
- Si no hay ninguno, devuelve una lista vacía.`;

export async function POST(request: Request) {
  const { text = "", known = [], last } = (await request.json().catch(() => ({}))) as { text?: string; known?: string[]; last?: string };
  if (!text.trim()) return Response.json({ medications: [], fallback: false });

  // /api/ is public in proxy.ts and the LLM costs money: outside local dev it needs a session
  if (process.env.NODE_ENV === "production") {
    const { data } = await (await getServerSupabase()).auth.getUser();
    if (!data.user) return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { output } = await generateText({
      model: anthropic(process.env.ANTHROPIC_MODEL || "claude-haiku-4-5"),
      instructions: INSTRUCTIONS,
      prompt: JSON.stringify({ texto: text.slice(0, 500), ya_anotados: known.slice(0, 30), ultimo: last ?? null }),
      output: Output.object({ schema }),
      maxOutputTokens: 300,
      maxRetries: 0,
      timeout: 8_000,
    });
    const medications = output.medications
      .map((m) => ({
        name: m.name.replace(/\s+/g, " ").trim().slice(0, 60),
        strength: m.strength?.replace(/\s+/g, " ").trim().slice(0, 20) || null,
        quantity: typeof m.quantity === "number" && m.quantity > 0 && m.quantity <= 10 ? m.quantity : null,
      }))
      .filter((m) => m.name.length > 1)
      .slice(0, 10);
    return Response.json({ medications, fallback: false });
  } catch (err) {
    console.error("[medications/extract] LLM unavailable:", err instanceof Error ? err.message : err);
    return Response.json({ medications: [], fallback: true });
  }
}
