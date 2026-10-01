import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { GUIDED_START_PATH, HOME_PATH } from "@/lib/nav";

// Entry point: welcome → guided first steps (companion, caregivers, ficha, remedies) for a new
// account → home (the companion screen). Anything already entered means the person has started
export default async function Root() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/bienvenida");

  const counts = await Promise.all(
    (["user_modules", "medications", "conditions", "emergency_contacts"] as const).map(async (table) => {
      const { count } = await supabase.from(table).select("user_id", { count: "exact", head: true }).eq("user_id", user.id);
      return count ?? 0;
    }),
  );

  redirect(counts.some((n) => n > 0) ? HOME_PATH : GUIDED_START_PATH);
}
