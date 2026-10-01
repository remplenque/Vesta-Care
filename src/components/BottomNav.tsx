"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { readCompanion, requestTalk, useTalkListening } from "@/hooks/useTalk";
import { CALENDAR_PATH, DASHBOARD_PATH, HOME_PATH } from "@/lib/nav";
import { MASCOT_HALO, MascotFace } from "./Mascot";
import { BAR_ICON, PanicButton } from "./PanicButton";
import { Icon } from "./ui";

// Bottom bar on every screen of the app, always in the same order:
//   [Ayuda]   [Resumen] [Calendario]   (Mateo / Emilia)
// - Left: the panic button, red and always visible (asks before raising the alarm).
// - Middle: the two places to look things up, as plain tabs: dashboard and calendar.
// - Right: the companion, a big round button that rises above the bar. On the companion screen
//   it opens and closes the mic; on any other screen it shows the companion's face and goes there.
// Modules and settings live in the top bar (ModulesBar). Typing to the companion stays on its
// own screen; it has nothing to do with this bar.

// Labels never drop below 17 px (docs/ACCESSIBILITY.md §8) but stop growing on narrow phones with
// "Muy grande", so the four buttons always fit side by side
const LABEL = "text-[clamp(17px,4.8vw,1.125rem)] leading-tight";

const TABS = [
  { href: DASHBOARD_PATH, icon: "monitoring", label: "Resumen" },
  { href: CALENDAR_PATH, icon: "calendar_month", label: "Calendario" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegación principal" className="sticky bottom-0 z-30 pb-[env(safe-area-inset-bottom)]">
      {/* The bar starts --nav-rise below the top: the companion button sticks out above it */}
      <div aria-hidden className="absolute inset-x-0 top-[var(--nav-rise)] bottom-0 border-t border-line bg-surface" />
      <div className="relative grid h-[var(--nav-h)] grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] gap-0.5 px-1.5">
        <div className={`flex items-center pt-[var(--nav-rise)] ${LABEL}`}>
          <PanicButton />
        </div>

        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <div key={t.href} className="flex items-center justify-center pt-[var(--nav-rise)]">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 w-full flex-col items-center justify-center gap-1 rounded-btn font-bold ${LABEL} ${active ? "text-primary" : "text-ink-muted"}`}
              >
                <Icon name={t.icon} fill={active} size={BAR_ICON} className={`rounded-full px-[14px] py-0.5 ${active ? "bg-primary-soft" : ""}`} />
                {t.label}
              </Link>
            </div>
          );
        })}

        <TalkButton onHome={pathname === HOME_PATH} />
      </div>
    </nav>
  );
}

function TalkButton({ onHome }: { onHome: boolean }) {
  const listening = useTalkListening();
  const lastTap = useRef(0);
  // Client-only (CareProvider renders nothing on the server); re-read on every navigation
  const persona = readCompanion();
  const circle =
    "relative flex aspect-square w-[clamp(80px,min(6rem,23vw),108px)] items-center justify-center overflow-hidden rounded-full border-4 shadow-float ring-[6px] ring-canvas";
  const wrap = `flex flex-col items-center gap-1 pt-1 font-extrabold ${LABEL}`;

  if (!onHome) {
    return (
      <Link href={HOME_PATH} aria-label={`Hablar con ${persona}`} className={`${wrap} text-primary`}>
        <span className={`${circle} border-primary ${MASCOT_HALO[persona]}`}>
          <MascotFace persona={persona} className="absolute inset-0 h-full w-full" />
        </span>
        {persona}
      </Link>
    );
  }

  // Double-tap tolerance (docs/ACCESSIBILITY.md §6): a second tap within 500 ms is ignored
  function tap() {
    const now = Date.now();
    if (now - lastTap.current < 500) return;
    lastTap.current = now;
    requestTalk();
  }

  return (
    <button type="button" onClick={tap} aria-pressed={listening} className={`${wrap} cursor-pointer ${listening ? "text-crit" : "text-primary"}`}>
      <span
        className={`${circle} text-white ${listening ? "border-crit-deep bg-crit motion-safe:animate-pulse" : "border-primary-hover bg-primary active:bg-primary-hover"}`}
      >
        <Icon name={listening ? "stop" : "mic"} fill size="3rem" />
      </span>
      {listening ? "Escuchando" : "Hablar"}
    </button>
  );
}
