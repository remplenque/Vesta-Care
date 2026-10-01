# 01 · Arquitectura

## 1. Vista general

```
 CONECTORES (simulados hoy)                     INTERFACES DE LA PERSONA
 ┌──────────────┐                               ┌──────────────────────────┐
 │ Reloj        │─┐                             │ Asistente web (voz)      │
 │ Pastillero   │─┤ POST /v1/events             │  /  · tablet en la casa  │
 │ Agenda/citas │─┤ (formato común)             └────────────┬─────────────┘
 │ BondUP       │─┤                                          │ POST /v1/assistant/message
 │ Panel /sim   │─┘                                          │ POST /v1/checkins/{id}/answer
 └──────────────┘          │                                 ▼
                           ▼                    ┌──────────────────────────┐
 ┌──────────────────────────────────────────────┤ Chat (Telegram polling / │
 │                VESTA CORE (FastAPI)          │ WhatsApp webhook)        │
 │                                              └──────────────────────────┘
 │  ingest ──► agenda + reglas ──► check-ins ──► alertas ──► fan-out
 │                (determinista)                   │          ├──► WS /v1/stream
 │                                                 │          └──► notify (WhatsApp)
 │  assistant: LLM con estado de solo lectura ──► flags ──► reglas deciden
 │  store: SQLite
 └───────────────────────┬──────────────────────────────────────────────┘
                         │ WS + REST
                         ▼
 ┌─────────────────────────────────┐        ┌────────────────────────────┐
 │ Panel familia  /familia, /a/:id │        │ Celular del contacto       │
 │ Línea de tiempo, alertas, ACK   │        │ WhatsApp con link al panel │
 └─────────────────────────────────┘        └────────────────────────────┘
```

## 2. Componentes

| Componente | Carpeta | Stack | Responsabilidad única |
|---|---|---|---|
| **Core** | `core/` | Python 3.11, FastAPI, SQLite | Decidir qué pasa: agenda, recordatorios, check-ins, alertas y a quién avisar |
| **Asistente** | `core/app/assistant.py` | API de Claude | Conversar y redactar; leer el estado sin modificarlo |
| **Notify** | `core/app/notify.py` | Twilio WhatsApp, Telegram | Sacar el aviso de la pantalla y llevarlo al bolsillo del contacto |
| **Web** | `web/` | React 18, Vite, Tailwind | Tres vistas: asistente de la persona (`/`), panel de la familia (`/familia`, `/a/:id`) y operador (`/sim`) |
| **Conectores simulados** | `web/src/pages/Sim.tsx` + `core/app/demo.py` | — | Emitir eventos creíbles en el contrato real |

**Principio rector:** el core es el único que decide. Los conectores reportan hechos, el
asistente conversa y la web pinta. **El LLM nunca abre ni cierra alertas, ni crea o cambia
recordatorios**: devuelve texto y banderas (`02` §9), y son reglas deterministas del core las
que actúan sobre esas banderas.

## 3. Flujos

### 3.1 Recordatorio de medicación
```
 hora del ítem de agenda
        │
        ▼
   DUE ── asistente lo dice en voz alta, pastillero (simulado) enciende el compartimento
     │
     ├── compartment_opened o confirm_pressed o "sí" en el asistente ──► DONE
     │
     └── sin respuesta: se aplica `escalation` del ítem, paso a paso
           repeat_reminder ──► notify_primary ──► notify_secondary
                                    │ (abre alerta warning)
                                    ▼
                               MISSED si vence la tolerancia
```
- El texto siempre dice "**se abrió el compartimento**" o "**confirmó**", nunca "se tomó".
- Un recordatorio de medicación **nunca se notifica como `critical`**. Una pastilla atrasada no
  es una emergencia, y tratarla como tal entrena a la familia a ignorar a Vesta.

### 3.2 Caída o SOS del reloj
```
 fall_detected ──► CHECK-IN: el asistente pregunta "¿Está bien?" con botones Sí / Necesito ayuda
                     │
                     ├── "Estoy bien" ──► se registra, info en la línea de tiempo, sin aviso
                     ├── "Necesito ayuda" ──► alerta critical inmediata
                     └── sin respuesta en CHECKIN_TIMEOUT_S (30 s) ──► alerta critical
 sos_pressed ──► alerta critical inmediata (sin check-in: la persona ya pidió ayuda)

 alerta critical ──► WhatsApp al principal
       │ sin ACK en ESCALATION_ACK_S (60 s)
       ▼
   ESCALATED ──► WhatsApp al secundario
```

### 3.3 Conversación
1. La persona habla (Web Speech API) o escribe (Telegram o WhatsApp).
2. Un **filtro determinista** revisa el texto antes del LLM:
   - Si hay frases de emergencia ("me caí", "me duele el pecho", "no puedo respirar"), responde
     con un texto fijo que indica llamar al **131 (SAMU)** y abre una alerta `critical`.
3. Si no, el LLM recibe el texto más un **resumen de solo lectura** del estado (agenda de hoy,
   recordatorios pendientes, últimos eventos) y devuelve `reply` + `flags`.
4. El core actúa sobre las `flags`. Por ejemplo, `medical_question` responde derivando al médico
   y abre una alerta `info` para la familia, y `wants_family_contact` avisa al principal.
5. La respuesta se habla en voz alta y aparece en pantalla con letra grande.

### 3.4 Panel de la familia
El panel se conecta a `WS /v1/stream`, recibe un `snapshot` al conectarse y después solo
cambios. El ACK y la resolución vuelven por REST.

## 4. Decisiones técnicas y por qué

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Un único `POST /v1/events` para todos los conectores | Un endpoint por fuente | Agregar un conector es agregar un `source`, no una ruta |
| Web Speech API del navegador | STT/TTS de un proveedor pagado | Cero dependencias y funciona hoy. La voz definitiva se elige con usuarios reales |
| Telegram con long polling para el chat de la persona | WhatsApp entrante | WhatsApp entrante exige webhook público y un túnel; Telegram no |
| WhatsApp saliente con el sandbox de Twilio | API oficial de WhatsApp Business | Meta exige verificación de días. El sandbox funciona hoy |
| Agenda y escalamiento deterministas | El LLM decide cuándo recordar | Es un riesgo de seguridad de la medicación. No se discute |
| El LLM devuelve banderas y el core actúa | El LLM con herramientas que escriben estado | Se puede auditar y probar, y no tiene acciones sorpresa |
| SQLite | Postgres | Cero instalación |
| Sin autenticación | JWT, roles | No aporta al demo. Queda como deuda declarada |

## 5. Despliegue

Todo corre local, en el notebook que proyecta:

```bash
./scripts/dev.sh        # core en :8000, web en :5173
```

- `core` → `uvicorn app.main:app --port 8000`
- `web` → `vite dev --host --port 5173`, con proxy de `/v1` hacia `:8000` y `ws: true`
- Variables de entorno: `02-DATA-CONTRACTS.md` §12

`DEMO_MODE=true` activa varias cosas:
- Los tiempos de escalamiento de la agenda se aceleran con `ESCALATION_TIME_SCALE`.
- Hay respuestas de respaldo del asistente si la API de IA no responde.
- Los WhatsApp van al log si Twilio falla.
- Quedan habilitados los endpoints `/v1/demo/*`.

## 6. Modos de falla y degradación

| Si falla… | El sistema… | Qué ve el jurado |
|---|---|---|
| La API de IA | Usa respuestas fijas por intención (saludo, resumen del día, derivación médica) | Un asistente más escueto, no un error |
| El reconocimiento de voz (necesita internet en Chrome) | Quedan los botones grandes y la caja de texto | La persona responde con un botón |
| Twilio | La alerta se abre igual y el envío queda `failed` | "WhatsApp no disponible" en el panel |
| El WebSocket | La web reintenta cada 2 s y mantiene el último estado | Un indicador "reconectando" |
| No hay internet | Agenda, check-ins, alertas y panel funcionan en local | Más del 70 % del demo intacto |

**Regla:** ningún fallo externo puede impedir que un recordatorio se dispare ni que una alerta
se abra, se vea y se reconozca.

## 7. Deuda técnica consciente

Hay que declararla en el pitch:

- Conectores simulados, sin integración real con relojes, pastilleros ni BondUP
- Sin autenticación ni consentimiento formal digital (está diseñado, no construido)
- El filtro de emergencias es por palabras clave y no cubre todo
- Una sola persona y un solo hogar en el modelo de datos del demo
- La voz es la del navegador; la definitiva se elige probando con personas mayores
