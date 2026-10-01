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

export function useSpeechInput(onFinal: (text: string) => void) {
  // Client-only hook (used under CareProvider, which never renders on the server)
  const [supported] = useState(() => recognitionCtor() !== null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const rec = useRef<Recognition | null>(null);
  const finalText = useRef("");
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => {
    return () => rec.current?.abort();
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return false;
    const r = new Ctor();
    r.lang = "es-CL";
    r.interimResults = true;
    r.continuous = false;
    finalText.current = "";
    r.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText.current += res[0].transcript;
        else text += res[0].transcript;
      }
      setInterim(finalText.current + text);
    };
    r.onerror = () => setListening(false);
    r.onend = () => {
      setListening(false);
      setInterim("");
      const said = finalText.current.trim();
      if (said) onFinalRef.current(said);
    };
    rec.current = r;
    try {
      r.start();
      setListening(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const stop = useCallback(() => rec.current?.stop(), []);

  return { supported, listening, interim, start, stop };
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
