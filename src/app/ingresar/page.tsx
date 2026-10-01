"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { BackButton, Brand, Button, SimulatedNote } from "@/components/ui";
import { toChileanMobile } from "@/lib/phone";
import { HOME_PATH } from "@/lib/nav";

// 01 · Login with a mobile number (demo: no SMS code, see /api/auth/phone). After entering,
// the person chooses their companion (/acompanante) and then continues where they were going.

const ERRORS: Record<string, string> = {
  invalid_phone: "Ese número no parece un celular. Escríbalo con 9 dígitos, por ejemplo 9 1234 5678.",
  not_allowed: "Ese número todavía no tiene una cuenta. Revise el número y probemos de nuevo.",
};
const GENERIC = "No pude hacerlo. ¿Lo intentamos de nuevo?";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const normalized = toChileanMobile(phone);
    if (!normalized) return setError(ERRORS.invalid_phone);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized }),
      });
      if (!res.ok) {
        const { error: code } = (await res.json().catch(() => ({}))) as { error?: string };
        setError(ERRORS[code ?? ""] ?? GENERIC);
        setBusy(false);
        return;
      }
    } catch {
      setError(GENERIC);
      setBusy(false);
      return;
    }
    goOn();
  }

  function goOn() {
    const next = params.get("next") || HOME_PATH;
    router.replace(`/acompanante?next=${encodeURIComponent(next)}`);
    router.refresh();
  }

  // TEMPORARY: one tap into Luis's demo account (/api/auth/demo). Remove with that route
  async function enterAsDemo() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/demo", { method: "POST" }).catch(() => null);
    if (!res?.ok) {
      setError(GENERIC);
      setBusy(false);
      return;
    }
    goOn();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-5 px-6 pt-6">
      <h1 className="text-h1 font-extrabold">Entrar a su cuenta</h1>
      <label className="flex flex-col gap-2">
        <span className="text-body-lg font-bold">Su número de celular</span>
        <span className="flex min-h-16 items-center rounded-btn border-2 border-line-strong bg-surface focus-within:border-primary">
          <span className="border-r-2 border-line px-4 text-body-lg font-bold text-ink-muted">+56</span>
          <input
            className="min-h-16 w-full min-w-0 flex-1 rounded-btn bg-transparent px-4 text-body-lg tracking-wide focus:outline-none"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="9 1234 5678"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </span>
      </label>
      {error && (
        <p role="alert" className="rounded-btn bg-warn-soft p-4 text-body text-warn">
          {error}
        </p>
      )}
      <SimulatedNote>Versión de demostración: entra sin código por SMS</SimulatedNote>
      <div className="mt-auto flex flex-col gap-3 pb-6">
        <Button type="submit" disabled={busy}>
          {busy ? "Un momento…" : "Entrar"}
        </Button>
        <Button type="button" variant="secondary" icon="science" onClick={enterAsDemo} disabled={busy}>
          Entrar como Luis (demo)
        </Button>
      </div>
    </form>
  );
}

export default function Login() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-canvas">
      <div className="flex items-center justify-between px-4 pt-2">
        <BackButton href="/bienvenida" />
        <span className="pr-3">
          <Brand size="sm" />
        </span>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
