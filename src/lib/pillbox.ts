import type { Medication, Reading } from "./data";
import { localDateKey, zonedTime, DEFAULT_TZ } from "./time";

// A dose not registered 30 min after its time counts as missed (acta §3)
export const MISSED_AFTER_MIN = 30;
// A dose can be marked as taken from 90 min before its time
const DUE_BEFORE_MIN = 90;

export type DoseStatus = "taken" | "missed" | "due" | "later";

export type DoseSlot = {
  key: string;
  time: string; // "08:00"
  at: Date;
  medication: Medication;
  status: DoseStatus;
  takenAt?: string;
  takenReadingId?: string;
  late?: boolean;
};

export function scheduleTimes(m: Medication): string[] {
  const s = m.schedule as { times?: string[] } | null;
  return Array.isArray(s?.times) ? [...s.times].sort() : [];
}

type DoseMeta = { medication_id?: string; scheduled_for?: string };

/** Today's doses for every medication, matched against pillbox readings */
export function todaySlots(meds: Medication[], readings: Reading[], tz = DEFAULT_TZ, now = new Date()): DoseSlot[] {
  const today = localDateKey(now, tz);
  const taken = readings.filter((r) => r.module_id === "pillbox" && r.metric === "dose_taken");

  const slots: DoseSlot[] = [];
  for (const med of meds) {
    for (const time of scheduleTimes(med)) {
      const at = zonedTime(today, time, tz);
      const match = taken.find((r) => {
        const meta = (r.metadata ?? {}) as DoseMeta;
        if (meta.medication_id !== med.id || !meta.scheduled_for) return false;
        return Math.abs(new Date(meta.scheduled_for).getTime() - at.getTime()) < 60_000;
      });
      const minsFromSlot = (now.getTime() - at.getTime()) / 60_000;
      let status: DoseStatus;
      if (match) status = "taken";
      else if (minsFromSlot > MISSED_AFTER_MIN) status = "missed";
      else if (minsFromSlot >= -DUE_BEFORE_MIN) status = "due";
      else status = "later";
      slots.push({
        key: `${med.id}-${time}`,
        time,
        at,
        medication: med,
        status,
        takenAt: match?.ts,
        takenReadingId: match?.id,
        late: match ? (new Date(match.ts).getTime() - at.getTime()) / 60_000 > MISSED_AFTER_MIN : undefined,
      });
    }
  }
  return slots.sort((a, b) => a.at.getTime() - b.at.getTime() || a.medication.name.localeCompare(b.medication.name));
}

export function nextDose(slots: DoseSlot[]) {
  return slots.find((s) => s.status === "due" || s.status === "later");
}

export function medLabel(m: Pick<Medication, "name" | "dose">) {
  return [m.name, m.dose].filter(Boolean).join(" ");
}
