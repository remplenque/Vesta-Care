"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useCare } from "@/components/CareProvider";
import { Icon, MateoAvatar } from "@/components/ui";
import { speak, useSpeechInput } from "@/hooks/useSpeech";
import type { ChatMessage } from "@/lib/data";
import { getSupabase } from "@/lib/supabase/client";
import { firstName } from "@/lib/time";

type Meta = { via?: "voice" | "text" };

function Bubble({ m }: { m: ChatMessage }) {
  if (m.role === "user") {
    const via = (m.metadata as Meta | null)?.via;
    return (
      <div className="flex flex-col items-end gap-1.5">
        <div className="max-w-[85%] rounded-[22px_22px_6px_22px] bg-primary px-[18px] py-4 text-body-lg text-white">{m.content}</div>
        {via === "voice" && (
          <span className="flex items-center gap-1.5 text-small text-ink-subtle">
            <Icon name="mic" size="1.15rem" />
            Dicho por voz
          </span>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-end gap-2.5">
      <MateoAvatar size={36} />
      <div className="flex max-w-[85%] flex-col gap-2">
        <div className="rounded-[22px_22px_22px_6px] border border-line bg-surface px-[18px] py-4 text-body-lg">{m.content}</div>
        <button
          type="button"
          onClick={() => speak(m.content ?? "")}
          className="flex min-h-12 cursor-pointer items-center gap-2 self-start rounded-full bg-sunken px-3.5 text-body font-bold text-primary"
        >
          <Icon name="volume_up" size="1.4rem" />
          Escuchar
        </button>
      </div>
    </div>
  );
}

function Chat() {
  const params = useSearchParams();
  const { userId, data } = useCare();
  const supabase = getSupabase();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [keyboard, setKeyboard] = useState(false);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const autoStarted = useRef(false);

  useEffect(() => {
    supabase
      .from("chat_messages")
      .select("*")
      .eq("user_id", userId)
      .in("role", ["user", "assistant"])
      .order("ts")
      .limit(100)
      .then(({ data }) => setMessages(data ?? []));
  }, [supabase, userId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, thinking]);

  const send = useCallback(
    async (text: string, via: "voice" | "text") => {
      const content = text.trim();
      if (!content) return;
      const { data: userMsg } = await supabase.from("chat_messages").insert({ user_id: userId, role: "user", content, metadata: { via } }).select().single();
      const history = [...(messages ?? []), ...(userMsg ? [userMsg] : [])];
      setMessages(history);
      setThinking(true);
      try {
        const res = await fetch("/api/mateo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history.map((m) => ({ role: m.role, content: m.content })) }),
        });
        const { reply } = (await res.json()) as { reply: string };
        const { data: botMsg } = await supabase.from("chat_messages").insert({ user_id: userId, role: "assistant", content: reply }).select().single();
        if (botMsg) setMessages((ms) => [...(ms ?? []), botMsg]);
        if (via === "voice") speak(reply);
      } catch {
        setMessages((ms) => [
          ...(ms ?? []),
          { id: crypto.randomUUID(), user_id: userId, role: "assistant", content: "No pude responderle. ¿Lo intentamos de nuevo?", metadata: {}, ts: new Date().toISOString() },
        ]);
      } finally {
        setThinking(false);
      }
    },
    [supabase, userId, messages],
  );

  const speech = useSpeechInput((text) => send(text, "voice"));

  // "Hablar con Mateo" on Inicio opens this screen already listening
  useEffect(() => {
    if (params.get("voz") === "1" && speech.supported && messages && !autoStarted.current) {
      autoStarted.current = true;
      speech.start();
    }
  }, [params, speech, messages]);

  // Without speech recognition (Safari, Firefox) the keyboard is the only input
  const typingMode = keyboard || !speech.supported;
  const contact = data?.contacts.find((c) => c.phone);
  const name = firstName(data?.profile?.full_name);
  const chips = ["¿Cómo estoy hoy?", "¿Qué hago?"];

  function submit(e: FormEvent) {
    e.preventDefault();
    send(draft, "text");
    setDraft("");
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-3.5 border-b border-line px-6 pt-6 pb-4">
        <MateoAvatar size={52} />
        <div className="flex flex-col">
          <h1 className="text-lead font-extrabold">Mateo</h1>
          <span className="text-body text-ink-muted">Su acompañante</span>
        </div>
      </header>

      <div className="flex flex-col gap-[18px] px-5 pt-5" aria-live="polite">
        {messages && messages.length === 0 && (
          <div className="flex items-end gap-2.5">
            <MateoAvatar size={36} />
            <div className="max-w-[85%] rounded-[22px_22px_22px_6px] border border-line bg-surface px-[18px] py-4 text-body-lg">
              Hola{name ? ` don ${name}` : ""}. Soy Mateo. Puede preguntarme cómo está o qué hacer si se siente mal.
            </div>
          </div>
        )}
        {messages?.map((m) => <Bubble key={m.id} m={m} />)}
        {thinking && (
          <div className="flex items-end gap-2.5">
            <MateoAvatar size={36} />
            <div className="rounded-[22px_22px_22px_6px] border border-line bg-surface px-[18px] py-4 text-body-lg text-ink-muted">Pensando…</div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      <div className="flex flex-wrap gap-2.5 px-5 pt-5">
        {chips.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => send(c, "text")}
            className="min-h-14 cursor-pointer rounded-full border-2 border-primary bg-surface px-[18px] text-body font-bold text-primary active:bg-primary-soft"
          >
            {c}
          </button>
        ))}
        {contact?.phone && (
          <a
            href={`tel:${contact.phone.replace(/\s+/g, "")}`}
            className="inline-flex min-h-14 items-center rounded-full border-2 border-primary bg-surface px-[18px] text-body font-bold text-primary active:bg-primary-soft"
          >
            Llamar a {firstName(contact.name)}
          </a>
        )}
      </div>

      <div className="sticky bottom-[88px] z-20 mt-auto flex flex-col items-center gap-3.5 border-t border-line bg-surface px-6 pt-5 pb-4">
        {typingMode ? (
          <form onSubmit={submit} className="flex w-full items-center gap-3">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escriba su pregunta"
              aria-label="Escriba su pregunta"
              className="min-h-14 flex-1 rounded-btn border-2 border-line-strong bg-surface px-4 text-body-lg focus:border-primary"
            />
            <button type="submit" aria-label="Enviar" className="flex min-h-14 min-w-14 cursor-pointer items-center justify-center rounded-btn bg-primary text-white">
              <Icon name="send" size="1.6rem" />
            </button>
          </form>
        ) : (
          <div className="min-h-[30px] text-center text-body-lg text-ink-muted italic">{speech.interim ? `"${speech.interim}…"` : ""}</div>
        )}
        <div className="flex w-full items-center justify-between">
          {speech.supported ? (
            <button
              type="button"
              onClick={() => setKeyboard((k) => !k)}
              className="flex min-h-14 min-w-[72px] cursor-pointer flex-col items-center gap-0.5 text-body font-bold text-primary"
            >
              <Icon name={keyboard ? "mic" : "keyboard"} size="1.75rem" />
              {keyboard ? "Hablar" : "Escribir"}
            </button>
          ) : (
            <span className="min-w-[72px]" />
          )}
          {speech.supported && !typingMode && (
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => (speech.listening ? speech.stop() : speech.start())}
                aria-label={speech.listening ? "Dejar de escuchar" : "Hablar con Mateo"}
                className={`mt-4 flex h-[92px] w-[92px] cursor-pointer items-center justify-center rounded-full ${
                  speech.listening ? "listening bg-brand text-ink" : "bg-primary text-white"
                }`}
              >
                <Icon name={speech.listening ? "stop" : "mic"} fill size="2.75rem" />
              </button>
              <span className="mt-2.5 text-body font-extrabold">{speech.listening ? "Escuchando…" : "Hablar"}</span>
            </div>
          )}
          <span className="min-w-[72px]" />
        </div>
        {!speech.supported && <span className="text-small text-ink-subtle">Este navegador no permite hablar. Puede escribir.</span>}
      </div>
    </div>
  );
}

// 06 · Chat con Mateo
export default function MateoPage() {
  return (
    <Suspense>
      <Chat />
    </Suspense>
  );
}
