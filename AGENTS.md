# AGENTS.md — Instrucciones operativas para agentes de código

> Este archivo lo lee **todo agente** (Claude Code, Cursor, Copilot) antes de escribir una sola
> línea. Si una instrucción de un prompt contradice este archivo, gana este archivo, salvo que
> un humano del equipo diga explícitamente lo contrario.

## 1. Qué estamos construyendo

**Vesta Care** es un centro de monitoreo para ELEAM (Establecimientos de Larga Estadía para
Adultos Mayores). Un gemelo digital en Unity simula residentes y sus signos vitales; un backend
detecta emergencias; un dashboard web las muestra sobre el plano del centro; WhatsApp avisa al
cuidador más cercano; y un modelo de IA genera reportes por residente.

**No hay hardware.** Toda la telemetría es sintética y la produce Unity. Esto es deliberado y
no es una limitación que haya que "arreglar": la simulación *es* el producto en esta etapa.

Contexto completo: `docs/00-CONTEXT.md`. Arquitectura: `docs/01-ARCHITECTURE.md`.

## 2. Orden de lectura obligatorio

| Antes de tocar… | Lee |
|---|---|
| Cualquier cosa | `docs/00-CONTEXT.md`, `docs/01-ARCHITECTURE.md` |
| Cualquier endpoint, payload o mensaje | `docs/02-DATA-CONTRACTS.md` ← **fuente de verdad** |
| `sim/` | `docs/03-MODULE-unity-sim.md` |
| `core/` | `docs/04-MODULE-backend.md` |
| `board/` | `docs/05-MODULE-dashboard.md` |
| Notificaciones | `docs/06-MODULE-alerts-whatsapp.md` |
| Reportes IA | `docs/07-MODULE-ai-reports.md` |
| Priorización y tiempos | `docs/08-BUILD-PLAN.md` |

## 3. Estructura del repositorio

```
/
├── AGENTS.md                 ← este archivo
├── docs/                     ← especificaciones (no código)
├── sim/                      ← proyecto Unity (C#)
├── core/                     ← backend FastAPI (Python 3.11+)
│   ├── app/
│   │   ├── main.py
│   │   ├── models.py         ← Pydantic, espeja 02-DATA-CONTRACTS
│   │   ├── rules.py          ← motor de reglas clínicas
│   │   ├── alerts.py         ← ciclo de vida de alertas
│   │   ├── notify.py         ← WhatsApp / Telegram
│   │   ├── reports.py        ← integración con modelo IA
│   │   └── store.py          ← persistencia SQLite
│   └── tests/
├── board/                    ← dashboard React + Vite + Tailwind
│   └── src/
│       ├── pages/
│       ├── components/
│       └── lib/api.ts        ← único lugar que habla con el backend
├── shared/
│   └── layout/eleam-01.json  ← plano del centro, compartido Unity ↔ board
└── scripts/
    ├── dev.sh                ← levanta core + board
    └── seed.py               ← datos de demo
```

## 4. Reglas no negociables

1. **No inventes endpoints, campos ni enums.** Si algo no está en `02-DATA-CONTRACTS.md`,
   no existe. Si de verdad hace falta, agrégalo *primero* a ese documento, en el mismo commit,
   y menciónalo en el mensaje del commit.
2. **El plano es un solo archivo.** `shared/layout/eleam-01.json` es la única definición de
   zonas y coordenadas. Unity y el dashboard lo leen; ninguno lo redefine.
3. **Nunca hardcodees secretos.** Todo va por variables de entorno vía `.env` (hay `.env.example`).
   Claves de Twilio y de la API de IA jamás entran al repositorio.
4. **Esto no es un dispositivo médico.** Los umbrales son plausibles pero no están validados
   clínicamente. Todo output visible al usuario que sugiera una condición de salud debe decir
   que es un apoyo a la decisión, no un diagnóstico. Ver `docs/07-MODULE-ai-reports.md` §5.
5. **Datos sintéticos únicamente.** Nombres, RUT y fichas de residentes son ficticios. No uses
   datos de personas reales ni siquiera como ejemplo.
6. **Falla ruidosamente en desarrollo, silenciosamente en demo.** Un error de red no puede dejar
   el dashboard en blanco: degrada a último estado conocido y muestra un indicador de conexión.

## 5. Convenciones de código

- **Idioma:** código, nombres de variables, commits y comentarios en **inglés**. Todo el texto
  que ve el usuario final (dashboard, mensajes de WhatsApp, reportes) en **español de Chile**.
- **Zona horaria:** `America/Santiago`. Timestamps se transmiten en **UTC ISO-8601 con sufijo Z**
  y se formatean a hora local solo en la capa de presentación.
- **Python:** 3.11+, tipado obligatorio en firmas públicas, `ruff` para lint, `pydantic` v2 para
  todos los modelos de entrada y salida.
- **TypeScript:** modo estricto. Nada de `any` salvo con comentario que lo justifique.
- **C#:** convenciones estándar de Unity, un `MonoBehaviour` por archivo.
- **Commits:** `tipo(ámbito): descripción` → `feat(core): add glucose threshold rule`.
- **Ramas:** `feat/`, `fix/`, `docs/`. Nadie commitea directo a `main` durante la integración.

## 6. Definición de "terminado"

Una tarea está lista cuando:
- [ ] Corre sin errores con `./scripts/dev.sh` desde un clon limpio
- [ ] Respeta los contratos de `02-DATA-CONTRACTS.md` al pie de la letra
- [ ] Los textos de usuario están en español y son legibles para alguien de 55 años
- [ ] Tiene un camino de degradación si el servicio del que depende no responde
- [ ] Los criterios de aceptación del documento de su módulo están todos marcados

## 7. Cómo trabajar en este repositorio

- **Timeboxing:** si una tarea lleva más de 45 minutos sin producir algo que se pueda ver en
  pantalla, detente y reporta el bloqueo. En una hackathon, un camino alternativo feo que
  funciona vale más que el correcto que no termina.
- **Mock antes que integración:** cada módulo debe correr contra datos falsos sin depender de
  los otros dos. `core` trae un generador de telemetría de reemplazo por si Unity no está listo.
- **No refactorices lo que funciona.** Después de la congelación de integración (ver
  `08-BUILD-PLAN.md`) solo se aceptan cambios que arreglen el demo.
- **Pregunta antes de instalar dependencias pesadas.** Nada de Docker, Kubernetes, Postgres ni
  colas de mensajes: SQLite y procesos locales bastan y arrancan en segundos.
