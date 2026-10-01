import type { ExtractedRecord } from "@/lib/ficha";

// TODO(P3 · Mateo/IA): replace this stub with the real extraction — read the PDF from Storage
// (bucket medical-records, body.file_path), send its text to the LLM and return this same shape.
// Until then it returns Don Luis's demo ficha so the onboarding flow works end to end.
// The user still reviews and confirms everything on screen 01c (AGENTS.md §3.8).

const DEMO_FICHA: ExtractedRecord = {
  conditions: ["Hipertensión arterial", "Diabetes tipo 2"],
  medications: [
    { name: "Losartán", dose: "50 mg", times: ["08:00", "20:00"] },
    { name: "Metformina", dose: "850 mg", times: ["08:00", "20:00"] },
  ],
  thresholds: {
    bp: { systolic: { normal: [90, 140], margin: 20 }, diastolic: { normal: [60, 90], margin: 10 } },
    glucose: { mg_dl: { normal: [80, 180], margin: 10 } },
  },
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { file_path?: string };
  if (!body.file_path) return Response.json({ error: "file_path is required" }, { status: 400 });

  // Gives the "Mateo está leyendo su ficha…" state a moment on screen
  await new Promise((r) => setTimeout(r, 2500));
  return Response.json({ extracted: DEMO_FICHA, stub: true });
}
