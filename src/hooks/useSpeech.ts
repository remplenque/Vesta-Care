"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Web Speech API: STT exists only in Chrome/Edge, so there is always a keyboard fallback
// (docs/OPEN-ISSUES.md §3). Mic is a single tap, not press-and-hold (docs/ACCESSIBILITY.md §6).

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Older adults pause mid-sentence. A single-shot recognizer ends on the first pause and cuts them
// off, so this one listens continuously and only finishes after a long silence:
//   - SILENCE_MS of quiet after the last word → done (reset by every new word, even interim ones)
//   - NO_SPEECH_MS without any word at all → give up quietly
//   - MAX_MS hard cap; Chrome may also end a session on its own → restart it if nothing was said yet
//   - fillers only ("eh", "mmm") or 1 letter count as nothing (noise, a cough, the TV)
const SILENCE_MS = 2200;
const NO_SPEECH_MS = 12000;
const MAX_MS = 45000;
const FILLER = /^(e+h*|m+|a+h*|o+h*|e+m+|h+m+|uh+|um+|este+)$/i;

function meaningful(text: string) {
  const t = text.trim().replace(/[.,!?¿¡]/g, "");
  if (t.length < 2) return "";
  if (t.split(/\s+/).every((w) => FILLER.test(w))) return "";
  return text.trim();
}

export function useSpeechInput(onFinal: (text: string) => void) {
  // Client-only hook (used under CareProvider, which never renders on the server)
  const [supported] = useState(() => recognitionCtor() !== null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const rec = useRef<Recognition | null>(null);
  const finalText = useRef(""); // everything final so far in this turn
  const base = useRef(""); // final text from earlier recognizer sessions (Chrome restarts)
  const heardText = useRef(""); // final + interim, so a pause right after speaking still counts
  const restarts = useRef(0);
  const reopen = useRef<() => boolean>(() => false);
  const onFinalRef = useRef(onFinal);
  const timers = useRef<{ silence?: ReturnType<typeof setTimeout>; max?: ReturnType<typeof setTimeout> }>({});
  const session = useRef({ active: false, startedAt: 0, done: false });

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  const clearTimers = () => {
    clearTimeout(timers.current.silence);
    clearTimeout(timers.current.max);
  };

  useEffect(() => {
    const t = timers.current; // same object for the whole life of the hook
    const s = session.current;
    return () => {
      s.active = false;
      clearTimeout(t.silence);
      clearTimeout(t.max);
      rec.current?.abort();
    };
  }, []);

  /** Ends the listening turn and hands over what was said (if anything meaningful) */
  const finish = useCallback(() => {
    if (!session.current.active || session.current.done) return;
    session.current.done = true;
    session.current.active = false;
    clearTimers();
    try {
      rec.current?.stop();
    } catch {}
    setListening(false);
    setInterim("");
    const said = meaningful(finalText.current) || meaningful(heardText.current);
    if (said) onFinalRef.current(said);
  }, []);

  const armSilence = useCallback(
    (ms: number) => {
      clearTimeout(timers.current.silence);
      timers.current.silence = setTimeout(finish, ms);
    },
    [finish],
  );

  const open = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return false;
    const r = new Ctor();
    r.lang = "es-CL";
    r.interimResults = true;
    r.continuous = true;
    base.current = finalText.current ? `${finalText.current} ` : "";
    r.onresult = (e) => {
      // In continuous mode e.results holds the whole session so far: rebuild, don't append
      let finals = "";
      let partial = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finals += res[0].transcript;
        else partial += res[0].transcript;
      }
      finalText.current = `${base.current}${finals}`.replace(/\s+/g, " ").trim();
      heardText.current = `${finalText.current} ${partial}`.replace(/\s+/g, " ").trim();
      setInterim(heardText.current);
      if (heardText.current) armSilence(SILENCE_MS); // every word pushes the end further away
    };
    r.onerror = (ev) => {
      // "no-speech"/"aborted" are handled by onend; permission errors end the turn
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed" || ev.error === "audio-capture") {
        session.current.active = false;
        clearTimers();
        setListening(false);
      }
    };
    r.onend = () => {
      if (!session.current.active || session.current.done) return;
      // Chrome ended the session by itself (a pause, the network, its own time limit). The person
      // may still be talking: reopen and let the silence timer decide when the turn is over.
      // A few restarts at most, so a broken mic can't loop.
      const elapsed = Date.now() - session.current.startedAt;
      if (elapsed < MAX_MS && restarts.current < 5) {
        restarts.current += 1;
        try {
          reopen.current();
          return;
        } catch {}
      }
      finish();
    };
    rec.current = r;
    r.start();
    return true;
  }, [armSilence, finish]);

  useEffect(() => {
    reopen.current = open;
  }, [open]);

  const start = useCallback(() => {
    if (session.current.active) return true;
    finalText.current = "";
    heardText.current = "";
    restarts.current = 0;
    session.current = { active: true, startedAt: Date.now(), done: false };
    clearTimers();
    timers.current.silence = setTimeout(finish, NO_SPEECH_MS); // nothing said at all → give up
    timers.current.max = setTimeout(finish, MAX_MS);
    try {
      if (!open()) throw new Error("no recognizer");
      setListening(true);
      return true;
    } catch {
      session.current.active = false;
      clearTimers();
      return false;
    }
  }, [finish, open]);

  /** The person taps "Terminar de hablar": deliver right away */
  const stop = useCallback(() => finish(), [finish]);

  /** Close the mic and throw away whatever it heard (e.g. the companion is about to speak) */
  const cancel = useCallback(() => {
    if (!session.current.active) return;
    session.current.done = true;
    session.current.active = false;
    clearTimers();
    try {
      rec.current?.abort();
    } catch {}
    setListening(false);
    setInterim("");
  }, []);

  return { supported, listening, interim, start, stop, cancel };
}

/** Text-to-speech at 0.9 speed (docs/ACCESSIBILITY.md §7). Never autoplays on load */
export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "es-CL";
  u.rate = 0.9;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("es"));
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
}
