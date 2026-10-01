# AGENTS.md — Instrucciones operativas para agentes de código

> Lo lee **todo agente** (Claude Code, Cursor, Copilot) antes de escribir una línea. Si un prompt
> contradice este archivo, gana este archivo, salvo que un humano del equipo diga lo contrario.

## 1. Qué estamos construyendo

**Vesta Care** centraliza el monitoreo de salud de adultos mayores que **viven solos o en su
casa**. Cada persona tiene su propia PWA con su información de cuidado, y ve si cumple sus
objetivos.

- **Mateo**, un agente, está al centro: analiza la información, da sugerencias y feedback, y
  explica las alertas.
- **Plataforma modular:** el usuario activa módulos según sus condiciones (pastillero, presión,
  frecuencia cardíaca, glucosa). **Todos los dispositivos son simulados.**
- **Alertas** al usuario y a sus contactos de emergencia: WhatsApp **simulado** + Web Push. El
  contacto tiene una vista web de solo lectura.
- **Umbrales personalizados** a partir de la ficha médica en PDF: Mateo extrae, el usuario confirma.
- **Independencia:** accesible pero no infantilizada. Referencia de UX: BondUp.

Fuentes de verdad, en este orden:

1. **Datos:** `src/types/supabase.ts` (generado) → explicado en `docs/DATA-MODEL.md`
2. **Producto:** `docs/acta-vesta-care.md`
3. **Interfaz:** `docs/ACCESSIBILITY.md`

## 2. Stack

| Capa | Decisión |
|---|---|
| App | PWA con **Next.js** |
| Datos | **Supabase**: Postgres, Auth, RLS, Realtime, Storage, funciones RPC |
| Agente | Vercel AI SDK, proveedor intercambiable por configuración (por definir: `docs/OPEN-ISSUES.md` #4) |
| Voz | Web Speech API (STT y TTS en el navegador) |
| Hardware | Ninguno. Simulador + panel de escenarios |

```
Simulador ──► ingest_reading / ingest_bp ──► readings
                        │
                        ▼
              evaluate_level (umbrales de user_modules) ──► alerts
                                                              │
                     ┌────────────────────────┬───────────────┤
                     ▼                        ▼               ▼
          outbound_messages ──►      Web Push al usuario    Mateo redacta
          /demo/whatsapp                                    alerts.explanation
                                         Realtime ──► PWA del usuario y vista /c/[token]
```

## 3. Reglas no negociables

1. **Las alertas las decide el motor de reglas determinista, nunca el LLM.** Mateo explica,
   sugiere y redacta (acta §4).
2. **`src/types/supabase.ts` no se edita a mano.** Para cambiar el esquema: migración en Supabase,
   regenerar los tipos y commitear ambos con el código que los usa. Los comandos están en
   `docs/DATA-MODEL.md`.
3. **No inventes tablas, columnas ni funciones.** Si no está en los tipos generados, no existe.
4. **RLS por `user_id` en toda tabla del usuario.** La vista del contacto entra **solo** por
   `get_contact_view(p_token)`, nunca leyendo tablas directo.
5. **`SUPABASE_SERVICE_ROLE_KEY` solo en el servidor** (route handlers, Edge Functions). Nunca en
   código de cliente ni con prefijo `NEXT_PUBLIC_`. Nada de secretos en el repo: todo por `.env`.
6. **Esto no es un dispositivo médico.** Mateo no diagnostica, no modifica dosis y siempre deriva a
   un profesional o al **131**.
7. **Todo lo simulado se declara.** Las lecturas llevan su `source`, y WhatsApp es un simulador:
   **nunca se envía un mensaje real**.
8. **Nada extraído por el LLM se usa sin confirmación.** Ficha y umbrales pasan por
   `medical_records.confirmed` / `user_modules.confirmed`.
9. **Agregar un módulo = manifiesto (`modules.manifest`) + generador en el simulador.** El núcleo
   no se toca.
10. **La accesibilidad es vinculante desde el primer componente** (`docs/ACCESSIBILITY.md`). Texto
    chico, contraste bajo o un botón de 32 px son **bugs**.

## 4. Estructura del repositorio

```
/
├── AGENTS.md                  ← este archivo
├── README.md
├── docs/
│   ├── acta-vesta-care.md     ← ★ producto, plan de 8 h, demo
│   ├── DATA-MODEL.md          ← ★ el esquema explicado
│   ├── ACCESSIBILITY.md       ← reglas de interfaz (vinculante)
│   ├── OPEN-ISSUES.md         ← bloqueantes y decisiones pendientes
│   └── archive/v3/            ← spec v3 (Flask + SQLite), DESCARTADA. Solo consulta
├── src/
│   └── types/supabase.ts      ← ★ generado desde Supabase (Baptiste)
├── legacy/                    ← solo lectura · legacy/README.md
│   ├── Mateo-main/            ← agente Mateo original (Python, 2025)
│   └── vesta-v3/              ← scaffold de la v3 descartada
└── Mateo-main.zip             ← zip original del legacy
```

Rutas de la app que define el acta (por crear): PWA del usuario, vista del contacto `/c/[token]`,
simulador de WhatsApp `/demo/whatsapp` y panel de escenarios. La estructura del proyecto Next.js
la fija quien lo cree; actualizar este árbol en el mismo commit.

## 5. Convenciones

- **Idioma:** código, variables y commits en **inglés** (el esquema ya lo está). Texto visible y
  prompts en **español de Chile**.
- **Hora:** `timestamptz` en UTC; se muestra en `profiles.timezone`.
- **Commits:** `tipo(ámbito): descripción` → `feat(alerts): add critical bp scenario`.

## 6. Plan y equipo

Plan de 8 horas, checkpoints (h3 datos de punta a punta · h5 alerta crítica completa · h7
congelar) y guion del demo: `docs/acta-vesta-care.md` §8–9.

| Rol | Alcance |
|---|---|
| P1 · Back/Datos | Esquema, seed de Don Luis, simulador, ingesta, motor de reglas, alertas, Web Push, WhatsApp simulado |
| P2 · Front PWA | Next + PWA, onboarding, catálogo de módulos, dashboard, pantalla de alerta, vista del contacto |
| P3 · Mateo/IA | AI SDK, prompt, extracción de la ficha, tools, chat, voz, resumen diario |

Equipo: Vicente Rodríguez · Baptiste Vial · Luis-Felipe Cáceres. **Roles sin asignar**
(`docs/OPEN-ISSUES.md` #5).

## 7. Qué se reutiliza

| Fuente | Qué sirve |
|---|---|
| `legacy/Mateo-main/` | Personalidad de Mateo, salida estructurada, reporte de conversación como base del resumen diario, captura de voz en el navegador. Mapa en `legacy/README.md` |
| `docs/archive/v3/` | Restricciones de PWA (notificaciones, iOS, HTTPS) e ideas extra. Resumen en `docs/OPEN-ISSUES.md` §3–4 |
| `legacy/vesta-v3/` | Tokens de accesibilidad (`web/src/theme.ts`), prompt con la personalidad, script de túnel HTTPS |

> **No borres el código viejo.** Lo descartado se mueve a `legacy/` o `docs/archive/`.

## 8. Definición de "terminado"

- [ ] Usa solo tablas, columnas y funciones de `src/types/supabase.ts`
- [ ] Respeta RLS: funciona con la clave anónima y el usuario autenticado, no con la de servicio
- [ ] Cumple el checklist de `docs/ACCESSIBILITY.md` §8
- [ ] Lo simulado se ve como simulado
- [ ] Sin secretos en el código
- [ ] Sirve al recorrido del demo (acta §9). Si no, espera hasta después de h7
