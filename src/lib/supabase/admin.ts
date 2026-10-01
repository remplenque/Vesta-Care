import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// Service-role client, bypasses RLS. SERVER ONLY (AGENTS.md §3.5): route handlers under
// /api/demo/* use it to create, reset and simulate the demo personas. Never import it from a
// client component. Returns null when SUPABASE_SERVICE_ROLE_KEY is not set.
export function getAdminSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type AdminSupabase = NonNullable<ReturnType<typeof getAdminSupabase>>;
