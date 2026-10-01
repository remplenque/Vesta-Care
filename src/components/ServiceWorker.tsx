"use client";

import { useEffect } from "react";

// Registers the minimal service worker that makes the PWA installable (Web Push hooks in later)
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
