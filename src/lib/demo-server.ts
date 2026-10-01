import "server-only";
import type { Alert } from "./data";
import { PERSONAS, type Persona, type PersonaKey } from "./personas";
import { describeSpec, generateTick, VITAL_GENERATORS, type ReadingSpec } from "./simulator";
import type { AdminSupabase } from "./supabase/admin";
import { DEFAULT_TZ, localDateKey, zonedTime } from "./time";

// Demo operator logic behind /api/demo/{state,simulate,reset}. Runs with the service role
// (lib/supabase/admin.ts) and only ever touches the three persona accounts in lib/personas.ts.

// ---------------------------------------------------------------- Accounts

const idCache = new Map<PersonaKey, string>();

export function personaEmail(p: Persona) {
  return p.key === "luis" ? (process.env.DEMO_USER_EMAIL ?? null) : (p.email ?? null);
}

/** User id per persona (null while the account doesn't exist). One listUsers call covers all */
export async function resolvePersonaIds(admin: AdminSupabase): Promise<Record<PersonaKey, string | null>> {
  if (!idCache.has("luis") && process.env.NEXT_PUBLIC_DEMO_USER_ID) idCache.set("luis", process.env.NEXT_PUBLIC_DEMO_USER_ID);

  if (PERSONAS.some((p) => !idCache.has(p.key))) {
    // Demo project: a handful of users, one page is enough
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw error;
    for (const p of PERSONAS) {
      const email = personaEmail(p)?.toLowerCase();
      const user = email ? data.users.find((u) => u.email?.toLowerCase() === email) : undefined;
      if (user && !idCache.has(p.key)) idCache.set(p.key, user.id);
    }
  }

  return Object.fromEntries(PERSONAS.map((p) => [p.key, idCache.get(p.key) ?? null])) as Record<PersonaKey, string | null>;
}

async function ensurePersonaUser(admin: AdminSupabase, p: Persona): Promise<string> {
  const existing = (await resolvePersonaIds(admin))[p.key];
  if (existing) return existing;

  const email = personaEmail(p);
  const password = process.env.DEMO_USER_PASSWORD;
  if (!email || !password) throw new Error(`No se puede crear a ${p.fullName}: falta email o DEMO_USER_PASSWORD`);

  // Confirmed on creation: no email is sent to these fictional addresses
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: p.fullName },
  });
  if (error) throw error;
  idCache.set(p.key, data.user.id);
  return data.user.id;
}

// ---------------------------------------------------------------- Reset

export type ResetMode = "full" | "onboarding";

/** Creates the persona if needed and puts it back in its known starting state */
export async function resetPersona(admin: AdminSupabase, p: Persona, requested?: ResetMode) {
  const userId = await ensurePersonaUser(admin, p);
  const mode: ResetMode = p.profile === "new" ? "onboarding" : (requested ?? "full");

  const prof = await admin.from("profiles").update({ full_name: p.fullName, birth_date: p.birthDate }).eq("id", userId);
  if (prof.error) throw prof.error;

  const reset = await admin.rpc("reset_demo", { p_mode: mode, p_user_id: userId });
  if (reset.error) throw reset.error;

  // A new account starts without contacts too: onboarding step 01d adds them
  if (p.profile === "new") {
    const del = await admin.from("emergency_contacts").delete().eq("user_id", userId);
    if (del.error) throw del.error;
  }

  if (p.contact) {
    const { count } = await admin.from("emergency_contacts").select("id", { count: "exact", head: true }).eq("user_id", userId);
    if (!count) {
      const ins = await admin.from("emergency_contacts").insert({ user_id: userId, ...p.contact });
      if (ins.error) throw ins.error;
    }
  }

  if (p.profile === "unstable" && mode === "full") await seedHeartModule(admin, userId);
  return { persona: p.key, mode, user_id: userId };
}

/** Rosa on top of reset_demo('full'): arrhythmia, heart-rate module, two more medications and a
 *  week of history for them, so the alert-heavy persona has every vital to go out of range on */
async function seedHeartModule(admin: AdminSupabase, userId: string) {
  const tz = DEFAULT_TZ;
  const now = Date.now();
  const rand = (lo: number, hi: number) => Math.round(lo + Math.random() * (hi - lo));
  const day = (d: number) => localDateKey(new Date(now - d * 86_400_000), tz);

  const steps = await Promise.all([
    admin.from("conditions").insert({ user_id: userId, name: "Arritmia", source: "ficha" }),
    admin.from("user_modules").upsert({
      user_id: userId,
      module_id: "heart_rate",
      enabled: true,
      thresholds: { bpm: { normal: [55, 100], margin: 10 } },
      thresholds_source: "ficha",
      confirmed: true,
    }),
    admin.from("goals").insert({ user_id: userId, module_id: "heart_rate", description: "Pulso en reposo entre 60 y 90 lpm", target: { bpm: { min: 60, max: 90 } } }),
    admin
      .from("medications")
      .insert([
        { user_id: userId, name: "Bisoprolol", dose: "2,5 mg", schedule: { times: ["09:00"] } },
        { user_id: userId, name: "Ácido acetilsalicílico", dose: "100 mg", schedule: { times: ["14:00"] } },
      ])
      .select("id, schedule"),
  ]);
  const failed = steps.find((s) => s.error);
  if (failed?.error) throw failed.error;
  const meds = steps[3].data ?? [];

  const readings: { user_id: string; module_id: string; metric: string; value: number; unit: string; source: string; ts: string; metadata: Record<string, string | number> }[] = [];

  // Pulse every 3 h (08:00–20:00) for the last 7 days, all in range. Every row carries every
  // column: a bulk insert sends null (not the default) for keys missing in some rows
  for (let d = 0; d <= 6; d++) {
    for (const hhmm of ["08:00", "11:00", "14:00", "17:00", "20:00"]) {
      const ts = zonedTime(day(d), hhmm, tz).getTime();
      if (ts <= now) readings.push({ user_id: userId, module_id: "heart_rate", metric: "bpm", value: rand(66, 92), unit: "lpm", source: "simulator", ts: new Date(ts).toISOString(), metadata: {} });
    }
  }

  // Doses of the new medications on previous days; today's are left to the live simulator
  for (const med of meds) {
    const times = ((med.schedule as { times?: string[] } | null)?.times ?? []) as string[];
    for (let d = 1; d <= 6; d++) {
      for (const hhmm of times) {
        const at = zonedTime(day(d), hhmm, tz).getTime();
        const delay = rand(4, 20);
        const meta = { medication_id: med.id, scheduled_for: new Date(at).toISOString() };
        readings.push(
          { user_id: userId, module_id: "pillbox", metric: "dose_scheduled", value: 1, unit: "dosis", source: "simulator", ts: meta.scheduled_for, metadata: meta },
          { user_id: userId, module_id: "pillbox", metric: "dose_taken", value: 1, unit: "dosis", source: "simulator", ts: new Date(at + delay * 60_000).toISOString(), metadata: { ...meta, delay_min: delay } },
        );
      }
    }
  }

  const ins = await admin.from("readings").insert(readings);
  if (ins.error) throw ins.error;
}

// ---------------------------------------------------------------- Simulator tick

export type TickResult = {
  persona: PersonaKey;
  status: "ok" | "missing" | "waiting_onboarding" | "error";
  readings: { text: string; episode?: string }[];
  error?: string;
};

export async function simulateTick(admin: AdminSupabase, keys: PersonaKey[]): Promise<TickResult[]> {
  const ids = await resolvePersonaIds(admin);
  const now = new Date();

  return Promise.all(
    PERSONAS.filter((p) => keys.includes(p.key)).map(async (p): Promise<TickResult> => {
      const userId = ids[p.key];
      if (!userId) return { persona: p.key, status: "missing", readings: [] };

      try {
        const [mods, meds, profile, pillbox] = await Promise.all([
          admin.from("user_modules").select("module_id").eq("user_id", userId).eq("enabled", true).eq("confirmed", true),
          admin.from("medications").select("*").eq("user_id", userId),
          admin.from("profiles").select("timezone").eq("id", userId).maybeSingle(),
          admin
            .from("readings")
            .select("metric, metadata")
            .eq("user_id", userId)
            .eq("module_id", "pillbox")
            .gte("ts", new Date(now.getTime() - 4 * 3_600_000).toISOString()),
        ]);
        const modules = (mods.data ?? []).map((m) => m.module_id);
        if (!modules.length) return { persona: p.key, status: "waiting_onboarding", readings: [] };

        const lastTs: Record<string, number | undefined> = {};
        await Promise.all(
          modules
            .filter((m) => VITAL_GENERATORS[m])
            .map(async (m) => {
              const { data } = await admin.from("readings").select("ts").eq("user_id", userId).eq("module_id", m).order("ts", { ascending: false }).limit(1).maybeSingle();
              lastTs[m] = data ? Date.parse(data.ts) : undefined;
            }),
        );

        const specs = generateTick({
          profile: p.profile,
          modules,
          lastTs,
          medications: meds.data ?? [],
          pillbox: pillbox.data ?? [],
          tz: profile.data?.timezone ?? DEFAULT_TZ,
          now,
        });

        for (const s of specs) {
          const { error } = await ingest(admin, userId, s);
          if (error) throw error;
        }
        return { persona: p.key, status: "ok", readings: specs.map((s) => ({ text: describeSpec(s), episode: s.episode })) };
      } catch (e) {
        return { persona: p.key, status: "error", readings: [], error: errorMessage(e) };
      }
    }),
  );
}

// Same entry points as the devices (AGENTS.md §2): the rules engine runs on insert
function ingest(admin: AdminSupabase, userId: string, s: ReadingSpec) {
  if (s.kind === "bp") {
    return admin.rpc("ingest_bp", { p_user_id: userId, p_systolic: s.systolic, p_diastolic: s.diastolic, p_source: "simulator" });
  }
  return admin.rpc("ingest_reading", {
    p_user_id: userId,
    p_module_id: s.moduleId,
    p_metric: s.metric,
    p_value: s.value,
    p_unit: s.unit,
    p_source: "simulator",
    p_metadata: s.metadata,
    p_ts: s.ts,
  });
}

// ---------------------------------------------------------------- Panel state

export type PersonaState = {
  key: PersonaKey;
  userId: string | null;
  email: string | null;
  modules: string[];
  latest: { moduleId: string; text: string; ts: string }[];
  alerts: Pick<Alert, "id" | "level" | "message" | "status" | "ack_at" | "ts">[];
  contacts: { name: string; relation: string | null; token: string }[];
  lastReadingAt: string | null;
};

export async function loadPersonaStates(admin: AdminSupabase): Promise<PersonaState[]> {
  const ids = await resolvePersonaIds(admin);
  const since = new Date(Date.now() - 8 * 86_400_000).toISOString();

  return Promise.all(
    PERSONAS.map(async (p): Promise<PersonaState> => {
      const userId = ids[p.key];
      const base: PersonaState = { key: p.key, userId, email: personaEmail(p), modules: [], latest: [], alerts: [], contacts: [], lastReadingAt: null };
      if (!userId) return base;

      const [mods, readings, alerts, contacts] = await Promise.all([
        admin.from("user_modules").select("module_id").eq("user_id", userId).eq("enabled", true).eq("confirmed", true),
        admin
          .from("readings")
          .select("module_id, metric, value, ts, reading_group")
          .eq("user_id", userId)
          .neq("module_id", "pillbox")
          .gte("ts", since)
          .order("ts", { ascending: false })
          .limit(60),
        admin.from("alerts").select("id, level, message, status, ack_at, ts").eq("user_id", userId).order("ts", { ascending: false }).limit(8),
        admin.from("emergency_contacts").select("name, relation, access_token").eq("user_id", userId).order("created_at"),
      ]);

      const rows = readings.data ?? [];
      const latest: PersonaState["latest"] = [];
      for (const r of rows) {
        if (latest.some((l) => l.moduleId === r.module_id)) continue;
        if (r.module_id === "bp") {
          const pair = rows.filter((x) => x.reading_group && x.reading_group === r.reading_group);
          const sys = pair.find((x) => x.metric === "systolic")?.value;
          const dia = pair.find((x) => x.metric === "diastolic")?.value;
          if (sys == null || dia == null) continue;
          latest.push({ moduleId: "bp", text: `${sys}/${dia}`, ts: r.ts });
        } else {
          latest.push({ moduleId: r.module_id, text: String(r.value), ts: r.ts });
        }
      }

      return {
        ...base,
        modules: (mods.data ?? []).map((m) => m.module_id),
        latest,
        alerts: (alerts.data ?? []) as PersonaState["alerts"],
        contacts: (contacts.data ?? []).map((c) => ({ name: c.name, relation: c.relation, token: c.access_token })),
        lastReadingAt: rows[0]?.ts ?? null,
      };
    }),
  );
}

/** Supabase errors are plain objects ({ message, code }), not Error instances */
export function errorMessage(e: unknown) {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}
