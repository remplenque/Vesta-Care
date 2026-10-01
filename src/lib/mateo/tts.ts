import { getServerSupabase } from "@/lib/supabase/server";

// ElevenLabs text-to-speech, server side only: the API key never reaches the browser.
// ELEVENLABS_VOICES="Mateo:<voice_id>,Emilia:<voice_id>" maps each companion to a voice.
// Optional: without it the PWA keeps the browser voice (docs/ACCESSIBILITY.md §7 still holds).

export const ELEVENLABS_URL = "https://api.elevenlabs.io/v1/text-to-speech";
export const MAX_TTS_CHARS = 600; // replies are 3 short sentences; caps credit spend

export function ttsVoices(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const item of (process.env.ELEVENLABS_VOICES ?? "").split(",")) {
    const [name, id] = item.split(":").map((s) => s?.trim());
    if (name && id) out[name] = id;
  }
  return out;
}

export function ttsConfigured() {
  return Boolean(process.env.ELEVENLABS_API_KEY && Object.keys(ttsVoices()).length);
}

/** /api/ is public in proxy.ts; TTS spends credits, so outside local dev it needs a session */
export async function ttsAllowed() {
  if (process.env.NODE_ENV !== "production") return true;
  try {
    const supabase = await getServerSupabase();
    const { data } = await supabase.auth.getUser();
    return Boolean(data.user);
  } catch {
    return false;
  }
}
