// Text-size setting (docs/ACCESSIBILITY.md §3). Stored per device; applied to <html>.

export type TextScale = "normal" | "grande" | "muy_grande";

export const TEXT_SCALES: { value: TextScale; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "grande", label: "Grande" },
  { value: "muy_grande", label: "Muy grande" },
];

const STORAGE_KEY = "vesta:text-scale";

// Runs before paint so the page never flashes at the wrong size
export const TEXT_SCALE_INIT_SCRIPT = `try{var s=localStorage.getItem("${STORAGE_KEY}");if(s)document.documentElement.dataset.textScale=s}catch(e){}`;

export function getTextScale(): TextScale {
  if (typeof document === "undefined") return "normal";
  return (document.documentElement.dataset.textScale as TextScale) || "normal";
}

export function setTextScale(scale: TextScale) {
  document.documentElement.dataset.textScale = scale;
  try {
    localStorage.setItem(STORAGE_KEY, scale);
  } catch {
    // private mode: the setting just won't persist
  }
}
