import { normalize } from "./mateo/safety";

// Spoken or typed yes/no for confirmations. "No" wins over "sí" ("sí, no sé" → no) so nothing is
// ever saved by mistake.
const YES = /\b(si|claro|bueno|ya|dale|por supuesto|obvio|quiero|agregar|otra|anotelo|anotalo|anota|correcto|exacto)\b/;
const NO = /\b(no|nada|despues|luego|listo|ninguno|ninguna)\b/;

export function answerOf(text: string): "yes" | "no" | null {
  const t = normalize(text);
  if (NO.test(t)) return "no";
  if (YES.test(t)) return "yes";
  return null;
}
