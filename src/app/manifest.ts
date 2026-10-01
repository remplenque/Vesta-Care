import type { MetadataRoute } from "next";

// Installable app (PWA). Icons come from the brand design (design/, "Dirección recomendada"):
// the companion looking out of the window of the home, on "Azul hogar". "any" icons keep the
// designed rounded square; "maskable" ones are full-bleed with the art inside the 80% safe zone,
// so Android can cut them into any shape. The splash screen uses background_color + the icon.
const icon = (size: number, purpose: "any" | "maskable") => ({
  src: `/icons/icon${purpose === "maskable" ? "-maskable" : ""}-${size}.png`,
  sizes: `${size}x${size}`,
  type: "image/png",
  purpose,
});

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Vesta Care",
    short_name: "Vesta Care",
    description: "Su salud, en orden y en sus manos. Su acompañante le espera en casa.",
    lang: "es-CL",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F7F4EF",
    theme_color: "#F7F4EF",
    categories: ["health", "medical", "lifestyle"],
    icons: [icon(192, "any"), icon(512, "any"), icon(192, "maskable"), icon(512, "maskable")],
    // Long-press on the home-screen icon (Android): straight to the three main places
    shortcuts: [
      { name: "Hablar con su acompañante", short_name: "Hablar", url: "/mateo", icons: [icon(192, "any")] },
      { name: "Resumen de su salud", short_name: "Resumen", url: "/inicio", icons: [icon(192, "any")] },
      { name: "Su calendario", short_name: "Calendario", url: "/calendario", icons: [icon(192, "any")] },
    ],
  };
}
