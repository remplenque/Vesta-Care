import { errorMessage, loadPersonaStates } from "@/lib/demo-server";
import { getAdminSupabase } from "@/lib/supabase/admin";

// State of the three demo personas for the /demo panel: modules, latest vitals, recent alerts and
// contact-view tokens. Fictional data only (AGENTS.md §3.7).

export async function GET() {
  const admin = getAdminSupabase();
  if (!admin) return Response.json({ error: "Set SUPABASE_SERVICE_ROLE_KEY", personas: [] }, { status: 501 });
  try {
    return Response.json({ personas: await loadPersonaStates(admin) });
  } catch (e) {
    return Response.json({ error: errorMessage(e), personas: [] }, { status: 500 });
  }
}
