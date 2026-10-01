// Demo wiring (public by design: the demo user id and the contact token are not secrets of value;
// the data behind them is fictional). See .env.example.
export const DEMO_USER_ID = process.env.NEXT_PUBLIC_DEMO_USER_ID ?? "";
export const DEMO_CONTACT_TOKEN = process.env.NEXT_PUBLIC_DEMO_CONTACT_TOKEN ?? "";

/** Splits "… Revisa su estado: /c/<uuid>" into text + contact-view link */
export function splitContactLink(body: string): { text: string; token: string | null } {
  const m = body.match(/\s*Revisa su estado:\s*\/c\/([0-9a-f-]{36})\s*$/i);
  if (!m) return { text: body, token: null };
  return { text: body.slice(0, m.index).trim(), token: m[1] };
}
