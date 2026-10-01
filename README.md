# Vesta Care

Una sola aplicación para que una persona mayor se gestione a sí misma: sus medicamentos, su
salud, su agenda y su vida social. No se navega — **se le habla**.

**PWA instalable · Hack4Seniors UDD · 1 de octubre de 2026**
Vicente Rodríguez · Baptiste Vial · Luis-Felipe Cáceres

---

```
         MATEO  /  EMILIA   ← el asistente, pantalla de entrada
                 │             (misma persona, dos voces: el usuario elige)
    ┌────────────┼────────────┐
    ▼            ▼            ▼
 Mi salud    Mi agenda    Comunidad
 pastillero  calendario   actividades
 métricas    recordatorios inscripciones
```

**La tesis:** hoy esto requeriría cinco aplicaciones distintas. Cada una con su login, su
interfaz y su forma de confundir. Vesta las junta en una, con voz.

## Para agentes de código

Lee **[`AGENTS.md`](AGENTS.md)** antes de escribir cualquier cosa. Es obligatorio.
Dos reglas que se olvidan siempre: **ningún string con "Mateo" o "Emilia" escrito a mano**, y
**la alarma en primer plano se construye antes que la Web Push**.

## Documentación

| Documento | Para qué |
|---|---|
| [`docs/00-CONTEXT.md`](docs/00-CONTEXT.md) | Problema, usuarios, módulos, alcance |
| [`docs/01-ARCHITECTURE.md`](docs/01-ARCHITECTURE.md) | Componentes, flujos, y qué cuesta ser PWA |
| [`docs/02-DATA-CONTRACTS.md`](docs/02-DATA-CONTRACTS.md) | **Fuente de verdad.** Schemas, endpoints y tools |
| [`docs/03-MODULE-ASISTENTE.md`](docs/03-MODULE-ASISTENTE.md) | Mateo y Emilia: persona, prompt, voz, pantalla |
| [`docs/04-MODULE-HEALTH.md`](docs/04-MODULE-HEALTH.md) | Pastillero y las cuatro vías de entrada de datos |
| [`docs/05-MODULE-COMMUNITY.md`](docs/05-MODULE-COMMUNITY.md) | Actividades e inscripciones |
| [`docs/06-MODULE-AGENDA.md`](docs/06-MODULE-AGENDA.md) | Calendario y **recordatorios: los dos caminos** |
| [`docs/07-MODULE-BACKEND.md`](docs/07-MODULE-BACKEND.md) | Flask, scheduler, push y migración desde Mateo-main |
| [`docs/08-ACCESSIBILITY.md`](docs/08-ACCESSIBILITY.md) | Diseño para personas mayores. **Vinculante** |
| [`docs/09-BUILD-PLAN.md`](docs/09-BUILD-PLAN.md) | Prioridades, cronograma, guion del demo |
| [`docs/10-OPEN-ISSUES.md`](docs/10-OPEN-ISSUES.md) | Contradicciones entre documentos y decisiones pendientes |
| [`docs/archive/`](docs/archive/) | Acta original. **Histórica**: la superó esta especificación |

## Dónde está cada cosa

| Carpeta | Qué hay | Léase primero |
|---|---|---|
| `server/` | Flask, agente, tools, scheduler, push | [`server/AGENTS.md`](server/AGENTS.md) |
| `web/` | PWA: pantallas, alarma, service worker, tema | [`web/AGENTS.md`](web/AGENTS.md) |
| `shared/seed/` | Datos de demo | [`shared/seed/README.md`](shared/seed/README.md) |
| `scripts/` | `dev.sh` y `tunnel.sh` | — |
| `legacy/Mateo-main/` | Código del proyecto Mateo, solo lectura | [`legacy/README.md`](legacy/README.md) |

## Lo que hay que saber antes de empezar

1. **Una PWA no puede programar notificaciones locales.** La API se retiró. Los recordatorios
   van por dos caminos: alarma en pantalla (sin red, sin permisos) y Web Push desde el servidor
   (con la app cerrada, pero con internet). Ver `06-MODULE-AGENDA.md` §4.
2. **El reloj inteligente es una opción, no el camino.** La mayoría del público no tiene uno. La
   vía interesante es sacarle una foto al tensiómetro que ya está en el velador, y que Gemini lea
   el número. Ver `04-MODULE-HEALTH.md` §4.
3. **El demo es en Android con Chrome.** iOS limita push, acciones en notificaciones y
   reconocimiento de voz.

## Continuidad con Mateo

El agente viene del proyecto **Mateo** (primera hackathon de Agentes IA en Chile, octubre 2025):
un "sobrino digital" de 15 años para acompañamiento y estimulación cognitiva, con Pydantic AI,
Gemini y ElevenLabs. Acá conserva su personalidad, **gana una hermana** (Emilia) y, sobre todo,
**gana herramientas**: ahora además de conversar, hace cosas. Ver `AGENTS.md` §3. El código
original está en `legacy/Mateo-main/`, con un mapa de qué va a dónde en `legacy/README.md`.

## Arranque rápido

```bash
cp .env.example .env     # claves, VAPID y los dos voice_id
./scripts/dev.sh         # Flask en :5000, Vite en :5173
./scripts/tunnel.sh      # URL HTTPS para abrir desde el teléfono
```

## Advertencia

Herramienta de **autogestión**, no dispositivo médico. No diagnostica, no interpreta síntomas y
no recomienda medicamentos. Los datos de demo son ficticios.
