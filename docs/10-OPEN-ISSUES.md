# 10 · Pendientes y contradicciones

> Resultado de cruzar el acta original, la especificación v3 (`00`–`09`) y el código de
> `legacy/Mateo-main/`. **Nada de esto cambia el contrato por sí solo**: cada punto abierto lo
> decide el equipo y, si toca `02-DATA-CONTRACTS.md`, se edita ahí en el mismo commit.
>
> Recordatorio: el contrato se congeló a las 10:00. Después solo se aceptan **campos opcionales
> nuevos** (`09-BUILD-PLAN.md` §4).

## 1. Acta original vs. especificación v3

El acta (`archive/acta-vesta-care.md`, 10:54) fue reemplazada por v3 (11:09). Ante diferencias,
gana v3.

| Tema | Acta | v3 (vigente) |
|---|---|---|
| Stack | Next.js + Supabase | Vite + React (PWA) · Flask + SQLite |
| Capa LLM | Vercel AI SDK, multi-proveedor | Pydantic AI + Gemini, heredado de Mateo-main |
| Voz | Web Speech API (STT y TTS) | `SpeechRecognition` / `MediaRecorder` → Gemini · ElevenLabs con respaldo `speechSynthesis` |
| Asistente | Mateo | Mateo **o** Emilia, a elección |
| Alertas críticas | Motor de reglas con umbrales | **Fuera.** Vesta no interpreta métricas (`04` §6); solo rango de referencia neutro |
| Aviso a contactos | WhatsApp simulado | `avisar_contacto`, P2, solo prepara el mensaje |
| Vista del familiar | `/c/[token]`, solo lectura | Fuera de alcance (`00` §6) |
| Ficha médica PDF | Extrae umbrales y medicamentos | No está |
| Dispositivos | Todos simulados, `ModuleManifest` | `HealthSource` con cuatro vías; la foto es la principal; `fuente: "simulado"` visible |
| Agenda y comunidad | No existían | Módulos completos (`05`, `06`) |
| Paciente demo | Don Luis, 78, hipertenso y diabético | Juanito, 78, Ñuñoa |
| Pitch | 3 min, demo de 90 s | Guion de demo de 2 min (`09` §5) |

**Del acta que sigue sirviendo** (no contradice v3):

- **Derivar al 131 (SAMU)** ante un síntoma grave. Ya incorporado en
  `server/agent/prompts/asistente.md`.
- **Cierre del pitch:** modelo de negocio (B2C, isapres, cajas de compensación) y privacidad de
  datos de salud (**Ley 21.719**). v3 no cubre ninguno de los dos y el jurado los va a preguntar.
- **Perfil clínico del demo:** hipertensión + diabetes tipo 2. Calza con sembrar Losartán y
  Metformina, como ya muestra `04` §2.1.
- **Pendiente heredado:** definir quién presenta y quién opera el demo (`09` §4.4).

## 2. Contradicciones dentro de v3

| # | Dónde | Problema | Propuesta | Estado |
|---|---|---|---|---|
| 1 | `02` §4 `origen`, §5 `fuente` | El valor `"mateo"` es el nombre escrito a mano dentro del contrato. Con Emilia activa, el dato dice "mateo" | Contrato congelado: conservar el literal, documentarlo como "vía asistente" sin importar la persona, y **no mostrarlo nunca en la interfaz** | Abierto |
| 2 | `02` §11 vs `06` §4.3 | El service worker manda `origen: "notificacion"` al registrar la toma, pero el body del contrato es solo `{ "estado" }` | Agregar `origen` **opcional** al body de `/intake` (permitido post-congelación) | Abierto |
| 3 | `02` §12 vs `07` §8 | El contrato lista 11 tools; el backend pide "las 10" | Son 10 MVP + `avisar_contacto` (P2). El mínimo de aceptación es 6 (`03` §9) | Abierto |
| 4 | `02` §9–10 vs `06` §4.6 | El seed usa `tratamiento: "usted"` y la agenda dice "Hora de **su** Losartán", pero los ejemplos del contrato dicen "Hora de **tu** Losartán" | El servidor redacta `titulo` y `cuerpo` del recordatorio según `tratamiento`. Nunca fijo | Abierto |
| 5 | `09` §1 vs `04` §7, `05` §4, `01` §7 | La cola de escrituras offline es P2, pero "Ya me lo tomé" debe funcionar sin red y el plan B del demo es el modo avión | Subir a **P1 solo la cola de `registrar_toma`**. El resto queda P2 | Abierto |
| 6 | `05` §2–3, `02` §6 | La tarjeta dice "Sábado 4, 15:00", pero el 4 de octubre de 2026 es **domingo**. Además, `act_12` inicia `18:00Z` = **15:00** en Chile (UTC−3), y el flujo de `05` §2 avisa "en una hora" a las 17:00 | Sembrar el taller el sábado 3 (`2026-10-03T18:00:00Z`) con aviso a las 14:00. Es justo el error UTC/local que `AGENTS.md` §6 advierte | Abierto |
| 7 | `00` §9 | El glosario define "Recordatorio" como "notificación local programada", lo que contradice `01` §3: la web no puede programarlas | "Aviso que llega por dos caminos: alarma en pantalla y Web Push" | Abierto |
| 8 | `03` §9, `09` §4.7 | `grep -ri "mateo\|emilia" web/src` siempre encuentra los literales del contrato en `types.ts` | Usar `grep -rni "mateo\|emilia" web/src --exclude=types.ts` y, en el servidor, `--exclude=persona.py --exclude=models.py` | Aplicado en los `AGENTS.md` locales |
| 9 | `AGENTS.md` §4 vs `07` §2 | El árbol no tenía `persona.py`, `models.py`, `seed.py` ni `scripts/` | Árbol sincronizado | **Resuelto** |
| 10 | `.env.example` vs `01` §9 | `HEALTH_SOURCE` existe en `.env.example` pero no en la lista de variables de la arquitectura | La lista completa es `.env.example` | Abierto |
| 11 | `01` §6 | Pide "dejar la URL fija", pero `cloudflared tunnel --url` entrega una URL aleatoria en cada arranque. **La PWA instalada, el permiso de notificaciones y la suscripción push quedan atados al origen**: si cambia la URL, hay que reinstalar, re-aceptar y re-suscribir | Túnel con nombre de Cloudflare (requiere cuenta y dominio) o dominio estático de ngrok. Si no, **no reiniciar el túnel** después de instalar en el teléfono del demo | Abierto |
| 12 | `legacy/` vs `.env.example` | El agente legacy usa `GoogleModel(...)` sin clave explícita y su README pide `GOOGLE_API_KEY`; `.env.example` define `GEMINI_API_KEY` | Al migrar, crear el provider pasando la clave explícitamente desde `GEMINI_API_KEY` | Abierto |
| 13 | Acta vs `09` §5 | El acta habla de un pitch de 3 min con demo; `09` tiene solo el guion de 2 min del demo | Confirmar con las bases del evento cuánto dura el pitch completo | Abierto |
