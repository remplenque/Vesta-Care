// Demo personas (fictional people, AGENTS.md §3.7). Each one runs a different simulator profile so
// the whole flow can be shown side by side. Shared by the /demo panel and the /api/demo/* routes.

export type PersonaKey = "luis" | "rosa" | "jorge";

/** stable: every reading in range · unstable: borderline values plus out-of-range episodes ·
 *  new: empty account, simulated as stable once onboarding confirms its modules */
export type SimProfile = "stable" | "unstable" | "new";

export type Persona = {
  key: PersonaKey;
  fullName: string;
  birthDate: string;
  profile: SimProfile;
  label: string;
  blurb: string;
  /** Login email. Luis's comes from DEMO_USER_EMAIL (he already exists); the others are created
   *  by /api/demo/reset with DEMO_USER_PASSWORD */
  email?: string;
  /** Demo login number (no SMS): /api/auth/phone signs in as this persona */
  loginPhone: string;
  /** Emergency contact seeded on reset (Luis's is created by scripts/create-demo-user.sql) */
  contact?: { name: string; relation: string; phone: string };
};

export const PERSONAS: Persona[] = [
  {
    key: "luis",
    fullName: "Luis Soto",
    birthDate: "1948-03-12",
    profile: "stable",
    loginPhone: "+56911111111",
    label: "Todo en rango",
    blurb: "Lecturas normales en presión, glucosa y pastillero. El día a día sin sobresaltos.",
  },
  {
    key: "rosa",
    fullName: "Rosa Muñoz",
    birthDate: "1945-06-21",
    profile: "unstable",
    loginPhone: "+56922222222",
    label: "Genera alertas",
    blurb: "Valores al límite y olvida sus remedios. Al abrir la app tiene una emergencia: glucosa muy baja y pulso acelerado.",
    email: "rosa@vestacare.cl",
    contact: { name: "Carolina Muñoz", relation: "hija", phone: "+56 9 7654 3210" },
  },
  {
    key: "jorge",
    fullName: "Jorge Pérez",
    birthDate: "1953-11-04",
    profile: "new",
    loginPhone: "+56933333333",
    label: "Cuenta nueva",
    blurb: "Sin ficha, módulos ni contactos. Hace el onboarding en la PWA y el simulador parte solo con lo que confirme.",
    email: "jorge@vestacare.cl",
  },
];

export function personaByKey(key: unknown): Persona | undefined {
  return PERSONAS.find((p) => p.key === key);
}
