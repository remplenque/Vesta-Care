# AGENTS.md — Instrucciones operativas para agentes de código

> Lo lee **todo agente** (Claude Code, Cursor, Copilot) antes de escribir una línea. Si un prompt
> contradice este archivo, gana este archivo, salvo que un humano del equipo diga lo contrario.

## 1. Qué estamos construyendo

**Vesta Care** es una **PWA** para que una persona mayor se gestione a sí misma: sus
medicamentos, su salud, su agenda y su vida social. La puerta de entrada no es un menú: es el
**asistente**, que la opera por ella hablando.

```
El usuario le habla al asistente  →  usa herramientas  →  cambia el estado de la app
   "recuérdame la pastilla            agregar_medicamento()     aparece en el pastillero
    de la presión a las 8"            crear_recordatorio()      y llega una notificación
```

**El asistente es el producto, no un chatbot pegado al costado.** Todo lo que el usuario pueda
hacer tocando pantallas debe poder pedirlo hablando. Y al revés: todo lo que haga el asistente
tiene que quedar visible en la pantalla del módulo correspondiente.

**La tesis:** hoy esto requeriría cinco aplicaciones distintas. Vesta las junta en una, con voz.

Contexto completo: `docs/00-CONTEXT.md`. Arquitectura: `docs/01-ARCHITECTURE.md`.

## 2. El asistente tiene dos nombres: Mateo y Emilia

El usuario elige con quién quiere hablar al entrar por primera vez. **No son dos personajes
distintos: son la misma persona con dos presentaciones.**

| | Mateo | Emilia |
|---|---|---|
| Relación | Sobrino | Sobrina |
| Edad | 15 | 15 |
| Voz | Masculina (`ELEVENLABS_VOICE_ID_MATEO`) | Femenina (`ELEVENLABS_VOICE_ID_EMILIA`) |
| Personalidad | **Idéntica** | **Idéntica** |

**Reglas duras para el código:**

1. **Nunca hardcodees "Mateo" en ningún string.** Siempre `{agente_nombre}`, desde el perfil.
   Un "Hola, soy Mateo" fijo en el HTML es un bug.
2. **El género gramatical se resuelve con una variable**, no con condicionales desperdigados.
   `agente.articulo` → *"tu sobrino"* / *"tu sobrina"*. Centralizado en un solo lugar.
3. **El prompt del sistema es uno solo**, parametrizado. No hay `mateo.md` y `emilia.md`:
   hay `asistente.md` con `{agente_nombre}` y `{agente_genero}`.
4. **Los textos de la interfaz se escriben neutros** cuando se pueda: *"Tu asistente"*,
   *"Volver al chat"*, en vez de forzar el nombre en cada botón.
5. Se puede cambiar de asistente desde el perfil, en cualquier momento, sin perder datos.

Detalle completo en `docs/03-MODULE-ASISTENTE.md`.

## 3. Qué se reutiliza del repositorio Mateo

El agente **ya existe**. Viene de `Mateo-main` (hackathon de Agentes IA, octubre 2025).

El código original está descomprimido en **`legacy/Mateo-main/`** (rutas de abajo relativas a
esa carpeta). Mapa archivo por archivo, y bugs conocidos, en `legacy/README.md`.

| Se conserva | Dónde estaba | Qué cambia |
|---|---|---|
| Agente Pydantic AI + Gemini | `Backend/app.py` | Deja de ser solo conversacional: gana **tools** |
| Voz con ElevenLabs | `call_elevenlabs()` | Dos voces en vez de una |
| Backend Flask + CORS | `Backend/app.py` | Se extiende y además **sirve la PWA** |
| Reporte de conversación | `ConversationReport` | Pasa a ser el resumen semanal (P2) |
| Persona del agente | `Agente/instruccion.txt` | Se amplía y se parametriza por nombre y género |
| **Plantilla de chat** | `Frontend/.../chat.html` | Referencia de UI; se reescribe como componente |

| Se descarta | Por qué |
|---|---|
| Django como servidor | Flask ya está y sirve la PWA sin agregar un segundo proceso |
| Bucle de voz por consola | El micrófono ahora es del navegador |
| SendGrid | Reemplazado por notificaciones; el correo a la familia queda P2 |

> **No borres el código viejo.** Muévelo a `legacy/`. En una hackathon, un archivo que ya
> funciona vale más que uno elegante.

## 4. Estructura del repositorio

Cada carpeta de trabajo tiene su propio `AGENTS.md` con dueño, prioridades, archivos → sección
de la especificación y criterios de aceptación. **Léelo antes de tocar esa carpeta.**

```
/
├── AGENTS.md                  ← este archivo
├── .env.example               ← copiar a .env (el .env nunca se commitea)
├── docs/                      ← especificaciones 00–09
│   ├── 10-OPEN-ISSUES.md      ← contradicciones entre docs y decisiones pendientes
│   └── archive/               ← acta original (superada por esta versión)
├── scripts/
│   ├── dev.sh                 ← Flask :5000 + Vite :5173
│   └── tunnel.sh              ← URL HTTPS para abrir desde el teléfono
├── web/                       ← PWA (Vite + React + TypeScript) · web/AGENTS.md
│   ├── public/
│   │   ├── manifest.webmanifest
│   │   └── icons/             ← 192, 512, maskable
│   ├── src/
│   │   ├── routes/
│   │   │   ├── Asistente.tsx  ← pantalla de entrada
│   │   │   ├── Salud.tsx
│   │   │   ├── Agenda.tsx
│   │   │   └── Comunidad.tsx
│   │   ├── lib/
│   │   │   ├── api.ts         ← único lugar que habla con el servidor
│   │   │   ├── types.ts       ← espeja 02-DATA-CONTRACTS.md
│   │   │   ├── db.ts          ← IndexedDB, copia offline
│   │   │   ├── push.ts        ← suscripción Web Push
│   │   │   └── alarma.ts      ← ★ respaldo en primer plano (ver 06)
│   │   ├── sw.ts              ← service worker
│   │   └── theme.ts           ← tokens de accesibilidad (ver 08)
│   └── vite.config.ts         ← vite-plugin-pwa
├── server/                    ← Flask (heredado de Mateo-main) · server/AGENTS.md
│   ├── app.py                 ← rutas + sirve web/dist
│   ├── agent/
│   │   ├── asistente.py
│   │   ├── persona.py         ← ★ Mateo / Emilia: único lugar con los nombres
│   │   ├── tools.py           ← ★ las herramientas
│   │   └── prompts/asistente.md
│   ├── modules/
│   │   ├── health.py
│   │   ├── community.py
│   │   └── agenda.py
│   ├── scheduler.py           ← ★ APScheduler: dispara los recordatorios
│   ├── push.py                ← Web Push (VAPID)
│   ├── store.py               ← SQLite
│   ├── models.py              ← Pydantic, espeja 02-DATA-CONTRACTS.md
│   ├── voice.py               ← ElevenLabs, dos voces
│   └── seed.py                ← carga shared/seed/*.json
├── shared/seed/               ← datos de demo · shared/seed/README.md
└── legacy/Mateo-main/         ← código original, solo lectura · legacy/README.md
```

## 5. Reglas no negociables

1. **Todo módulo nuevo expone tools al asistente.** Un módulo que solo tiene pantalla no está
   terminado.
2. **No inventes endpoints, campos ni tools.** Si no está en `docs/02-DATA-CONTRACTS.md`, no
   existe. Agrégalo primero ahí, en el mismo commit.
3. **Ningún string con "Mateo" o "Emilia" escrito a mano.** Ver §2. Únicas excepciones:
   `server/agent/persona.py` y los literales `"mateo" | "emilia"` del contrato en
   `web/src/lib/types.ts` y `server/models.py`.
4. **La accesibilidad es vinculante desde el primer componente.** `docs/08-ACCESSIBILITY.md`.
   Texto chico, contraste bajo o un botón de 32 px son **bugs**.
5. **El recordatorio tiene dos caminos y el de respaldo se construye primero.**
   `docs/06-MODULE-AGENDA.md` §4. Un recordatorio que solo funciona con push es un recordatorio
   que falla en el demo.
6. **Esto no es un dispositivo médico.** Vesta recuerda, registra y acompaña. No diagnostica.
7. **Offline primero.** El pastillero y la agenda del día se leen desde IndexedDB y funcionan sin
   red. La red mejora la experiencia, no la habilita.
8. **Nada de secretos en el repositorio.** Todo por `.env`.

## 6. Convenciones

- **Idioma:** código, variables y commits en **inglés**. Texto visible, prompts y nombres de
  tools en **español de Chile**.
  (Las tools en español a propósito: el modelo razona mejor sobre `agendar_hora_medica` cuando
  el usuario habla en castellano.)
- **Zona horaria:** `America/Santiago`. Se transmite UTC ISO-8601 con `Z`; se formatea local al
  mostrar. **El scheduler del servidor trabaja en hora local de Chile** — es el único lugar donde
  eso aplica, y está documentado en `07-MODULE-BACKEND.md` §5.
- **Python** 3.11+, tipado en firmas públicas, Pydantic v2. **TypeScript** estricto.
- **Commits:** `tipo(ámbito): descripción` → `feat(health): add pillbox tool`.

## 7. Definición de "terminado"

- [ ] Corre desde un clon limpio con `./scripts/dev.sh`
- [ ] Respeta `02-DATA-CONTRACTS.md` al pie de la letra
- [ ] **Tiene al menos una tool registrada y probada desde el chat**
- [ ] Cumple los mínimos de `08-ACCESSIBILITY.md`
- [ ] Funciona sin red o degrada con un mensaje claro
- [ ] No contiene el nombre del asistente escrito a mano
- [ ] Los criterios de aceptación de su documento están marcados

## 8. Cómo trabajar acá

- **Timebox de 45 minutos.** Sin resultado visible en pantalla, se avisa y se busca otro camino.
- **Mock antes que integración.** Cada módulo corre con datos sembrados.
- **No instales nada pesado.** Sin Docker, sin Postgres, sin colas.
- **Después de la congelación (ver `09-BUILD-PLAN.md`), solo arreglos que salven el demo.**
