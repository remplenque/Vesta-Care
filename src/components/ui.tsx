"use client";

import Link from "next/link";
import { useRef, type ComponentProps, type MouseEvent, type ReactNode } from "react";
import { STATUS, type StatusKey } from "@/lib/status";

// ---------------------------------------------------------------- Icon

export function Icon({ name, fill, className = "", size }: { name: string; fill?: boolean; className?: string; size?: string }) {
  return (
    <span aria-hidden className={`icon ${fill ? "icon-fill" : ""} ${className}`} style={size ? { fontSize: size } : undefined}>
      {name}
    </span>
  );
}

// ---------------------------------------------------------------- Button

type Variant = "primary" | "secondary" | "danger" | "text" | "inverse" | "outline-inverse" | "muted";

const VARIANTS: Record<Variant, string> = {
  primary: "min-h-16 rounded-btn bg-primary text-white hover:bg-primary-hover active:bg-primary-hover",
  secondary: "min-h-14 rounded-btn border-2 border-primary text-primary bg-transparent hover:bg-primary-soft active:bg-primary-soft",
  danger: "min-h-16 rounded-btn bg-crit text-white hover:bg-crit-deep active:bg-crit-deep",
  text: "min-h-14 text-primary underline underline-offset-4",
  inverse: "min-h-[68px] rounded-btn bg-white text-crit-deep",
  "outline-inverse": "min-h-[60px] rounded-btn border-2 border-white text-white bg-transparent active:bg-white/10",
  muted: "min-h-14 rounded-btn border-2 border-line-strong text-ink-muted bg-transparent active:bg-sunken",
};

type ButtonProps = {
  variant?: Variant;
  icon?: string;
  iconFill?: boolean;
  full?: boolean;
  href?: string;
  className?: string;
  children: ReactNode;
} & Omit<ComponentProps<"button">, "className" | "children">;

/** Big, labelled, double-tap tolerant button (docs/ACCESSIBILITY.md §6) */
export function Button({ variant = "primary", icon, iconFill, full = true, href, className = "", children, onClick, disabled, ...rest }: ButtonProps) {
  const last = useRef(0);
  const cls = `${VARIANTS[variant]} ${full ? "w-full" : ""} inline-flex items-center justify-center gap-3 px-5 text-body-lg font-bold transition-colors disabled:opacity-45 disabled:cursor-default cursor-pointer ${className}`;
  const content = (
    <>
      {icon && <Icon name={icon} fill={iconFill} size="1.75rem" />}
      {children}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {content}
      </Link>
    );
  }
  const guarded = (e: MouseEvent<HTMLButtonElement>) => {
    const now = Date.now();
    if (now - last.current < 500) return;
    last.current = now;
    onClick?.(e);
  };
  return (
    <button type="button" className={cls} onClick={guarded} disabled={disabled} {...rest}>
      {content}
    </button>
  );
}

// ---------------------------------------------------------------- Status badge

export function StatusBadge({ status, label, size = "md" }: { status: StatusKey; label?: string; size?: "md" | "sm" }) {
  const s = STATUS[status];
  if (size === "sm") {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full py-0.5 pr-3 pl-2 text-small font-bold ${s.badge}`}>
        <Icon name={s.icon} fill size="1.1rem" />
        {label ?? s.label}
      </span>
    );
  }
  return (
    <span className={`inline-flex min-h-10 items-center gap-2 self-start rounded-full pr-4 pl-3 text-body font-bold ${s.badge}`}>
      <Icon name={s.icon} fill size="1.4rem" />
      {label ?? s.label}
    </span>
  );
}

// ---------------------------------------------------------------- Mateo avatar

export function MateoAvatar({ size = 40 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-primary font-extrabold text-white"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      M
    </span>
  );
}

// ---------------------------------------------------------------- Back button (always visible: §6, §10)

export function BackButton({ href, label = "Volver", onClick }: { href?: string; label?: string; onClick?: () => void }) {
  const cls = "inline-flex min-h-14 items-center gap-1.5 px-3 text-body font-bold text-primary cursor-pointer";
  const content = (
    <>
      <Icon name="arrow_back" size="1.75rem" />
      {label}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick}>
      {content}
    </button>
  );
}

// ---------------------------------------------------------------- Brand

/** The "house that talks" (design/, "Dirección recomendada"): Vesta Care's symbol and favicon */
export function BrandSymbol({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="70 80 372 376" aria-hidden className={className}>
      <path
        d="M256 92 L424 218 Q432 224 432 236 L432 368 Q432 396 404 396 L220 396 L150 446 L164 396 L108 396 Q80 396 80 368 L80 236 Q80 224 88 218 Z"
        fill="#C27A2C"
        stroke="#1E1E1E"
        strokeWidth="12"
        strokeLinejoin="round"
      />
      <ellipse cx="216" cy="290" rx="13" ry="22" fill="#1E1E1E" />
      <ellipse cx="296" cy="290" rx="13" ry="22" fill="#1E1E1E" />
      <circle cx="182" cy="334" r="19" fill="#F28B82" opacity=".7" />
      <circle cx="330" cy="334" r="19" fill="#F28B82" opacity=".7" />
      <path d="M208 328 Q256 384 304 328 Q256 348 208 328 Z" fill="#5A2323" stroke="#1E1E1E" strokeWidth="7" strokeLinejoin="round" />
    </svg>
  );
}

/** Logo: symbol + "Vesta Care" in ExtraBold, "Care" in Arcilla (brand design) */
export function Brand({ size = "md" }: { size?: "md" | "sm" }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <BrandSymbol className={size === "md" ? "h-10 w-10" : "h-8 w-8"} />
      <span className={`font-extrabold tracking-tight ${size === "md" ? "text-lead" : "text-body-lg"}`}>
        Vesta <span className="text-brand">Care</span>
      </span>
    </span>
  );
}

// ---------------------------------------------------------------- Progress bar

export function ProgressBar({ pct, tone = "primary", thin }: { pct: number; tone?: "primary" | "ok"; thin?: boolean }) {
  return (
    <div className={`${thin ? "h-2.5" : "h-3"} overflow-hidden rounded-full bg-track`} role="presentation">
      <div className={`h-full rounded-full ${tone === "ok" ? "bg-ok" : "bg-primary"}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------- Toast (stays until closed: §6 "sin temporizadores")

export function Toast({ icon = "check_circle", children, action, onClose }: { icon?: string; children: ReactNode; action?: { label: string; onClick: () => void }; onClose: () => void }) {
  return (
    <div role="status" className="fixed inset-x-4 bottom-28 z-40 mx-auto flex max-w-[448px] items-center gap-3 rounded-btn bg-ink py-3 pr-3 pl-5 text-canvas shadow-toast">
      <Icon name={icon} size="1.6rem" className="text-[#9FD3A8]" />
      <span className="flex-1 text-body leading-snug">{children}</span>
      {action && (
        <button type="button" onClick={action.onClick} className="min-h-14 cursor-pointer rounded-[14px] bg-canvas px-4 text-body font-extrabold text-ink">
          {action.label}
        </button>
      )}
      <button type="button" onClick={onClose} aria-label="Cerrar aviso" className="flex min-h-14 min-w-14 cursor-pointer items-center justify-center rounded-[14px] text-canvas">
        <Icon name="close" size="1.6rem" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- Bottom sheet

export function Sheet({ children, onClose, dark }: { children: ReactNode; onClose: () => void; dark?: boolean }) {
  return (
    <div className={`fixed inset-0 z-50 flex items-end justify-center ${dark ? "bg-[#4A0F0A]/85" : "bg-ink/50"}`} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="flex w-full max-w-[480px] flex-col gap-4 rounded-t-sheet bg-surface px-6 pt-4 pb-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-[5px] w-12 self-center rounded-full bg-track-off" />
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Card

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card border border-line bg-surface ${className}`}>{children}</div>;
}

// ---------------------------------------------------------------- Simulated tag (AGENTS.md §3.7)

export function SimulatedNote({ children = "Dispositivos simulados", className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-small text-ink-subtle ${className}`}>
      <Icon name="science" size="1.2rem" />
      {children}
    </span>
  );
}
