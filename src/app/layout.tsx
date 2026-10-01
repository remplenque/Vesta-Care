import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Atkinson_Hyperlegible_Mono } from "next/font/google";
import { ServiceWorker } from "@/components/ServiceWorker";
import { TEXT_SCALE_INIT_SCRIPT } from "@/lib/text-scale";
import "./globals.css";

const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const atkinsonMono = Atkinson_Hyperlegible_Mono({
  variable: "--font-atkinson-mono",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "Vesta Care",
  description: "Su salud, en orden y en sus manos. Mateo le acompaña cada día.",
  applicationName: "Vesta Care",
  appleWebApp: { capable: true, title: "Vesta Care", statusBarStyle: "default" },
};

// Never block zoom: docs/ACCESSIBILITY.md §10
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F7F4EF",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CL" className={`${atkinson.variable} ${atkinsonMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEXT_SCALE_INIT_SCRIPT }} />
        {/* Icon font: display=block avoids flashing ligature names ("check_circle") as text */}
        {/* eslint-disable-next-line @next/next/google-font-display, @next/next/no-page-custom-font -- root layout loads it for every page */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0..1,0&display=block"
        />
      </head>
      <body className="min-h-dvh">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
