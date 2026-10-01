import type { Thresholds } from "./rules";

// Shape returned by public.get_contact_view(p_token) — supabase/migrations/*_03_rpcs.sql
export type ContactView = {
  contact: { name: string; relation: string | null };
  patient: { full_name: string | null; birth_date: string | null; timezone: string | null };
  modules: { module_id: string; name: string; thresholds: Record<string, unknown> | null }[];
  latest_readings: { module_id: string; metric: string; value: number; unit: string | null; ts: string }[];
  alerts: {
    id: string;
    module_id: string;
    metric: string;
    value: number | null;
    level: "warn" | "critical";
    message: string;
    explanation: string | null;
    status: string;
    ack_at: string | null;
    ts: string;
  }[];
};

export function viewThresholds(view: ContactView, moduleId: string): Thresholds {
  return (view.modules.find((m) => m.module_id === moduleId)?.thresholds ?? {}) as Thresholds;
}
