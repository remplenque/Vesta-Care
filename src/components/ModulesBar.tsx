"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { pillboxCard, vitalCard, type CardModel } from "@/lib/cards";
import type { CareData } from "@/lib/data";
import { modulesForProfile } from "@/lib/ficha";
import { moduleUi, sortModules, VITAL_MODULES } from "@/lib/modules";
import { moduleHref, SETTINGS_PATH } from "@/lib/nav";
import { STATUS, type StatusKey } from "@/lib/status";
import { getSupabase } from "@/lib/supabase/client";
import { useCare } from "./CareProvider";
import { Button, Icon, StatusBadge } from "./ui";

// Top bar on every screen of the app: the person's modules at a glance. Collapsed it is one big
// button with each module's icon, its status mark and a one-line summary ("Todo en orden");
// tapped, it drops down the full list (each module with its status) and the settings button.
// It stays out of the way so the screen below is seen whole.
// A new account (the guided first steps save conditions and remedies, not modules) sees
// "Active sus módulos": the panel suggests the ones that fit and activates them on "Sí".

const RANK: Record<StatusKey, number> = { none: 0, ok: 1, warn: 2, crit: 3 };

function moduleCards(data: CareData, tz: string, now: Date): CardModel[] {
  const enabled = data.userModules.filter((u) => u.enabled).map((u) => u.module_id);
  // Only modules with a screen of their own; the proposed ones live in the settings catalog
  const ids = sortModules(
    enabled.filter((m) => VITAL_MODULES.includes(m) || m === "pillbox"),
    (m) => m,
  );
  return ids.map((m) => (m === "pillbox" ? pillboxCard(data, tz, now) : vitalCard(m, data, now)));
}

function summary(cards: CardModel[]): { status: StatusKey; text: string } {
  if (!cards.length) return { status: "none", text: "Aún no tiene módulos" };
  const crit = cards.filter((c) => c.status === "crit");
  const warn = cards.filter((c) => c.status === "warn");
  if (crit.length) return { status: "crit", text: `Urgente: ${crit.map((c) => c.name).join(", ")}` };
  if (warn.length) return { status: "warn", text: warn.length === 1 ? `Revisar: ${warn[0].name}` : `${warn.length} para revisar` };
  if (cards.every((c) => c.status === "none")) return { status: "none", text: "Sin datos todavía" };
  return { status: "ok", text: "Todo en orden" };
}

export function ModulesBar() {
  const pathname = usePathname();
  const { data, tz, userId, refresh } = useCare();
  // The panel remembers where it was opened, so it closes by itself on navigation
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const panelId = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const firstItem = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    firstItem.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpenOn(null);
      toggle.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const cards = data ? moduleCards(data, tz, new Date()) : [];
  const needsModules = !!data && !data.userModules.some((u) => u.enabled);
  const suggested = useSuggestedModules(needsModules);
  const sum = !data
    ? { status: "none" as const, text: "Un momento…" }
    : needsModules && suggested.length
      ? { status: "none" as const, text: "Active sus módulos" }
      : summary(cards);
  const invite = needsModules && suggested.length > 0;
  const s = invite ? { icon: "add_circle", text: "text-primary" } : STATUS[sum.status];
  const worst = cards.reduce<StatusKey>((acc, c) => (RANK[c.status] > RANK[acc] ? c.status : acc), "none");

  return (
    <header className="sticky top-0 z-30 bg-canvas">
      {open && <div aria-hidden className="fixed inset-0 z-10 bg-ink/40" onClick={() => setOpenOn(null)} />}

      <div className="relative z-20 flex h-[var(--top-h)] items-center border-b border-line bg-canvas px-3">
        <button
          ref={toggle}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpenOn(open ? null : pathname)}
          className={`flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-full border-2 bg-surface py-1.5 pr-3 pl-2 text-left ${
            worst === "crit" ? "border-crit" : worst === "warn" ? "border-warn-icon" : invite ? "border-primary" : "border-line-strong"
          } ${open ? "ring-4 ring-primary-soft" : ""}`}
        >
          <span className="flex shrink-0 -space-x-2 hide-on-largest-text" aria-hidden>
            {cards.slice(0, 4).map((c, i) => (
              <span key={c.moduleId} className={`relative h-10 w-10 items-center justify-center rounded-full border-2 border-surface bg-sunken ${i >= 2 ? "hidden min-[400px]:flex" : "flex"}`}>
                <Icon name={moduleUi(c.moduleId).icon} size="1.35rem" className="text-primary" />
                <span className={`absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-surface ${STATUS[c.status].marker}`} />
              </span>
            ))}
            {!cards.length && (
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sunken">
                <Icon name="widgets" size="1.35rem" className="text-primary" />
              </span>
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-body font-extrabold">Sus módulos</span>
            <span className={`flex min-w-0 items-center gap-1 text-small font-bold ${s.text}`}>
              <Icon name={s.icon} fill size="1.1rem" />
              <span className="truncate">{sum.text}</span>
            </span>
          </span>
          <Icon name={open ? "expand_less" : "expand_more"} size="1.9rem" className="shrink-0 text-ink-muted" />
        </button>
      </div>

      {open && (
        <div
          id={panelId}
          className="absolute inset-x-3 top-full z-20 mt-2 flex max-h-[calc(100dvh-var(--top-h)-var(--nav-h)-1rem)] flex-col gap-2 overflow-y-auto rounded-card border border-line bg-surface p-3 shadow-float"
        >
          {invite && (
            <SuggestModules ids={suggested} userId={userId} onDone={async () => {
                await refresh();
                setOpenOn(null);
              }} />
          )}
          {!cards.length && !invite && (
            <p className="px-3 pt-1 text-body">Todavía no tiene módulos activos. Puede agregarlos en Configuración.</p>
          )}
          <ul className="flex flex-col gap-1">
            {cards.map((c, i) => (
              <li key={c.moduleId}>
                <Link
                  ref={i === 0 ? firstItem : undefined}
                  href={moduleHref(c.moduleId)}
                  onClick={() => setOpenOn(null)}
                  className="flex min-h-16 items-center gap-4 rounded-btn px-3 py-2 active:bg-sunken"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sunken">
                    <Icon name={moduleUi(c.moduleId).icon} size="1.75rem" className="text-primary" />
                  </span>
                  <span className="flex flex-1 flex-col items-start gap-1">
                    <span className="text-body-lg font-bold">{moduleUi(c.moduleId).name}</span>
                    <StatusBadge status={c.status} size="sm" />
                  </span>
                  <Icon name="chevron_right" size="1.75rem" className="text-ink-muted" />
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={SETTINGS_PATH}
            onClick={() => setOpenOn(null)}
            className="mt-1 flex min-h-14 items-center justify-center gap-2 rounded-btn border-2 border-primary text-body-lg font-bold text-primary active:bg-primary-soft"
          >
            <Icon name="settings" size="1.6rem" />
            Configuración
          </Link>
        </div>
      )}
    </header>
  );
}

/** Modules that fit the conditions and remedies the person already entered (only while they have none) */
function useSuggestedModules(active: boolean): string[] {
  const { data, userId } = useCare();
  const [conditions, setConditions] = useState<string[] | null>(null);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    getSupabase()
      .from("conditions")
      .select("name")
      .eq("user_id", userId)
      .then(({ data: rows }) => !cancelled && setConditions((rows ?? []).map((r) => r.name)));
    return () => {
      cancelled = true;
    };
  }, [active, userId, data?.medications.length]);
  if (!active || !data || conditions === null) return [];
  return modulesForProfile(conditions, data.medications.length > 0, data.modules);
}

function SuggestModules({ ids, userId, onDone }: { ids: string[]; userId: string; onDone: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  // Default thresholds of each module until a ficha sets the person's own (rules engine falls back
  // to modules.manifest.defaultThresholds when user_modules.thresholds is null)
  async function activate() {
    setSaving(true);
    setFailed(false);
    const { error } = await getSupabase()
      .from("user_modules")
      .upsert(ids.map((id) => ({ user_id: userId, module_id: id, enabled: true, thresholds: null, thresholds_source: "default", confirmed: true })));
    setSaving(false);
    if (error) return setFailed(true);
    await onDone();
  }

  return (
    <section className="flex flex-col gap-3 px-1 pt-1">
      <p className="px-2 text-body-lg font-bold">Según lo que me contó, le sugiero activar:</p>
      <ul className="flex flex-col gap-1">
        {ids.map((id) => (
          <li key={id} className="flex min-h-14 items-center gap-4 rounded-btn bg-canvas px-3">
            <Icon name={moduleUi(id).icon} size="1.75rem" className="text-primary" />
            <span className="text-body-lg font-bold">{moduleUi(id).name}</span>
          </li>
        ))}
      </ul>
      {failed && (
        <p role="alert" className="rounded-btn bg-warn-soft p-3 text-body text-warn">
          No pude activarlos. ¿Lo intentamos de nuevo?
        </p>
      )}
      <Button icon="check" onClick={activate} disabled={saving}>
        {saving ? "Un momento…" : "Sí, activarlos"}
      </Button>
    </section>
  );
}
