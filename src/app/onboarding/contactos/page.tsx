"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useCare, ScreenSkeleton } from "@/components/CareProvider";
import { StepHeader } from "@/components/StepHeader";
import { Button, Icon, Sheet } from "@/components/ui";
import type { Contact } from "@/lib/data";
import { getSupabase } from "@/lib/supabase/client";
import { initials } from "@/lib/time";

const field = "min-h-14 w-full rounded-[14px] border-2 border-line-strong bg-surface px-3 text-body-lg focus:border-primary";

type Draft = { id?: string; name: string; relation: string; phone: string };

// 01d · Contactos de emergencia
export default function Contacts() {
  const router = useRouter();
  const { userId } = useCare();
  const supabase = getSupabase();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [removing, setRemoving] = useState<Contact | null>(null);
  const [error, setError] = useState(false);

  async function load() {
    const { data } = await supabase.from("emergency_contacts").select("*").eq("user_id", userId).order("created_at");
    setContacts(data ?? []);
  }

  useEffect(() => {
    supabase
      .from("emergency_contacts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at")
      .then(({ data }) => {
        setContacts(data ?? []);
        if (!data?.length) setDraft({ name: "", relation: "", phone: "" });
      });
  }, [supabase, userId]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft?.name.trim()) return;
    setError(false);
    const values = { name: draft.name.trim(), relation: draft.relation.trim() || null, phone: draft.phone.trim() || null };
    const res = draft.id
      ? await supabase.from("emergency_contacts").update(values).eq("id", draft.id)
      : await supabase.from("emergency_contacts").insert({ ...values, user_id: userId });
    if (res.error) return setError(true);
    setDraft(null);
    load();
  }

  async function remove() {
    if (!removing) return;
    await supabase.from("emergency_contacts").delete().eq("id", removing.id);
    setRemoving(null);
    load();
  }

  if (!contacts) return <ScreenSkeleton />;

  return (
    <>
      <StepHeader step={3} back="/onboarding/confirmar" />
      <div className="flex flex-col gap-3 px-6 pt-7">
        <h1 className="text-h1 font-extrabold text-pretty">¿A quién avisamos si algo pasa?</h1>
        <p className="text-body-lg text-ink-muted text-pretty">Solo reciben un mensaje si hay una alerta urgente.</p>
      </div>

      <div className="flex flex-col gap-4 px-6 pt-6">
        {contacts.map((c) =>
          draft?.id === c.id ? null : (
            <div key={c.id} className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
              <div className="flex items-center gap-3.5">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sunken text-lead font-extrabold text-ink-muted">
                  {initials(c.name)}
                </span>
                <div className="flex flex-col">
                  <span className="text-body-lg font-bold">{c.name}</span>
                  <span className="text-body text-ink-muted">{[c.relation && c.relation[0].toUpperCase() + c.relation.slice(1), c.phone].filter(Boolean).join(" · ")}</span>
                </div>
              </div>
              <span className="flex items-center gap-2 text-body font-bold text-ok">
                <Icon name="check_circle" fill size="1.5rem" />
                Recibirá alertas por mensaje
              </span>
              <div className="grid grid-cols-2 gap-4">
                <Button variant="secondary" icon="edit" onClick={() => setDraft({ id: c.id, name: c.name, relation: c.relation ?? "", phone: c.phone ?? "" })}>
                  Editar
                </Button>
                <Button variant="muted" icon="delete" onClick={() => setRemoving(c)}>
                  Quitar
                </Button>
              </div>
            </div>
          ),
        )}

        {draft ? (
          <form onSubmit={save} className="flex flex-col gap-4 rounded-card border-2 border-primary bg-surface p-5">
            <label className="flex flex-col gap-2">
              <span className="text-body font-bold">Nombre</span>
              <input className={field} required autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-body font-bold">Relación</span>
              <input className={field} placeholder="hijo, hija, vecina…" value={draft.relation} onChange={(e) => setDraft({ ...draft, relation: e.target.value })} />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-body font-bold">Teléfono</span>
              <input className={field} type="tel" inputMode="tel" placeholder="+56 9 1234 5678" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
            </label>
            {error && <p className="text-body text-warn">No pude guardarlo. ¿Lo intentamos de nuevo?</p>}
            <div className="grid grid-cols-2 gap-4">
              <Button variant="muted" onClick={() => setDraft(null)}>
                No, volver
              </Button>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setDraft({ name: "", relation: "", phone: "" })}
            className="flex min-h-16 cursor-pointer items-center justify-center gap-2.5 rounded-card border-2 border-dashed border-line-strong text-body-lg font-bold text-primary active:bg-sunken"
          >
            <Icon name="person_add" size="1.75rem" />
            {contacts.length ? "Agregar otro contacto" : "Agregar un contacto"}
          </button>
        )}

        <div className="mt-2 flex items-start gap-3">
          <Icon name="visibility" size="1.75rem" className="text-ink-muted" />
          <p className="text-body text-ink-muted text-pretty">Sus contactos pueden ver cómo está, pero nunca cambiar sus datos. Usted decide quién entra.</p>
        </div>
      </div>

      <div className="mt-auto p-6">
        <Button onClick={() => router.push("/inicio")}>Terminar</Button>
      </div>

      {removing && (
        <Sheet onClose={() => setRemoving(null)}>
          <h2 className="mt-2 text-h1 font-extrabold">¿Quitar a {removing.name}?</h2>
          <p className="text-body-lg text-ink-muted">Ya no recibirá mensajes si hay una alerta urgente.</p>
          <Button variant="danger" icon="delete" onClick={remove}>
            Sí, quitar
          </Button>
          <Button variant="secondary" onClick={() => setRemoving(null)}>
            No, volver
          </Button>
        </Sheet>
      )}
    </>
  );
}
