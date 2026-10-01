"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Companion voice: ElevenLabs through /api/tts when configured, browser voice otherwise.
// Audio is cached per (voice, text) so "Repetir" replays the exact same recording without a new
// request (docs/ACCESSIBILITY.md §7: a visible button repeats the last thing Mateo said).

const CACHE_MAX = 30;
// 0.1 s of silence: playing it on the first tap "unlocks" the element so phones allow later audio
const SILENCE =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQQAAAAAAAAA";

function browserSpeak(text: string, onStart: () => void, onEnd: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return onEnd();
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "es-CL";
  u.rate = 0.9;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang === "es-CL") ?? window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("es"));
  if (voice) u.voice = voice;
  u.onstart = onStart;
  u.onend = onEnd;
  u.onerror = onEnd;
  window.speechSynthesis.speak(u);
}

export function useCompanionVoice() {
  const [speaking, setSpeaking] = useState(false);
  const [blocked, setBlocked] = useState(false); // phone blocked autoplay: one tap on "Repetir" plays it
  const [natural, setNatural] = useState<string[]>([]); // companions with an ElevenLabs voice
  const player = useRef<HTMLAudioElement | null>(null);
  const cache = useRef(new Map<string, string>());
  const last = useRef<{ text: string; key: string | null } | null>(null);
  const token = useRef(0);
  const ttsOk = useRef(true);

  useEffect(() => {
    player.current = new Audio();
    const unlock = () => {
      const p = player.current;
      if (!p || p.src) return;
      p.src = SILENCE;
      p.play().catch(() => {});
    };
    document.addEventListener("pointerdown", unlock, { once: true, capture: true });
    fetch("/api/tts/voices")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: { name: string }[]) => setNatural(list.map((v) => v.name)))
      .catch(() => {});
    const urls = cache.current;
    return () => {
      document.removeEventListener("pointerdown", unlock, true);
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const stop = useCallback(() => {
    token.current++;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    player.current?.pause();
    setSpeaking(false);
  }, []);

  const playUrl = useCallback((url: string, text: string) => {
    const p = player.current;
    if (!p) return;
    p.src = url;
    p.currentTime = 0;
    p.onplaying = () => {
      setBlocked(false);
      setSpeaking(true);
    };
    p.onended = () => setSpeaking(false);
    p.play().catch((err: unknown) => {
      setSpeaking(false);
      if (err instanceof DOMException && err.name === "NotAllowedError") setBlocked(true);
      else browserSpeak(text, () => setSpeaking(true), () => setSpeaking(false));
    });
  }, []);

  const speak = useCallback(
    async (text: string, voice: string) => {
      stop();
      const mine = token.current;
      const useTts = ttsOk.current && natural.includes(voice);
      const key = `${voice}|${text}`;
      last.current = { text, key: useTts ? key : null };
      if (!useTts) return browserSpeak(text, () => setSpeaking(true), () => setSpeaking(false));

      let url = cache.current.get(key);
      if (!url) {
        try {
          const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voice)}`);
          if (!res.ok) throw new Error(`tts ${res.status}`);
          url = URL.createObjectURL(await res.blob());
          cache.current.set(key, url);
          if (cache.current.size > CACHE_MAX) {
            const [oldKey, oldUrl] = cache.current.entries().next().value!;
            URL.revokeObjectURL(oldUrl);
            cache.current.delete(oldKey);
          }
        } catch {
          if (mine !== token.current) return;
          ttsOk.current = false; // don't pay the failed request on every reply; reload to retry
          last.current.key = null;
          return browserSpeak(text, () => setSpeaking(true), () => setSpeaking(false));
        }
      }
      if (mine === token.current) playUrl(url, text);
    },
    [natural, playUrl, stop],
  );

  /** Replays the last thing said with the same recording (no new request) */
  const replay = useCallback(() => {
    const l = last.current;
    if (!l) return false;
    stop();
    const url = l.key ? cache.current.get(l.key) : undefined;
    if (url) playUrl(url, l.text);
    else browserSpeak(l.text, () => setSpeaking(true), () => setSpeaking(false));
    return true;
  }, [playUrl, stop]);

  return { speak, replay, stop, speaking, blocked, natural };
}
