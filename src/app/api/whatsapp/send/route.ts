import { toChileanMobile } from "@/lib/phone";
import { getServerSupabase } from "@/lib/supabase/server";

// Real WhatsApp for caregivers (Twilio). Every message is still written to outbound_messages first
// (the simulated feed in /demo/whatsapp keeps working); this route only DELIVERS rows that exist.
//   POST { messageIds?: string[], alertId?: string } → { sent, skipped, failed }
// Safety (AGENTS.md §3.7, changed by the team: real sending is opt-in):
//   - off unless WHATSAPP_REAL=1 and Twilio is configured → everything stays simulated
//   - only to numbers listed in WHATSAPP_REAL_TO; every other contact stays simulated
//   - the user's session reads the rows (RLS: only their own messages and contacts)
//   - each message is delivered once per server process (several open tabs don't duplicate it)

const delivered = new Set<string>();

function realTargets() {
  return new Set(
    (process.env.WHATSAPP_REAL_TO ?? "")
      .split(",")
      .map((p) => toChileanMobile(p))
      .filter(Boolean) as string[],
  );
}

/** Relative "/c/<token>" links in the body become absolute, so they open from the phone */
function absolutize(body: string) {
  const base = (process.env.PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return base ? body.replace(/(^|\s)(\/c\/[\w-]+)/g, `$1${base}$2`) : body;
}

/** Trial accounts only accept Twilio's own templates (ContentSid; error 21654 for free text). With
 *  TWILIO_CONTENT_SID set, the message goes into that template's variables instead of Body.
 *  TWILIO_CONTENT_MAP says what goes in each slot, e.g. "1=text,2=time" (text = our whole message
 *  without the emoji header, time = "14:58", date = "1 de octubre"). */
function templateParams(body: string): Record<string, string> | null {
  const contentSid = process.env.TWILIO_CONTENT_SID;
  if (!contentSid) return null;
  const now = new Date();
  const values: Record<string, string> = {
    text: body.replace(/^\S+\s+Vesta Care:\s*/, "").replace(/\s+/g, " ").trim().slice(0, 900),
    time: now.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" }),
    date: now.toLocaleDateString("es-CL", { day: "numeric", month: "long", timeZone: "America/Santiago" }),
  };
  const vars: Record<string, string> = {};
  for (const pair of (process.env.TWILIO_CONTENT_MAP || "1=text").split(",")) {
    const [slot, what] = pair.split("=").map((x) => x.trim());
    if (slot && what) vars[slot] = values[what] ?? what;
  }
  return { ContentSid: contentSid, ContentVariables: JSON.stringify(vars) };
}

async function twilioSend(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const content = templateParams(body);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      From: process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886",
      To: `whatsapp:${to}`,
      ...(content ?? { Body: body }),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`twilio ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

export async function POST(request: Request) {
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { messageIds = [], alertId } = (await request.json().catch(() => ({}))) as { messageIds?: string[]; alertId?: string };
  const enabled = process.env.WHATSAPP_REAL === "1" && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN;
  if (!enabled) return Response.json({ sent: 0, skipped: messageIds.length, failed: 0, simulated: true });

  let query = supabase.from("outbound_messages").select("id, body, contact_id").eq("user_id", auth.user.id);
  if (alertId) query = query.eq("alert_id", alertId);
  else if (messageIds.length) query = query.in("id", messageIds.slice(0, 20));
  else return Response.json({ sent: 0, skipped: 0, failed: 0 });
  const { data: rows } = await query;

  const contactIds = [...new Set((rows ?? []).map((r) => r.contact_id).filter(Boolean) as string[])];
  const { data: contacts } = contactIds.length
    ? await supabase.from("emergency_contacts").select("id, phone").in("id", contactIds)
    : { data: [] as { id: string; phone: string | null }[] };
  const phoneOf = new Map((contacts ?? []).map((c) => [c.id, toChileanMobile(c.phone ?? "")]));
  const allowed = realTargets();

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const row of rows ?? []) {
    const to = row.contact_id ? phoneOf.get(row.contact_id) : null;
    if (delivered.has(row.id) || !to || !allowed.has(to)) {
      skipped++;
      continue;
    }
    delivered.add(row.id);
    try {
      await twilioSend(to, absolutize(row.body));
      sent++;
    } catch (err) {
      delivered.delete(row.id); // let a later call retry it
      failed++;
      console.error("[whatsapp] send failed:", err instanceof Error ? err.message : err);
    }
  }
  return Response.json({ sent, skipped, failed });
}
