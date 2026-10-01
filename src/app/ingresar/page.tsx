"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { BackButton, Brand, Button } from "@/components/ui";
import { getSupabase } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setError("No pudimos entrar con esos datos. Revise su correo y su clave, y probemos de nuevo.");
      return;
    }
    router.replace(params.get("next") || "/");
    router.refresh();
  }

  const input = "min-h-16 w-full rounded-btn border-2 border-line-strong bg-surface px-4 text-body-lg focus:border-primary";

  return (
    <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-5 px-6 pt-6">
      <h1 className="text-h1 font-extrabold">Entrar a su cuenta</h1>
      <label className="flex flex-col gap-2">
        <span className="text-body-lg font-bold">Correo</span>
        <input className={input} type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-body-lg font-bold">Clave</span>
        <input className={input} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && (
        <p role="alert" className="rounded-btn bg-warn-soft p-4 text-body text-warn">
          {error}
        </p>
      )}
      <div className="mt-auto pb-6">
        <Button type="submit" disabled={busy}>
          {busy ? "Un momento…" : "Entrar"}
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
