import { createClient } from "@supabase/supabase-js";
import { errorMessage, resetPersona } from "@/lib/demo-server";
import { personaByKey } from "@/lib/personas";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type { Database } from "@/types/supabase";

// Demo operator only: POST { persona?: "luis" | "rosa" | "jorge", mode?: "full" | "onboarding" }
// puts a persona back in a known state (persona defaults to luis).
// - With SUPABASE_SERVICE_ROLE_KEY: creates the account if missing (rosa, jorge) and seeds it
//   (lib/demo-server.ts → reset_demo + persona extras). Jorge always restarts as a new account.
// - Without it: only Luis, signing in as the demo user (DEMO_USER_EMAIL / DEMO_USER_PASSWORD),
//   because reset_demo is not callable by anon. Server-only env vars.

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { persona?: string; mode?: string };
  const persona = personaByKey(body.persona ?? "luis");
  if (!persona) return Response.json({ error: "persona must be luis | rosa | jorge" }, { status: 400 });
  const mode = body.mode ?? "full";
  if (mode !== "onboarding" && mode !== "full") return Response.json({ error: "mode must be onboarding | full" }, { status: 400 });

  const admin = getAdminSupabase();
  if (admin) {
    try {
      return Response.json(await resetPersona(admin, persona, mode));
    } catch (e) {
      return Response.json({ error: errorMessage(e) }, { status: 500 });
    }
  }

  if (persona.key !== "luis") return Response.json({ error: "Set SUPABASE_SERVICE_ROLE_KEY to create and reset the other personas" }, { status: 501 });
  if (!process.env.DEMO_USER_EMAIL || !process.env.DEMO_USER_PASSWORD) {
    return Response.json({ error: "Set SUPABASE_SERVICE_ROLE_KEY or DEMO_USER_EMAIL/DEMO_USER_PASSWORD" }, { status: 501 });
  }

  const client = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: authError } = await client.auth.signInWithPassword({ email: process.env.DEMO_USER_EMAIL, password: process.env.DEMO_USER_PASSWORD });
  if (authError) return Response.json({ error: "demo sign-in failed" }, { status: 500 });

  const { data, error } = await client.rpc("reset_demo", { p_mode: mode, p_user_id: process.env.NEXT_PUBLIC_DEMO_USER_ID || undefined });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
