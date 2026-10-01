import type { Contact } from "./data";
import type { getSupabase } from "./supabase/client";

// Telling the caregivers something (a pill taken, a doctor visit…): one outbound_messages row per
// contact, the same table the alerts use, so the simulated WhatsApp feed shows it; then
// /api/whatsapp/send delivers it for real to the numbers enabled on the server (WHATSAPP_REAL_TO).
// Never throws: a failed message must not break taking a pill or the chat.

type Client = ReturnType<typeof getSupabase>;

export async function notifyCaregivers(supabase: Client, userId: string, contacts: Contact[], body: string) {
  try {
    const to = contacts.filter((c) => c.phone);
    if (!to.length) return;
    const { data } = await supabase
      .from("outbound_messages")
      .insert(to.map((c) => ({ user_id: userId, contact_id: c.id, body })))
      .select("id");
    const messageIds = (data ?? []).map((m) => m.id);
    if (!messageIds.length) return;
    await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageIds }),
    });
  } catch (err) {
    console.error("[notify] could not tell the caregivers:", err);
  }
}

/** Asks the server to deliver the messages the rules engine wrote for a critical alert */
export function relayAlert(alertId: string) {
  fetch("/api/whatsapp/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alertId }),
  }).catch(() => {});
}

export function doseMessage(person: string, med: string, time: string, at = new Date()) {
  const hhmm = at.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" });
  return `💊 Vesta Care: ${person || "Su familiar"} registró que tomó ${med} de las ${time} (a las ${hhmm}).`;
}

export function visitMessage(person: string, note?: string | null) {
  return `🩺 Vesta Care: ${person || "Su familiar"} contó que hoy fue al médico${note ? ` (${note})` : ""}.`;
}
