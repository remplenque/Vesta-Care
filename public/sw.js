// Vesta Care service worker: installability only for now.
// Web Push (docs/OPEN-ISSUES.md #2) will add a "push" listener here.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
