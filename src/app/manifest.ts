import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vesta Care",
    short_name: "Vesta Care",
    description: "Su salud, en orden y en sus manos.",
    start_url: "/",
    display: "standalone",
    background_color: "#F7F4EF",
    theme_color: "#F7F4EF",
    lang: "es-CL",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
