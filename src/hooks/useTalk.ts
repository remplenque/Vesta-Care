"use client";

import { useEffect, useRef, useState } from "react";
import { PERSONAS, type Persona } from "@/lib/mateo/prompt";

// Bridge between the bottom bar's talk button and the companion screen (/mateo), which owns the
// microphone. The bar asks with requestTalk(); the screen answers through useTalkRequest() and
// reports whether it is listening with useAnnounceListening(), so the bar can show it too.

const TALK_EVENT = "vesta:talk";
const LISTENING_EVENT = "vesta:listening";
let listening = false;

export function requestTalk() {
  window.dispatchEvent(new Event(TALK_EVENT));
}

/** Companion screen: run `handler` (open or close the mic) when the bar's talk button is pressed */
export function useTalkRequest(handler: () => void) {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => {
    const on = () => latest.current();
    window.addEventListener(TALK_EVENT, on);
    return () => window.removeEventListener(TALK_EVENT, on);
  }, []);
}

function announce(value: boolean) {
  listening = value;
  window.dispatchEvent(new CustomEvent<boolean>(LISTENING_EVENT, { detail: value }));
}

/** Companion screen: tell the bar whether the mic is open (and that it closed when leaving) */
export function useAnnounceListening(value: boolean) {
  useEffect(() => announce(value), [value]);
  useEffect(() => () => announce(false), []);
}

/** Bottom bar: is the companion screen listening right now? */
export function useTalkListening() {
  const [value, setValue] = useState(() => listening);
  useEffect(() => {
    const on = (e: Event) => setValue((e as CustomEvent<boolean>).detail);
    window.addEventListener(LISTENING_EVENT, on);
    return () => window.removeEventListener(LISTENING_EVENT, on);
  }, []);
  return value;
}

// Same per-device key as /acompanante and /mateo
const PERSONA_KEY = "vesta.persona";

/** The companion chosen on this device (Mateo until one is chosen) */
export function readCompanion(): Persona {
  try {
    const saved = localStorage.getItem(PERSONA_KEY);
    if (PERSONAS.includes(saved as Persona)) return saved as Persona;
  } catch {}
  return "Mateo";
}
