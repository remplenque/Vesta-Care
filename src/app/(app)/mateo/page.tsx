"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useCare } from "@/components/CareProvider";
import { MASCOT_HALO, MascotFace, type MascotState } from "@/components/Mascot";
import { Icon } from "@/components/ui";
import { useCompanionVoice } from "@/hooks/useCompanionVoice";
import { useSpeechInput } from "@/hooks/useSpeech";
import type { ChatMessage } from "@/lib/data";
import { PERSONAS, type Persona } from "@/lib/mateo/prompt";
import { getSupabase } from "@/lib/supabase/client";
import { firstName } from "@/lib/time";
import { useAnnounceListening, useTalkRequest } from "@/hooks/useTalk";

// 06 · Chat with the companion. The face is the mic (single tap, ACCESSIBILITY §6); one message
// at a time in a fixed-height bubble that scrolls inside with a "Deslice para leer más" hint
// ("Repetir" reads the whole message, so swiping is not the only way to get it; §6 no gesture
// is the only way); "Repetir" replays the same recording (§7); tap-to-answer suggestions.
// History is persisted in chat_messages and sent to /api/mateo as context.

const START = ["¿Cómo estoy hoy?", "¿Qué hago?", "Cuénteme algo bonito"];
const PERSONA_KEY = "vesta.persona";

type Api = { reply: string; suggestions?: string[]; fallback?: boolean };

function Chat() {
  const params = useSearchParams();
  const { userId, data } = useCare();
  const supabase = getSupabase();
  const voice = useCompanionVoice();

  // Companion choice survives reloads (per-device convenience, not health data). Client-only
  // screen (CareProvider never renders on the server), so localStorage is safe here.
  const [persona, setPersona] = useState<Persona>(() => {
    try {
      const saved = localStorage.getItem(PERSONA_KEY);
      if (PERSONAS.includes(saved as Persona)) return saved as Persona;
    } catch {}
    return "Mateo";
  });
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [said, setSaid] = useState("");
  const [reply, setReply] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>(START);
  const [thinking, setThinking] = useState(false);
  const [chatting, setChatting] = useState(false);
  const [draft, setDraft] = useState("");
  const [more, setMore] = useState(false);
  const textBox = useRef<HTMLDivElement>(null);
  const autoStarted = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  const name = firstName(data?.profile?.full_name);
  const hello = `¡Hola${name ? `, ${name}` : ""}! Soy ${persona}, qué alegría que conversemos. Tóqueme para hablar.`;
  const shown = chatting ? reply : hello;

  useEffect(() => {
    supabase
      .from("chat_messages")
      .select("*")
      .eq("user_id", userId)
      .in("role", ["user", "assistant"])
      .order("ts", { ascending: false })
      .limit(12)
      .then(({ data }) => setHistory((data ?? []).reverse()));
  }, [supabase, userId]);

  // The swipe hint appears only while there is unread text below
  const updateMore = useCallback(() => {
    const el = textBox.current;
    if (!el) return;
    setMore(el.scrollHeight > el.clientHeight + 4 && el.scrollTop + el.clientHeight < el.scrollHeight - 8);
  }, []);
  useEffect(() => {
    textBox.current?.scrollTo({ top: 0 });
    requestAnimationFrame(updateMore);
  }, [shown, said, updateMore]);

  const send = useCallback(
    async (text: string, via: "voice" | "text") => {
      const content = text.trim();
      if (!content || thinking) return;
      voice.stop();
      setChatting(true);
      setSaid(content);
      setThinking(true);
      const { data: userMsg } = await supabase
        .from("chat_messages")
        .insert({ user_id: userId, role: "user", content, metadata: { via, persona } })
        .select()
        .single();
      const next = [...history, ...(userMsg ? [userMsg] : [])].slice(-12);
      setHistory(next);
      let answer: Api;
      try {
        const res = await fetch("/api/mateo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ persona, messages: next.map((m) => ({ role: m.role, content: m.content ?? "" })) }),
        });
        if (!res.ok) throw new Error(String(res.status));
        answer = (await res.json()) as Api;
      } catch {
        answer = { reply: "No pude responderle. ¿Lo intentamos de nuevo?", suggestions: [content], fallback: true };
      }
      setThinking(false);
      setReply(answer.reply);
      setSuggestions(answer.suggestions?.length ? answer.suggestions : START);
      voice.speak(answer.reply, persona);
      const { data: botMsg } = await supabase
        .from("chat_messages")
        .insert({ user_id: userId, role: "assistant", content: answer.reply, metadata: { persona, fallback: !!answer.fallback } })
        .select()
        .single();
      if (botMsg) setHistory((h) => [...h, botMsg].slice(-12));
    },
    [history, persona, supabase, thinking, userId, voice],
  );

  const speech = useSpeechInput((text) => send(text, "voice"));

  // "Hablar con Mateo" on Inicio opens this screen already listening
  useEffect(() => {
    if (params.get("voz") === "1" && speech.supported && !autoStarted.current) {
      autoStarted.current = true;
      speech.start();
    }
  }, [params, speech]);

  const contact = data?.contacts.find((c) => c.phone);
  const state: MascotState = speech.listening ? "listening" : thinking ? "thinking" : voice.speaking ? "speaking" : "idle";
  const status = speech.listening
    ? speech.interim
      ? `"${speech.interim}…"`
      : "Le escucho… toque de nuevo para terminar"
    : thinking
      ? "Pensando…"
      : voice.speaking
        ? `${persona} está hablando`
        : voice.blocked
          ? "Toque «Repetir» para escucharme"
          : speech.supported
            ? `Toque a ${persona} para hablar`
            : "Este navegador no permite hablar. Puede escribir abajo.";

  function tapFace() {
    if (thinking) return;
    if (!speech.supported) return input.current?.focus();
    if (speech.listening) return speech.stop();
    voice.stop();
    speech.start();
  }

  // The bottom bar's round talk button does the same as tapping the face (hooks/useTalk.ts)
  useTalkRequest(tapFace);
  useAnnounceListening(speech.listening);

  function choose(p: Persona) {
    if (p === persona) return;
    setPersona(p);
    try {
      localStorage.setItem(PERSONA_KEY, p);
    } catch {}
    const text = `¡Hola${name ? `, ${name}` : ""}! Soy ${p}. ¿Cómo está hoy?`;
    setChatting(true);
    setSaid("");
    setReply(text);
    setSuggestions(START);
    voice.speak(text, p);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    send(draft, "text");
    setDraft("");
  }

  return (
    <div className="flex h-[calc(100dvh-var(--top-h)-var(--nav-h)-env(safe-area-inset-bottom))] flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-3 px-5 pt-5">
        <span className="text-body font-bold text-ink-muted">Su acompañante</span>
        <div role="group" aria-label="Con quién quiere conversar" className="flex rounded-full border-2 border-line-strong bg-surface p-1">
          {PERSONAS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={p === persona}
              onClick={() => choose(p)}
              className={`min-h-14 cursor-pointer rounded-full px-5 text-body font-bold ${p === persona ? "bg-primary text-white" : "text-ink-muted"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </header>

      {/* Scrolls only if the screen is too short (or text is "Muy grande"), so nothing is ever hidden */}
      <div className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto px-5 pt-3">
        <button
          type="button"
          onClick={tapFace}
          aria-label={speech.listening ? "Dejar de escuchar" : `Hablar con ${persona}`}
          className={`relative shrink-0 cursor-pointer rounded-full transition-[width] duration-300 ${MASCOT_HALO[persona]} ${
            speech.listening ? "listening" : ""
          } ${chatting ? "w-[min(150px,40vw,18dvh)]" : "w-[min(240px,62vw,26dvh)]"} aspect-square`}
        >
          <MascotFace persona={persona} state={state} className="absolute inset-0 h-full w-full" />
        </button>

        <p role="status" className={`shrink-0 text-center text-body font-bold ${speech.listening ? "text-crit" : "text-ink-muted"}`}>
          {status}
        </p>

        {/* Takes the free space; long messages scroll inside it, the screen never grows */}
        <section className="flex min-h-[10rem] w-full flex-1 rounded-card border border-line bg-surface">
          <div className="flex min-h-0 flex-1 gap-3 p-4">
            <div ref={textBox} onScroll={updateMore} aria-live="polite" className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
              {said && <p className="mb-1.5 text-body text-ink-muted">Usted: “{said}”</p>}
              <p className="text-body-lg font-semibold">{thinking ? "Pensando…" : shown}</p>
              {more && (
                <p aria-hidden className="sticky bottom-0 flex items-center gap-1 bg-gradient-to-t from-surface from-60% to-transparent pt-4 text-small font-bold text-primary">
                  <Icon name="swipe_up" size="1.3rem" />
                  Deslice para leer más
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => (voice.speaking ? voice.stop() : voice.replay() || voice.speak(shown, persona))}
              aria-label={voice.speaking ? "Detener la voz" : "Repetir en voz alta"}
              className="flex min-h-16 w-[88px] shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 self-start rounded-btn border-2 border-primary bg-primary-soft text-small font-bold text-primary"
            >
              <Icon name={voice.speaking ? "stop" : "volume_up"} fill size="1.75rem" />
              {voice.speaking ? "Detener" : "Repetir"}
            </button>
          </div>
        </section>

        <div role="group" aria-label="Respuestas rápidas" className="flex shrink-0 flex-wrap justify-center gap-3 pb-3">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={thinking}
              onClick={() => send(s, "text")}
              className="min-h-14 cursor-pointer rounded-full border-2 border-primary bg-surface px-[18px] text-body font-bold text-primary active:bg-primary-soft disabled:opacity-45"
            >
              {s}
            </button>
          ))}
          {contact?.phone && (
            <a
              href={`tel:${contact.phone.replace(/\s+/g, "")}`}
              className="inline-flex min-h-14 items-center gap-2 rounded-full border-2 border-primary bg-surface px-[18px] text-body font-bold text-primary active:bg-primary-soft"
            >
              <Icon name="call" size="1.4rem" />
              Llamar a {firstName(contact.name)}
            </a>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 border-t border-line bg-surface px-5 py-3">
        <form onSubmit={submit} className="flex min-w-0 flex-1 items-center gap-3">
          <input
            ref={input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Escriba aquí"
            aria-label="Escriba su mensaje"
            className="min-h-14 min-w-0 flex-1 rounded-btn border-2 border-line-strong bg-surface px-4 text-body-lg focus:border-primary"
          />
          <button type="submit" aria-label="Enviar" className="flex min-h-14 min-w-14 cursor-pointer items-center justify-center rounded-btn bg-primary text-white">
            <Icon name="send" size="1.6rem" />
          </button>
        </form>
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
