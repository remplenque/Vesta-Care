import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// Demo operator only: puts Don Luis back in a known state (reset_demo 'onboarding' | 'full').
// reset_demo is not callable by anon, so this runs server-side either with the service role key
// or by signing in as the demo user (DEMO_USER_EMAIL / DEMO_USER_PASSWORD). Server-only env vars.

export async function POST(request: Request) {
  const { mode } = (await request.json().catch(() => ({}))) as { mode?: string };
  if (mode !== "onboarding" && mode !== "full") return Response.json({ error: "mode must be onboarding | full" }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const userId = process.env.NEXT_PUBLIC_DEMO_USER_ID;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const options = { auth: { persistSession: false, autoRefreshToken: false } };

  let client;
  if (serviceKey) {
    client = createClient<Database>(url, serviceKey, options);
  } else if (process.env.DEMO_USER_EMAIL && process.env.DEMO_USER_PASSWORD) {
    client = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, options);
    const { error } = await client.auth.signInWithPassword({ email: process.env.DEMO_USER_EMAIL, password: process.env.DEMO_USER_PASSWORD });
    if (error) return Response.json({ error: "demo sign-in failed" }, { status: 500 });
  } else {
    return Response.json({ error: "Set SUPABASE_SERVICE_ROLE_KEY or DEMO_USER_EMAIL/DEMO_USER_PASSWORD" }, { status: 501 });
  }

  const { data, error } = await client.rpc("reset_demo", { p_mode: mode, p_user_id: userId || undefined });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
