"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCompanionVoice } from "@/hooks/useCompanionVoice";
import { useSpeechInput } from "@/hooks/useSpeech";
import type { Persona } from "@/lib/mateo/prompt";

// The guided steps after login (/cuidadores, /mi-ficha, /mis-remedios) run in one of two modes,
// chosen on /acompanante and stored per device:
//   "voz"  → the companion speaks every question and then listens by itself (hands-free); typing is
//            hidden behind "Prefiero escribir".
//   "chat" → nothing plays on its own and the mic is off: questions and answers show as a chat,
//            answered by typing or with buttons ("Escuchar" reads a message on demand).

export type GuideMode = "voz" | "chat";
export type GuideMessage = { from: "companion" | "person"; text: string };

const MODE_KEY = "vesta.guide_mode";

export function savedMode(): GuideMode {
  try {
    return localStorage.getItem(MODE_KEY) === "chat" ? "chat" : "voz";
  } catch {
    return "voz";
  }
}

export function saveMode(mode: GuideMode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {}
}

export function useGuide(persona: Persona, onAnswer: (text: string) => void) {
  const [mode, setModeState] = useState<GuideMode>(savedMode);
  const [log, setLog] = useState<GuideMessage[]>([]);
  const [line, setLine] = useState("");
  const voice = useCompanionVoice();
  const listenTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const heard = useCallback((text: string) => {
    setLog((l) => [...l, { from: "person", text }]);
  }, []);

  const speech = useSpeechInput((text) => {
    heard(text);
    onAnswer(text);
  });
  const voiceMode = mode === "voz" && speech.supported;
  const { start: startListening, cancel: cancelListening } = speech;

  useEffect(() => () => clearTimeout(listenTimer.current), []);

  /** The companion says something: shown always, spoken only in voice mode. Hands-free: the mic opens
   *  only after THIS line has really finished playing (voice.speak's onDone, which never fires when
   *  the audio is stopped or replaced) plus a short pause, so it never hears the companion itself.
   *  listen=false for lines that expect no answer ("Estoy leyendo su ficha…", "Vamos a la app") */
  const say = useCallback(
    (text: string, spoken?: string, listen = true) => {
      setLine(text);
      setLog((l) => [...l, { from: "companion", text }]);
      if (!voiceMode) return;
      clearTimeout(listenTimer.current);
      cancelListening(); // never keep the mic open while the companion talks
      voice.speak(spoken ?? text, persona, () => {
        if (!listen) return;
        clearTimeout(listenTimer.current);
        listenTimer.current = setTimeout(startListening, 700);
      });
    },
    [cancelListening, persona, startListening, voice, voiceMode],
  );

  /** Stop everything (before navigating, or when the person taps a button instead) */
  const quiet = useCallback(() => {
    clearTimeout(listenTimer.current);
    voice.stop();
    cancelListening();
  }, [cancelListening, voice]);

  const setMode = useCallback(
    (m: GuideMode) => {
      saveMode(m);
      setModeState(m);
      if (m === "chat") quiet();
    },
    [quiet],
  );

  /** Read the last message aloud on demand (chat mode) or repeat it (voice mode). The mic closes
   *  while it plays; it doesn't reopen by itself after a manual repeat (tap "Tocar para hablar") */
  const repeat = useCallback(() => {
    if (voice.speaking) return voice.stop();
    clearTimeout(listenTimer.current);
    cancelListening();
    if (!voice.replay()) voice.speak(line, persona);
  }, [cancelListening, line, persona, voice]);

  /** Tap on the talk button: stop the companion and listen (or finish listening) */
  const toggleListen = useCallback(() => {
    clearTimeout(listenTimer.current);
    if (speech.listening) return speech.stop();
    voice.stop();
    speech.start();
  }, [speech, voice]);

  return { mode: voiceMode ? ("voz" as const) : ("chat" as const), setMode, say, heard, log, line, voice, speech, quiet, repeat, toggleListen };
}
