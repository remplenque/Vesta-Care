import type { Level } from "./rules";

// Every state is icon + text + color, never color alone (docs/ACCESSIBILITY.md §4)
export type StatusKey = "ok" | "warn" | "crit" | "none";

export const STATUS: Record<
  StatusKey,
  { label: string; icon: string; badge: string; border: string; marker: string; text: string }
> = {
  ok: { label: "Normal", icon: "check_circle", badge: "bg-ok-soft text-ok", border: "border border-line", marker: "bg-ok", text: "text-ok" },
  warn: { label: "Revisar", icon: "error", badge: "bg-warn-soft text-warn", border: "border-2 border-warn-icon", marker: "bg-warn-icon", text: "text-warn" },
  crit: { label: "Urgente", icon: "emergency", badge: "bg-crit text-white", border: "border-2 border-crit", marker: "bg-crit", text: "text-crit" },
  none: { label: "Sin datos", icon: "cloud_off", badge: "bg-none-soft text-none", border: "border border-line", marker: "bg-none", text: "text-none" },
};

export function statusFromLevel(level: Level | null | undefined): StatusKey {
  if (!level) return "none";
  return level === "critical" ? "crit" : level;
}
