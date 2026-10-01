# server/ — Flask, agente, scheduler

Complementa el `AGENTS.md` raíz; no lo reemplaza. Especificación: `docs/07-MODULE-BACKEND.md`.
**Dueño:** Vicente (`docs/09-BUILD-PLAN.md` §3).

## Orden de trabajo

1. **10:00–12:00 · P0:** `store.py`, `persona.py`, `modules/health.py` y las tres tools P0
   (`agregar_medicamento`, `listar_medicamentos`, `registrar_toma`)
2. **12:00–14:00:** pastillero completo, conectado a las tools, junto con `web/`
3. **14:00–15:00:** integración. Nadie trabaja en otra cosa
4. **15:00–16:00 · P1:** voz (`voice.py`, las dos voces) y foto del tensiómetro (`/v1/metrics/foto`)

Migración desde `legacy/Mateo-main/`: pasos y orden en `docs/07-MODULE-BACKEND.md` §1. Mapa
archivo por archivo y bugs que no hay que copiar: `legacy/README.md`.

## Archivos

| Archivo | Responsabilidad | Spec | Prioridad | Estado |
|---|---|---|---|---|
| `app.py` | Rutas HTTP + sirve `web/dist`. **Sin lógica de negocio** | `07` §4, §6 · `02` §11 | P0 | Pendiente |
| `agent/persona.py` | Mateo / Emilia. Único lugar con los nombres | `03` §2 · `02` §2 | P0 | **Listo** |
| `agent/prompts/asistente.md` | Prompt único, parametrizado | `03` §4–5 | P0 | **Listo** |
| `agent/asistente.py` | Agente Pydantic AI + historial global | `03` · `07` §4 | P0 | Pendiente |
| `agent/tools.py` | Las tools. **Sin lógica de negocio**: llaman a `modules/` | `02` §12 | P0 | Pendiente |
| `modules/health.py` | Pastillero, tomas, stock, métricas, lectura de foto | `04` | P0 | Pendiente |
| `modules/agenda.py` | Eventos y cálculo de recordatorios | `06` §1–3 | P1 | Pendiente |
| `modules/community.py` | Actividades e inscripciones | `05` | P1 | Pendiente |
| `models.py` | Pydantic v2, espejo exacto de `02` | `02` | P0 | Pendiente |
| `store.py` | SQLite, `vesta.db` | `07` §3 | P0 | Pendiente |
| `seed.py` | Carga `shared/seed/*.json` en un comando | `07` §8 | P0 | Pendiente |
| `scheduler.py` | APScheduler, **hora de Chile** | `07` §5 · `06` §4.3 | P1 | Pendiente |
| `push.py` | Web Push (VAPID) | `06` §4.3 | P1 | Pendiente |
| `voice.py` | ElevenLabs, `voice_id` desde `persona.py` | `03` §6 | P1 | Pendiente |
| `requirements.txt` | Base: `legacy/Mateo-main/requirements.txt` sin `django` ni `sendgrid`, más `apscheduler` y `pywebpush` | `legacy/README.md` | P0 | Pendiente |

## Reglas de esta carpeta

- **Una lógica, dos vías.** Endpoint REST y tool llaman a la misma función de `modules/`
  (`docs/01-ARCHITECTURE.md` §2). Si una validación aparece en `app.py` y en `tools.py`, está en el
  lugar equivocado.
- **Tools** (`02` §12): devuelven `dict` serializable; si falta un dato devuelven
  `{"falta": "<campo>"}`; nunca borran sin confirmación; toda tool que crea algo con hora devuelve
  los recordatorios a programar (`recolectar_acciones` los usa dos veces, `07` §4).
- **Hora:** se transmite UTC ISO-8601 con `Z`. `scheduler.py` es el **único** lugar que trabaja en
  `America/Santiago`. IDs de jobs determinísticos (`rem_med_03_0800`) con `replace_existing=True`.
- **Flask:** `use_reloader=False`, o el scheduler se duplica (`07` §5).
- **PWA:** `/sw.js` y `/manifest.webmanifest` desde la raíz; `sw.js` con
  `Service-Worker-Allowed: /` y `Cache-Control: no-cache` (`07` §6).
- **Degradación** (`07` §8): sin `GEMINI_API_KEY` arrancan los endpoints REST; sin
  `ELEVENLABS_API_KEY` se responde `audio_base64: null`. Nunca un 500 con mensaje técnico al
  usuario.
- **`.env` antes que `persona.py`:** `persona.py` lee los `voice_id` al importarse, así que
  `load_dotenv()` va antes de ese import.
- **Clave de Gemini:** pasarla explícita al provider desde `GEMINI_API_KEY`
  (`docs/10-OPEN-ISSUES.md` #12).
- **Timeouts** (`07` §7): transcripción 3 s · agente 4 s (8 s con tools) · foto 6 s · ElevenLabs 5 s.

## Verificación rápida

```bash
grep -rni "mateo\|emilia" server --include='*.py' --exclude=persona.py --exclude=models.py  # debe salir vacío
curl -s localhost:5000/health   # {"status":"ok","agente":…,"voz":…,"scheduler":…}
```

Criterios de aceptación completos: `07` §8, `03` §9, `04` §7, `05` §6, `06` §6.
