import { errorMessage, simulateTick } from "@/lib/demo-server";
import { PERSONAS, personaByKey, type PersonaKey } from "@/lib/personas";
import { getAdminSupabase } from "@/lib/supabase/admin";

// One simulator tick: POST { personas?: ("luis" | "rosa" | "jorge")[] } → readings ingested per
// persona. The /demo panel calls it every TICK_MS while the simulator is on. Values go through
// ingest_reading / ingest_bp with source 'simulator'; the SQL rules engine decides the alerts.
// Demo-only and public like the rest of /api/demo: it can only write to the three personas.

export async function POST(request: Request) {
  const admin = getAdminSupabase();
  if (!admin) return Response.json({ error: "Set SUPABASE_SERVICE_ROLE_KEY" }, { status: 501 });

  const body = (await request.json().catch(() => ({}))) as { personas?: unknown };
  const keys = Array.isArray(body.personas)
    ? body.personas.filter((k): k is PersonaKey => Boolean(personaByKey(k)))
    : PERSONAS.map((p) => p.key);

  try {
    return Response.json({ ts: new Date().toISOString(), results: await simulateTick(admin, keys) });
  } catch (e) {
    return Response.json({ error: errorMessage(e) }, { status: 500 });
  }
}
