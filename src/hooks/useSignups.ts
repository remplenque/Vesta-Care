"use client";

import { useEffect, useState } from "react";
import { readSignups } from "@/lib/agenda";

/** Activities the person signed up for on this device; updates when the chat or the Calendario
 *  changes them (setSignup dispatches "vesta-signups") */
export function useSignups() {
  const [signups, setSignups] = useState<string[]>(readSignups);
  useEffect(() => {
    const sync = () => setSignups(readSignups());
    window.addEventListener("vesta-signups", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("vesta-signups", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return signups;
}
