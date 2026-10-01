import { ttsConfigured, ttsVoices } from "@/lib/mateo/tts";

// GET /api/tts/voices → [{ name }]: companions that have a natural (ElevenLabs) voice.
// Empty list = use the browser voice. Voice ids stay on the server.
export async function GET() {
  return Response.json(ttsConfigured() ? Object.keys(ttsVoices()).map((name) => ({ name })) : []);
}
