"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { loadCareData, type Alert, type CareData, type Reading } from "@/lib/data";
import { getSupabase } from "@/lib/supabase/client";
import { DEFAULT_TZ } from "@/lib/time";

type CareContext = {
  userId: string;
  data: CareData | null;
  tz: string;
  refresh: () => Promise<void>;
};

const Ctx = createContext<CareContext | null>(null);

// Same cap as loadCareData: the newest readings only
const MAX_READINGS = 2000;

export function useCare() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCare must be used inside <CareProvider>");
  return ctx;
}

/**
 * Loads the signed-in user's data (RLS-scoped) and keeps it live with Realtime.
 * When the rules engine inserts a critical alert, the app jumps to the alert screen (acta §7.5).
 */
export function CareProvider({ children, followCriticalAlerts = true }: { children: ReactNode; followCriticalAlerts?: boolean }) {
  const router = useRouter();
  const supabase = getSupabase();
  const [userId, setUserId] = useState<string | null>(null);
  const [signInAt, setSignInAt] = useState<string>("");
  const [data, setData] = useState<CareData | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setData(await loadCareData(supabase, userId));
  }, [supabase, userId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace("/ingresar");
      else {
        setSignInAt(user.last_sign_in_at ?? "");
        setUserId(user.id);
      }
    });
  }, [supabase, router]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadCareData(supabase, userId).then((d) => !cancelled && setData(d));

    // Bursts of inserts (bp = 2 rows + alert + messages) collapse into one reload
    const scheduleRefresh = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        loadCareData(supabase, userId).then((d) => !cancelled && setData(d));
      }, 400);
    };

    // Hidden tabs (app in the background, screen off) freeze client navigation, so a critical
    // alert that arrives then is opened as soon as the app is visible again
    let pendingAlert: string | null = null;
    const openAlert = (id: string) => {
      if (document.visibilityState === "visible") router.push(`/alerta/${id}`);
      else pendingAlert = id;
    };

    const channel = supabase
      .channel(`care-${userId}`)
      // The simulator writes every 5 s: new readings are appended instead of reloading everything
      .on("postgres_changes", { event: "*", schema: "public", table: "readings", filter: `user_id=eq.${userId}` }, (payload) => {
        if (payload.eventType !== "INSERT") return scheduleRefresh();
        const r = payload.new as Reading;
        setData((d) =>
          d ? { ...d, readings: [...d.readings.filter((x) => x.id !== r.id), r].sort((a, b) => a.ts.localeCompare(b.ts)).slice(-MAX_READINGS) } : d,
        );
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_modules", filter: `user_id=eq.${userId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts", filter: `user_id=eq.${userId}` }, (payload) => {
        scheduleRefresh();
        const alert = payload.new as Alert | undefined;
        if (followCriticalAlerts && payload.eventType === "INSERT" && alert?.level === "critical") openAlert(alert.id);
      })
      .subscribe();

    const onFocus = () => scheduleRefresh();
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      scheduleRefresh();
      if (pendingAlert) {
        router.push(`/alerta/${pendingAlert}`);
        pendingAlert = null;
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearTimeout(timer.current);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, router, followCriticalAlerts]);

  // Demo personas (sim_personas in Supabase): opening the app can start Rosa's emergency. Once per
  // app session, so moving between screens or answering "Estoy bien" never starts another one
  useEffect(() => {
    if (!userId || !followCriticalAlerts) return;
    const key = `vesta:opened:${userId}:${signInAt}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // private mode: the check may run again; the server refuses to chain emergencies
    }
    supabase.rpc("sim_open_session").then(({ data: alertId }) => {
      if (alertId) router.push(`/alerta/${alertId}`);
    });
  }, [supabase, userId, signInAt, followCriticalAlerts, router]);

  if (!userId) return null;
  return <Ctx.Provider value={{ userId, data, tz: data?.profile?.timezone ?? DEFAULT_TZ, refresh }}>{children}</Ctx.Provider>;
}

/** Skeleton shown while the first load is in flight (§10: content, not a spinner) */
export function ScreenSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-6 pt-8" aria-busy="true" aria-label="Un momento…">
      <div className="h-6 w-40 rounded-full bg-sunken" />
      <div className="h-9 w-64 rounded-full bg-sunken" />
      <div className="mt-4 h-40 rounded-card bg-surface" />
      <div className="h-24 rounded-card bg-surface" />
      <div className="h-56 rounded-card bg-surface" />
    </div>
  );
}
