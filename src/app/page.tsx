import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";

// Entry point: welcome → onboarding (no confirmed modules yet) → home
export default async function Root() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/bienvenida");

  const { count } = await supabase
    .from("user_modules")
    .select("module_id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("confirmed", true);

  redirect(count ? "/inicio" : "/onboarding/ficha");
}
