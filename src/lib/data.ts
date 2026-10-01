import type { Tables } from "@/types/supabase";
import type { getSupabase } from "./supabase/client";

export type Profile = Tables<"profiles">;
export type Contact = Tables<"emergency_contacts">;
export type Medication = Tables<"medications">;
export type Module = Tables<"modules">;
export type UserModule = Tables<"user_modules">;
export type Reading = Tables<"readings">;
export type Alert = Tables<"alerts">;
export type Goal = Tables<"goals">;
export type ChatMessage = Tables<"chat_messages">;
export type MedicalRecord = Tables<"medical_records">;

export type ManifestMetric = { key: string; unit: string; label: string };
export type Manifest = {
  id: string;
  name: string;
  status: "active" | "proposed";
  conditions?: string[];
  metrics?: ManifestMetric[];
  expectedFrequency?: string;
  defaultThresholds?: Record<string, { normal: [number, number]; margin?: number }>;
  goals?: string[];
  agentContext?: string;
};

export function manifestOf(m: Module | undefined): Manifest | undefined {
  return m?.manifest as unknown as Manifest | undefined;
}

export type CareData = {
  profile: Profile | null;
  contacts: Contact[];
  medications: Medication[];
  modules: Module[];
  userModules: UserModule[];
  readings: Reading[]; // last 8 days, ascending
  alerts: Alert[]; // last 7 days, descending
  goals: Goal[];
};

type Client = ReturnType<typeof getSupabase>;

export async function loadCareData(supabase: Client, userId: string): Promise<CareData> {
  const since = new Date(Date.now() - 8 * 86_400_000).toISOString();
  const alertsSince = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [profile, contacts, medications, modules, userModules, readings, alerts, goals] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("emergency_contacts").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("medications").select("*").eq("user_id", userId).order("name"),
    supabase.from("modules").select("*"),
    supabase.from("user_modules").select("*").eq("user_id", userId),
    // Newest first so the limit drops the oldest readings, not the live ones from the simulator
    supabase.from("readings").select("*").eq("user_id", userId).gte("ts", since).order("ts", { ascending: false }).limit(2000),
    supabase.from("alerts").select("*").eq("user_id", userId).gte("ts", alertsSince).order("ts", { ascending: false }).limit(50),
    supabase.from("goals").select("*").eq("user_id", userId),
  ]);

  return {
    profile: profile.data,
    contacts: contacts.data ?? [],
    medications: medications.data ?? [],
    modules: modules.data ?? [],
    userModules: userModules.data ?? [],
    readings: (readings.data ?? []).reverse(),
    alerts: alerts.data ?? [],
    goals: goals.data ?? [],
  };
}
