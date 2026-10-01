// TODO(P3 · Mateo/IA): replace this stub with the real agent (Vercel AI SDK + tools: get_readings,
// get_adherence, get_thresholds, get_goals, explain_alert…, acta §6). The provider is still open
// (docs/OPEN-ISSUES.md #4). Contract used by the chat screen:
//   POST { messages: { role: "user" | "assistant", content: string }[] }  →  { reply: string }
// Mateo never diagnoses, never changes a dose and always points to a professional or 131 (AGENTS.md §3.6).

type Msg = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  const { messages = [] } = (await request.json().catch(() => ({}))) as { messages?: Msg[] };
  const last = messages.findLast((m) => m.role === "user")?.content.toLowerCase() ?? "";

  let reply =
    "Todavía estoy aprendiendo a conversar: muy pronto podré responderle con sus datos. Si se siente mal, llame al 131.";
  if (/qu[eé] hago|mareado|mareo|dolor|me siento mal/.test(last)) {
    reply =
      "Siéntese y respire con calma. No tome pastillas extra por su cuenta. Si el mareo aumenta, le duele el pecho o le cuesta hablar, llame al 131 ahora.";
  } else if (/c[oó]mo estoy/.test(last)) {
    reply = "Puede ver sus lecturas de hoy en la pantalla de inicio. Pronto podré resumírselas yo mismo.";
  }

  return Response.json({ reply, stub: true });
}
