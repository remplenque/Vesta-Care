import type { Thresholds } from "./rules";

// Shape of medical_records.extracted (same as reset_demo writes). Nothing here is used until the
// user confirms it on screen 01c (AGENTS.md §3.8).
export type ExtractedMedication = { name: string; dose: string; times: string[] };
export type ExtractedRecord = {
  conditions: string[];
  medications: ExtractedMedication[];
  thresholds: Record<string, Thresholds>;
};

export function asExtracted(json: unknown): ExtractedRecord {
  const j = (json ?? {}) as Partial<ExtractedRecord>;
  return {
    conditions: Array.isArray(j.conditions) ? j.conditions : [],
    medications: Array.isArray(j.medications) ? j.medications : [],
    thresholds: j.thresholds && typeof j.thresholds === "object" ? j.thresholds : {},
  };
}

/** Modules Mateo proposes from what was extracted */
export function suggestedModules(r: ExtractedRecord): string[] {
  const ids = Object.keys(r.thresholds);
  if (r.medications.length && !ids.includes("pillbox")) ids.push("pillbox");
  return ids;
}

/** "Urgente sobre 160/100" style summary of when the family gets a message */
export function thresholdSummary(moduleId: string, t: Thresholds): string {
  const hi = (k: string) => (t[k] ? t[k].normal[1] + (t[k].margin ?? 0) : null);
  const lo = (k: string) => (t[k] ? t[k].normal[0] - (t[k].margin ?? 0) : null);
  if (moduleId === "bp" && t.systolic && t.diastolic) {
    return `Revisar sobre ${t.systolic.normal[1]}/${t.diastolic.normal[1]} · Urgente sobre ${hi("systolic")}/${hi("diastolic")}`;
  }
  if (moduleId === "glucose" && t.mg_dl) return `Urgente bajo ${lo("mg_dl")} o sobre ${hi("mg_dl")} mg/dL`;
  if (moduleId === "heart_rate" && t.bpm) return `Urgente bajo ${lo("bpm")} o sobre ${hi("bpm")} lpm`;
  return "Valores de su ficha";
}

export function formatTimes(times: string[]) {
  if (times.length <= 1) return times.join("");
  return `${times.slice(0, -1).join(", ")} y ${times.at(-1)}`;
}

export function parseTimes(text: string): string[] {
  return text
    .split(/[,\sy]+/)
    .map((t) => t.trim())
    .filter((t) => /^\d{1,2}:\d{2}$/.test(t))
    .map((t) => t.padStart(5, "0"))
    .sort();
}
