import { ELEVENLABS_URL, MAX_TTS_CHARS, ttsAllowed, ttsConfigured, ttsVoices } from "@/lib/mateo/tts";

// GET /api/tts?text=…&voice=Mateo → audio/mpeg (ElevenLabs). 503 when not configured or failing:
// the chat then speaks with the browser voice. The client caches the audio, so "Repetir" replays
// the same recording without calling this again.
export async function GET(request: Request) {
  if (!(await ttsAllowed())) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!ttsConfigured()) return Response.json({ error: "tts_not_configured" }, { status: 503 });

  const url = new URL(request.url);
  const text = (url.searchParams.get("text") ?? "").trim().slice(0, MAX_TTS_CHARS);
  const voices = ttsVoices();
  const voice = url.searchParams.get("voice") ?? Object.keys(voices)[0];
  if (!text) return Response.json({ error: "empty_text" }, { status: 400 });
  if (!voices[voice]) return Response.json({ error: "unknown_voice" }, { status: 400 });

  try {
    const upstream = await fetch(`${ELEVENLABS_URL}/${voices[voice]}/stream?output_format=mp3_44100_128`, {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_MODEL || "eleven_flash_v2_5",
        voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: 0.9 }, // 0.9: ACCESSIBILITY §7
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!upstream.ok || !upstream.body) {
      console.error("[tts] ElevenLabs", upstream.status, (await upstream.text().catch(() => "")).slice(0, 300));
      return Response.json({ error: `tts_upstream_${upstream.status}` }, { status: 503 });
    }
    return new Response(upstream.body, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
  } catch (err) {
    console.error("[tts] ElevenLabs unreachable:", err instanceof Error ? err.message : err);
    return Response.json({ error: "tts_unreachable" }, { status: 503 });
  }
}
