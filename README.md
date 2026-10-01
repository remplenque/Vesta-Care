# Vesta Care

Plataforma para centralizar el monitoreo de salud de adultos mayores que viven solos o en su casa.
Al centro, **Mateo**: un agente que analiza, sugiere, explica las alertas y acompaña.

**Hack4Seniors UDD · 1 de octubre de 2026**
Vicente Rodríguez · Baptiste Vial · Luis-Felipe Cáceres

```
 Simulador de dispositivos ──► Supabase (lecturas → motor de reglas → alertas)
                                   │                      │
                                   ▼                      ▼
                     PWA del adulto mayor        WhatsApp simulado + Web Push
                     + Mateo (chat y voz)        + vista del contacto /c/[token]
```

**Stack:** Next.js (PWA) · Supabase · Vercel AI SDK · Web Speech API. Sin hardware: todos los
dispositivos son simulados.

## Para agentes de código

Lee **[`AGENTS.md`](AGENTS.md)** antes de escribir cualquier cosa. Dos reglas que se olvidan
siempre: **las alertas las decide el motor de reglas, nunca el LLM**, y **`src/types/supabase.ts`
no se edita a mano**.

## Documentación

| Documento | Para qué |
|---|---|
| [`docs/acta-vesta-care.md`](docs/acta-vesta-care.md) | **Producto.** Idea, módulos, arquitectura, plan de 8 h, demo |
| [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) | **Datos.** El esquema de Supabase explicado: tablas, funciones, flujo de alerta |
| [`docs/ACCESSIBILITY.md`](docs/ACCESSIBILITY.md) | Diseño para personas mayores. **Vinculante** |
| [`docs/OPEN-ISSUES.md`](docs/OPEN-ISSUES.md) | Bloqueantes, decisiones pendientes y restricciones de PWA |
| [`docs/archive/v3/`](docs/archive/v3/) | Spec v3 (Flask + SQLite). **Descartada**, solo consulta |
| [`legacy/README.md`](legacy/README.md) | Código heredado y qué se puede reutilizar |

## Arranque

```bash
npm install
cp .env.example .env.local   # claves de Supabase, ids del demo y del LLM
npm run dev                  # http://localhost:3000
```

| Ruta | Qué es |
|---|---|
| `/` | PWA de Don Luis (bienvenida → onboarding → inicio) |
| `/demo` | Panel de escenarios para operar el demo (desktop) |
| `/demo/whatsapp` | WhatsApp **simulado** del contacto |
| `/c/[token]` | Vista de solo lectura del contacto |

Regenerar tipos tras cambiar el esquema:

```bash
npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_ID" > src/types/supabase.ts
```

## Advertencia

Herramienta de **autogestión**, no dispositivo médico. No diagnostica, no modifica dosis y siempre
deriva a un profesional o al 131. Los datos de demo y los dispositivos son ficticios.
