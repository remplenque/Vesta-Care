# Vesta

Asistente centralizado para personas mayores que viven solas. Conecta el reloj, el pastillero, la
agenda de citas y BondUP. Conversa por voz o chat, y avisa a la familia por WhatsApp cuando algo
importante no tiene respuesta.

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
| [`docs/03-MODULE-core.md`](docs/03-MODULE-core.md) | Backend: agenda, reglas, alertas |
| [`docs/04-MODULE-assistant.md`](docs/04-MODULE-assistant.md) | Asistente de voz y chat |
| [`docs/05-MODULE-web.md`](docs/05-MODULE-web.md) | Vistas de la persona, la familia y el operador |
| [`docs/06-MODULE-notify.md`](docs/06-MODULE-notify.md) | WhatsApp y Telegram |
| [`docs/07-BUILD-PLAN.md`](docs/07-BUILD-PLAN.md) | Prioridades, cronograma, guion del demo |
| [`docs/archive/eleam/`](docs/archive/eleam/) | Versión anterior (centro de monitoreo ELEAM), descartada |

## Arranque rápido

```bash
cp .env.example .env     # completar claves
./scripts/dev.sh         # core en :8000, web en :5173
```

## Advertencia

Vesta es un asistente de recordatorio y compañía, **no un dispositivo médico** y no diagnostica.
Registra que se abrió un compartimento, no que se tomó un medicamento. Todos los datos son
sintéticos.
