# Vesta Care

Centro de monitoreo para ELEAM (Establecimientos de Larga Estadía para Adultos Mayores).
Gemelo digital en Unity + detección de emergencias + dashboard + alertas por WhatsApp + reportes con IA.

**Hack4Seniors UDD · 1 de octubre de 2026**
Equipo: Vicente Rodríguez · Bato · Luchoo

> *Que la llama no se apague.*

## Para agentes de código

Lee **[`AGENTS.md`](AGENTS.md)** antes de escribir cualquier cosa. Es obligatorio.

## Documentación

| Documento | Para qué |
|---|---|
| [`docs/00-CONTEXT.md`](docs/00-CONTEXT.md) | Problema, usuarios, alcance, glosario |
| [`docs/01-ARCHITECTURE.md`](docs/01-ARCHITECTURE.md) | Componentes, flujos, decisiones técnicas |
| [`docs/02-DATA-CONTRACTS.md`](docs/02-DATA-CONTRACTS.md) | **Fuente de verdad.** Schemas y endpoints |
| [`docs/03-MODULE-unity-sim.md`](docs/03-MODULE-unity-sim.md) | Simulador Unity |
| [`docs/04-MODULE-backend.md`](docs/04-MODULE-backend.md) | Backend y motor de reglas |
| [`docs/05-MODULE-dashboard.md`](docs/05-MODULE-dashboard.md) | Dashboard React |
| [`docs/06-MODULE-alerts-whatsapp.md`](docs/06-MODULE-alerts-whatsapp.md) | Notificaciones |
| [`docs/07-MODULE-ai-reports.md`](docs/07-MODULE-ai-reports.md) | Reportes con IA |
| [`docs/08-BUILD-PLAN.md`](docs/08-BUILD-PLAN.md) | Prioridades, cronograma, guion del demo |

## Arranque rápido

```bash
cp .env.example .env     # completar claves
./scripts/dev.sh         # core en :8000, board en :5173
```

Unity se abre desde `sim/` y apunta a `http://localhost:8000`.

## Advertencia

Sistema de **apoyo a la decisión**, no dispositivo médico. Todos los datos son sintéticos.
Los umbrales son plausibles pero no están validados clínicamente.
