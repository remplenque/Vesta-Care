// Emergency sound + spoken announcement for the panic button. Module-level (not a React hook) on
// purpose: right after "Sí, pedir ayuda" the app jumps to /alerta/[id], which unmounts the button,
// and the siren and the voice must keep going through that navigation.
// Must be started from the tap itself (browsers only allow sound after a user gesture).

let ctx: AudioContext | null = null;
let stopSiren: (() => void) | null = null;
let voice: HTMLAudioElement | null = null;

/** A two-tone wail (rises and falls once per second). Not a flashing light: sound only */
export function playSiren(ms = 4000) {
  if (typeof window === "undefined") return;
  stopSiren?.();
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  ctx ??= new Ctor();
  void ctx.resume();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  gain.gain.value = 0.0001;
  osc.connect(gain).connect(ctx.destination);
  const t0 = ctx.currentTime;
  gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.08); // loud enough, not ear-splitting
  for (let t = 0; t < ms / 1000; t += 1) {
    osc.frequency.setValueAtTime(650, t0 + t);
    osc.frequency.linearRampToValueAtTime(1150, t0 + t + 0.5);
    osc.frequency.linearRampToValueAtTime(650, t0 + t + 1);
  }
  gain.gain.setValueAtTime(0.18, t0 + ms / 1000 - 0.15);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
  osc.start(t0);
  osc.stop(t0 + ms / 1000 + 0.05);
  stopSiren = () => {
    try {
      osc.stop();
    } catch {}
    stopSiren = null;
  };
  osc.onended = () => {
    stopSiren = null;
  };
}

function browserSay(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "es-CL";
  u.rate = 0.95;
  const v = window.speechSynthesis.getVoices().find((x) => x.lang.startsWith("es"));
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

/** Siren first, then the companion says who is being told. Fire from the "Sí, pedir ayuda" tap */
export function emergency(text: string, persona: string, sirenMs = 3500) {
  playSiren(sirenMs);
  // fetch the voice during the siren so it starts right when the siren ends
  const spoken = fetch(`/api/tts?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(persona)}`)
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
    .then((b) => URL.createObjectURL(b))
    .catch(() => null);
  setTimeout(async () => {
    const url = await spoken;
    if (!url) return browserSay(text);
    voice?.pause();
    voice = new Audio(url);
    voice.play().catch(() => browserSay(text));
  }, sirenMs + 150);
}
