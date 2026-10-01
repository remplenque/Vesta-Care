// Accessibility tokens. Binding from the first component: docs/08-ACCESSIBILITY.md.
// Font sizes are px values for the `html` base; components must size text in `rem` (§3, §10).

export type TamanoTexto = "normal" | "grande" | "muy_grande";

// §3 — every layout must survive `muy_grande` without clipping or overlap.
export const escalas: Record<TamanoTexto, { base: number; titulo: number; grande: number; boton: number }> = {
  normal:     { base: 20, titulo: 28, grande: 34, boton: 22 },
  grande:     { base: 24, titulo: 34, grande: 42, boton: 26 },
  muy_grande: { base: 30, titulo: 42, grande: 52, boton: 32 },
};

// §4 — color never carries information alone: always color + icon + text.
export const colores = {
  fondo:        "#FFFFFF",
  texto:        "#1A1A1A",   // 16:1 sobre blanco
  textoSuave:   "#4A4A4A",   // 9:1 — el gris más claro permitido
  primario:     "#B4530A",   // ámbar oscuro, legible y cálido
  exito:        "#1B6B3A",   // verde oscuro
  atencion:     "#A35200",   // ámbar fuerte
  urgente:      "#B32020",   // rojo oscuro
  borde:        "#8A8A8A",   // bordes visibles de verdad
};

// §2 — hard minimums. Touch targets in px so they never shrink with the font (§10).
export const minimos = {
  areaTactilPx: 56,
  separacionPx: 16,
  textoSecundarioPt: 17,
  interlineado: 1.5,
  dobleToqueMs: 500,   // §6: ignore the second tap inside this window
};
