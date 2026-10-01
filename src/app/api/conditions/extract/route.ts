import { anthropic } from "@ai-sdk/anthropic";
import { generateText, Output } from "ai";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";

// Extracts condition names from what the person said or typed on /mi-ficha.
//   POST { text, known?: string[] } → { conditions: string[], fallback: boolean }
// "tengo la presión alta y también me dio diabetes hace años" → ["Presión alta", "Diabetes"].
// The model only extracts: it never adds a condition the person didn't say and never turns a
// symptom into a diagnosis (AGENTS.md §3.6). The person sees the list and confirms it (§3.8).

const schema = z.object({ conditions: z.array(z.string()) });

const INSTRUCTIONS = `Extraes los nombres de enfermedades o condiciones de salud que una persona mayor dice que tiene. El texto viene de un dictado por voz en español de Chile, puede tener errores de transcripción y relleno ("eh", "tengo", "me dijeron que").

REGLAS
- Devuelve solo las enfermedades o condiciones que la persona dice que TIENE. Nada más.
- Usa sus mismas palabras, limpias y cortas, con mayúscula inicial: "tengo la presión alta" → "Presión alta"; "me dio diabetes tipo dos" → "Diabetes tipo 2".
- Corrige errores evidentes del dictado ("artrosis" mal escrita, "diabetis" → "Diabetes"), pero no cambies el término por otro: "azúcar alta" sigue siendo "Azúcar alta", no "Diabetes".
- No conviertas síntomas en diagnósticos: "no puedo dormir bien" → "Problemas para dormir", nunca "Insomnio".
- Ignora lo que NO tiene ("no tengo diabetes"), lo que tiene otra persona ("mi señora tiene asma") y los remedios.
- Si una ya está en "ya_anotadas", no la repitas.
- Si no hay ninguna, devuelve una lista vacía.`;

export async function POST(request: Request) {
  const { text = "", known = [] } = (await request.json().catch(() => ({}))) as { text?: string; known?: string[] };
  if (!text.trim()) return Response.json({ conditions: [], fallback: false });

  // /api/ is public in proxy.ts and the LLM costs money: outside local dev it needs a session
  if (process.env.NODE_ENV === "production") {
    const { data } = await (await getServerSupabase()).auth.getUser();
    if (!data.user) return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { output } = await generateText({
      model: anthropic(process.env.ANTHROPIC_MODEL || "claude-haiku-4-5"),
      instructions: INSTRUCTIONS,
      prompt: JSON.stringify({ texto: text.slice(0, 500), ya_anotadas: known.slice(0, 30) }),
      output: Output.object({ schema }),
      maxOutputTokens: 200,
      maxRetries: 0,
      timeout: 8_000,
    });
    const seen = new Set<string>();
    const conditions = output.conditions
      .map((c) => c.replace(/\s+/g, " ").trim().slice(0, 60))
      .filter((c) => c.length > 1 && !seen.has(c.toLowerCase()) && seen.add(c.toLowerCase()))
      .slice(0, 10);
    return Response.json({ conditions, fallback: false });
  } catch (err) {
    console.error("[conditions/extract] LLM unavailable:", err instanceof Error ? err.message : err);
    return Response.json({ conditions: [], fallback: true });
  }
}
