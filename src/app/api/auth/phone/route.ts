import { toChileanMobile } from "@/lib/phone";
import { getServerSupabase } from "@/lib/supabase/server";

// Phone login for the demo: POST { phone } → { ok: true } and the Supabase session cookie.
// DEMO SIMPLIFICATION, declare it (AGENTS.md §3.7): there is no SMS code. A number listed in
// LOGIN_PHONES (server-only) signs in as the demo user (DEMO_USER_EMAIL / DEMO_USER_PASSWORD).
// A real version needs Supabase phone auth with an SMS provider (OTP), configured in the dashboard.

function allowedPhones() {
  return (process.env.LOGIN_PHONES ?? "")
    .split(",")
    .map((p) => toChileanMobile(p))
    .filter((p): p is string => Boolean(p));
}

export async function POST(request: Request) {
  const { phone } = (await request.json().catch(() => ({}))) as { phone?: string };
  const normalized = toChileanMobile(phone ?? "");
  if (!normalized) return Response.json({ error: "invalid_phone" }, { status: 400 });
  if (!allowedPhones().includes(normalized)) return Response.json({ error: "not_allowed" }, { status: 403 });

  const email = process.env.DEMO_USER_EMAIL;
  const password = process.env.DEMO_USER_PASSWORD;
  if (!email || !password) return Response.json({ error: "demo_user_not_configured" }, { status: 503 });

  // The server client writes the session cookies on this response (route handlers may set cookies)
  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("[auth/phone] sign-in failed:", error.message);
    return Response.json({ error: "sign_in_failed" }, { status: 502 });
  }
  return Response.json({ ok: true });
}
