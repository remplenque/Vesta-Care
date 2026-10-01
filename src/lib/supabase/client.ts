import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

// Browser client with the public key: RLS protects every table (AGENTS.md §3.4)
export function getSupabase() {
  client ??= createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return client;
}
