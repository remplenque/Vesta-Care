import { getServerSupabase } from "@/lib/supabase/server";

// TEMPORARY demo shortcut: POST → signs in as Luis (DEMO_USER_EMAIL / DEMO_USER_PASSWORD, server
// only) and sets the Supabase session cookie. Used by the "Entrar como Luis" button on /ingresar.
// Anyone with the URL can enter the demo account (fictional data, AGENTS.md §3.7). Remove it
// together with the button once the phone login is configured for the demo.

export async function POST() {
  const email = process.env.DEMO_USER_EMAIL;
  const password = process.env.DEMO_USER_PASSWORD;
  if (!email || !password) return Response.json({ error: "demo_user_not_configured" }, { status: 503 });

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("[auth/demo] sign-in failed:", error.message);
    return Response.json({ error: "sign_in_failed" }, { status: 502 });
  }
  return Response.json({ ok: true });
}
