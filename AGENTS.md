# AGENTS.md — Instrucciones operativas para agentes de código

> Este archivo lo lee **todo agente** (Claude Code, Cursor, Copilot) antes de escribir una sola
> línea. Si una instrucción de un prompt contradice este archivo, gana este archivo, salvo que
> un humano del equipo diga explícitamente lo contrario.

## 1. Qué estamos construyendo

**Vesta** es un **asistente centralizado** para personas mayores que viven solas. Se conecta a
soluciones que ya existen: un reloj que detecta caídas, un pastillero, la agenda de citas y la app
de comunidad BondUP. Junta su información, conversa con la persona por voz o chat y avisa a la
familia por WhatsApp cuando algo importante no tiene respuesta. El objetivo es la independencia:
que la persona siga en su casa, decidiendo ella.

**No hay hardware ni integraciones reales hoy.** Los conectores están simulados y publican en el
mismo contrato que usaría la integración real.

El ELEAM y el pastillero como producto quedaron descartados; la versión ELEAM está archivada en
`docs/archive/eleam/` y **no se construye contra ella**.

## 2. Orden de lectura obligatorio

| Antes de tocar… | Lee |
|---|---|
| Cualquier cosa | `docs/00-CONTEXT.md`, `docs/01-ARCHITECTURE.md` |
| Cualquier endpoint, payload o mensaje | `docs/02-DATA-CONTRACTS.md` ← **fuente de verdad** |
| `core/` (agenda, reglas, alertas) | `docs/03-MODULE-core.md` |
| El asistente o el LLM | `docs/04-MODULE-assistant.md` |
| `web/` | `docs/05-MODULE-web.md` |
| WhatsApp o Telegram | `docs/06-MODULE-notify.md` |
| Priorización y tiempos | `docs/07-BUILD-PLAN.md` |

## 3. Estructura del repositorio

```
/
├── AGENTS.md
├── docs/                     ← especificaciones; docs/archive/ es historia, no spec
├── core/                     ← FastAPI (Python 3.11+)
│   ├── app/
│   │   ├── main.py
│   │   ├── models.py         ← Pydantic, espeja 02-DATA-CONTRACTS
│   │   ├── agenda.py         ← recordatorios y escalamiento (determinista)
│   │   ├── rules.py          ← evento → check-in o alerta
│   │   ├── alerts.py         ← ciclo de vida de alertas
│   │   ├── assistant.py      ← filtro determinista + LLM de solo lectura
│   │   ├── notify.py         ← WhatsApp / Telegram / log
│   │   ├── demo.py           ← semilla, escenarios, reset
│   │   ├── store.py          ← SQLite
│   │   └── prompts/
│   └── tests/
├── web/                      ← React + Vite + Tailwind
│   └── src/
│       ├── pages/            ← Home (/), Family (/familia), Alert (/a/:id), Sim (/sim)
│       ├── components/
│       └── lib/api.ts        ← único lugar que habla con el backend
└── scripts/
    └── dev.sh                ← levanta core + web
```

## 4. Reglas no negociables

1. **No inventes endpoints, campos ni enums.** Si algo no está en `02-DATA-CONTRACTS.md`, no
   existe. Si de verdad hace falta, agrégalo *primero* a ese documento, en el mismo commit, y
   menciónalo en el mensaje del commit.
2. **Recordatorios y escalamiento son deterministas.** Salen de la agenda cargada por la familia.
   El LLM nunca decide horarios, dosis ni medicamentos, y nunca abre, cierra ni modifica alertas o
   recordatorios: devuelve texto y banderas, y el core actúa.
3. **El LLM no da consejo clínico.** No sugiere tomar, saltar, duplicar ni cambiar un
   medicamento, y no interpreta síntomas. Ante esas preguntas deriva al médico y el core avisa a
   la familia. Las frases de emergencia se detectan **antes** del LLM con un filtro fijo.
4. **Se registra la apertura, no la ingesta.** Nunca escribas "tomó su pastilla" en ninguna
   interfaz; escribe "se abrió el compartimento" o "confirmó".
5. **WhatsApp con el mínimo de datos de salud.** Sin nombres de medicamentos, dosis ni
   diagnósticos en los mensajes. El detalle queda en el panel.
6. **Modo simulado por defecto.** Todo código que envíe mensajes reales tiene un canal `log` y
   respeta `NOTIFY_CHANNEL`.
7. **La persona controla su información.** Puede pausar el monitoreo. La familia no ve el
   contenido de las conversaciones. Sin cámaras, sin micrófono siempre encendido, sin
   grabaciones.
8. **No es un dispositivo médico.** No diagnostiques ni lo presentes como tal. El asistente se
   presenta como asistente, nunca como persona.
9. **Nunca hardcodees secretos.** Todo va por `.env` (existe `.env.example`).
10. **Datos sintéticos únicamente.** Personas, teléfonos y fichas son ficticios.
11. **Falla ruidosamente en desarrollo y silenciosamente en demo.** Un error de red no puede
    dejar una pantalla en blanco ni impedir que una alerta se abra y se reconozca.

## 5. Convenciones de código

- **Idioma:** código, nombres, commits y comentarios en **inglés**. Todo texto que ve el usuario
  final (web, WhatsApp, voz del asistente) en **español de Chile**, de "usted" por defecto y sin
  infantilizar.
- **Zona horaria:** `America/Santiago`. Los timestamps viajan en **UTC ISO-8601 con Z**; la hora
  local solo se usa en la presentación y en las horas de la agenda (`"09:00"`).
- **Python:** 3.11+, tipado en firmas públicas, `ruff`, `pydantic` v2.
- **TypeScript:** modo estricto. Nada de `any` salvo con un comentario que lo justifique.
- **Pruebas:** todo recordatorio y todo escalamiento tiene prueba automática (`03` §4).
- **Commits:** `tipo(ámbito): descripción` → `feat(core): add fall check-in timeout`.
- **Ramas:** `feat/`, `fix/`, `docs/`. Nadie commitea directo a `main` durante la integración.

## 6. Definición de "terminado"

- [ ] Corre sin errores con `./scripts/dev.sh` desde un clon limpio
- [ ] Respeta `02-DATA-CONTRACTS.md` al pie de la letra
- [ ] Los textos de usuario están en español, son legibles y nunca dicen "tomó"
- [ ] Tiene un camino de degradación si el servicio del que depende no responde
- [ ] Los criterios de aceptación del documento de su módulo están marcados

## 7. Cómo trabajar

- **Timeboxing:** si una tarea lleva más de 45 minutos sin producir algo visible, detente y
  reporta el bloqueo.
- **Mock antes que integración:** cada parte corre con datos falsos sin depender de las otras.
- **Si una decisión afecta la seguridad de la medicación**, explica el riesgo y pregunta antes de
  implementarla.
- **No refactorices lo que funciona** después de la congelación.
- **Pregunta antes de instalar dependencias pesadas.** Nada de Docker, Postgres ni colas.
