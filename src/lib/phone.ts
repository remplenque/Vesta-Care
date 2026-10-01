/**
 * Chilean mobile number → E.164 ("+56912345678"), or null if it isn't one.
 * Accepts what people actually type: "9 1234 5678", "+56 9 1234 5678", "56912345678".
 */
export function toChileanMobile(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("56")) digits = digits.slice(2);
  return /^9\d{8}$/.test(digits) ? `+56${digits}` : null;
}


/** "+569XXXXXXXX" → "9 XXXX XXXX" for reading on screen */
export function displayMobile(e164: string) {
  const d = e164.replace(/^\+56/, "");
  return `${d.slice(0, 1)} ${d.slice(1, 5)} ${d.slice(5)}`;
}

/** Digit by digit, so the voice reads "nueve, cinco, cuatro…" instead of "cinco mil…" */
export function spokenMobile(e164: string) {
  return e164.replace(/^\+56/, "").split("").join(", ");
}
