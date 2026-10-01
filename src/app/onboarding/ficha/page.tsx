"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useCare } from "@/components/CareProvider";
import { StepHeader } from "@/components/StepHeader";
import { Button, Icon, MateoAvatar, ProgressBar } from "@/components/ui";
import { getSupabase } from "@/lib/supabase/client";

type Phase = "idle" | "uploading" | "reading" | "done" | "error";

function sizeLabel(bytes: number) {
  return bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

// 01b · Subir ficha médica
export default function UploadRecord() {
  const router = useRouter();
  const { userId } = useCare();
  const supabase = getSupabase();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pct, setPct] = useState(0);
  const [recordId, setRecordId] = useState<string | null>(null);

  // Progress creeps forward while Mateo reads; jumps to 100 when done
  useEffect(() => {
    if (phase !== "uploading" && phase !== "reading") return;
    const t = setInterval(() => setPct((p) => Math.min(p + 4, 92)), 200);
    return () => clearInterval(t);
  }, [phase]);

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setFile(f);
    setPct(8);
    setPhase("uploading");

    const safe = f.name.normalize("NFD").replace(/[^\w.-]+/g, "-");
    const path = `${userId}/${Date.now()}-${safe}`;
    const up = await supabase.storage.from("medical-records").upload(path, f, { contentType: f.type || "application/pdf" });
    if (up.error) return setPhase("error");

    const rec = await supabase.from("medical_records").insert({ user_id: userId, file_path: path }).select("id").single();
    if (rec.error) return setPhase("error");

    setPhase("reading");
    const res = await fetch("/api/ficha/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_path: path }),
    });
    if (!res.ok) return setPhase("error");
    const { extracted } = await res.json();
    const upd = await supabase.from("medical_records").update({ extracted }).eq("id", rec.data.id);
    if (upd.error) return setPhase("error");

    setRecordId(rec.data.id);
    setPct(100);
    setPhase("done");
  }

  const working = phase === "uploading" || phase === "reading";

  return (
    <>
      <StepHeader step={1} back="/bienvenida" />
      <div className="flex flex-col gap-3 px-6 pt-7">
        <h1 className="text-h1 font-extrabold">Suba su ficha médica</h1>
        <p className="text-body-lg text-ink-muted text-pretty">
          Mateo la leerá para conocer sus condiciones y sus remedios. Usted revisa todo antes de guardar.
        </p>
      </div>

      <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={onPick} aria-label="Elegir archivo PDF" />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={working}
        className="mx-6 mt-7 flex cursor-pointer flex-col items-center gap-3 rounded-card border-2 border-dashed border-line-strong bg-surface px-5 py-7 active:bg-sunken disabled:cursor-default"
      >
        <Icon name="upload_file" size="3rem" className="text-primary" />
        <span className="text-body-lg font-bold">{file ? "Elegir otro archivo" : "Elegir archivo PDF"}</span>
        <span className="text-body text-ink-subtle">Desde su teléfono o correo</span>
      </button>

      {file && (
        <div className="mx-6 mt-4 flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-crit-soft">
              <Icon name="picture_as_pdf" size="1.75rem" className="text-crit-deep" />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-body font-bold">{file.name}</span>
              <span className="text-body text-ink-subtle">{sizeLabel(file.size)}</span>
            </div>
          </div>
          <div className="flex items-center gap-3" aria-live="polite">
            {phase === "error" ? (
              <>
                <Icon name="error" fill size="1.75rem" className="text-warn" />
                <span className="text-body">No pude leer la ficha. ¿Lo intentamos de nuevo?</span>
              </>
            ) : (
              <>
                <MateoAvatar />
                <span className="text-body leading-snug">
                  {phase === "uploading" && "Subiendo su ficha…"}
                  {phase === "reading" && "Mateo está leyendo su ficha…"}
                  {phase === "done" && "Listo. Revisemos lo que entendí."}
                </span>
              </>
            )}
          </div>
          {phase !== "error" && <ProgressBar pct={pct} thin />}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-3 p-6">
        <Button disabled={phase !== "done"} onClick={() => router.push(`/onboarding/confirmar?record=${recordId}`)}>
          Continuar
        </Button>
        <Button variant="text" href="/onboarding/confirmar?manual=1">
          Prefiero ingresarlo a mano
        </Button>
      </div>
    </>
  );
}
