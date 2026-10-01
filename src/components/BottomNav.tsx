"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./ui";

const ITEMS = [
  { href: "/inicio", icon: "home", label: "Inicio" },
  { href: "/pastillero", icon: "medication", label: "Pastillero" },
  { href: "/mateo", icon: "forum", label: "Mateo" },
  { href: "/modulos", icon: "widgets", label: "Módulos" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegación principal" className="sticky bottom-0 z-30 grid min-h-[88px] grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
      {ITEMS.map((it) => {
        const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center justify-center gap-1 text-body ${active ? "font-extrabold text-primary" : "text-ink-muted"}`}
          >
            <Icon name={it.icon} fill={active} size="1.75rem" className={`rounded-full px-[18px] py-0.5 ${active ? "bg-primary-soft" : ""}`} />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
