// Deterministic guardrails around the LLM (AGENTS.md §3.6). They run on the server, before and
// after the model, and never depend on the network: an emergency phrase gets the fixed 131 answer
// even if the provider is down.

export function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Substring match after normalize(). Checked before the LLM is called.
const EMERGENCY_PHRASES = [
  "me cai",
  "no me puedo levantar",
  "me duele el pecho",
  "dolor en el pecho",
  "no puedo respirar",
  "me falta el aire",
  "auxilio",
  "llamen a una ambulancia",
];

// Medication decisions are never answered by the model: fixed referral to a professional.
const MEDICAL_PHRASES = [
  "me tomo otra",
  "tomo otra",
  "me la tomo de nuevo",
  "doble dosis",
  "me salto",
  "saltarme la",
  "cuanto me tomo",
  "cuantas me tomo",
  "que dosis",
  "dejo de tomar",
];

// "se tomó", "se la ha tomado", "tomó su": we only know a dose was registered, not swallowed
const INGESTION_CLAIM = /\b(se (la |lo )?(haya |ha )?(tomo|tomado)|tomo su)\b/;
// Suggestions must never put medication words in the person's mouth ("Ya tomé el Losartán")
const MEDICATION_WORDS = /\b(pastilla|remedio|medic|dosis|comprimido|tome|tomar|tomo|salte|salto|saltar)/;

export const isEmergency = (text: string) => EMERGENCY_PHRASES.some((p) => normalize(text).includes(p));
export const isMedicationQuestion = (text: string) => MEDICAL_PHRASES.some((p) => normalize(text).includes(p));

// The chat cannot notify anyone (alerts come only from the rules engine), so these texts never
// promise "le aviso a su hija": they point to 131 and to the contact's call button on screen.
export function emergencyReply(name: string, contactName?: string) {
  const call = contactName ? ` Si puede, llame también a ${contactName} con el botón de abajo.` : "";
  return `${name ? `${name}, esto` : "Esto"} es importante. Llame al 131 ahora.${call}`;
}

export function medicationReply(name: string) {
  return `Esa es una muy buena pregunta para su médico${name ? `, ${name}` : ""}. No cambie nada por su cuenta. Si se siente mal, llame al 131.`;
}

/** Drops any sentence that CLAIMS ingestion ("Qué bien que se la tomó"); questions stay, since the
 *  chat only records a dose when the person confirms it */
export function stripIngestionClaims(reply: string, name: string) {
  const sentences = reply.trim().split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((s) => s.trim().endsWith("?") || !INGESTION_CLAIM.test(normalize(s)));
  if (kept.length === sentences.length) return reply;
  return kept.join(" ") || `Aquí estoy para lo que necesite${name ? `, ${name}` : ""}.`;
}

/** Short, distinct tap-to-answer options; drops anything about medication or emergencies */
export function cleanSuggestions(raw: unknown, max = 3, maxChars = 32) {
  const out: string[] = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    const text = String(item).replace(/\s+/g, " ").trim().replace(/^[ .]+|[ .]+$/g, "");
    const n = normalize(text);
    if (!text || text.length > maxChars || out.some((o) => normalize(o) === n)) continue;
    if (MEDICATION_WORDS.test(n) || isEmergency(text) || isMedicationQuestion(text)) continue;
    out.push(text);
  }
  return out.slice(0, max);
}
