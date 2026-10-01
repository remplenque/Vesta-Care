# 02 · Contratos de datos

> **Fuente de verdad del sistema.** Core, web y conectores simulados se desarrollan en paralelo
> contra este documento. Si un campo no está aquí, no existe. Para cambiarlo hay que avisar al
> equipo y actualizar este archivo en el mismo commit.
>
> **Congelación:** **12:00** del día del evento (se reemplazó el freeze de las 10:00 de la
> versión ELEAM). Después solo se aceptan campos opcionales nuevos.

## 1. Convenciones

- Timestamps: **UTC, ISO-8601 con Z** → `"2026-10-01T12:02:15.000Z"`. Se usa siempre la hora
  real del reloj; no hay tiempo simulado. Las horas de la agenda (`"09:00"`) son locales de
  `America/Santiago`.
- IDs: string con prefijo por tipo → `per_01`, `ctc_01`, `dev_watch_01`, `itm_01`, `rem_…`,
  `chk_…`, `alr_…`, `evt_…`, `ntf_…`
- Todos los campos son obligatorios salvo que diga `opcional`. `null` solo donde se indica.
- Ningún enum ni ID se muestra al usuario final: la web y los mensajes los traducen.

## 2. Persona

```json
{
  "person_id": "per_01",
  "display_name": "Don Luis",
  "first_name": "Luis",
  "age": 78,
  "lives_alone": true,
  "address_form": "usted",
  "monitoring_paused": false,
  "contacts": ["ctc_01", "ctc_02"]
}
```
`address_form` ∈ `usted` · `tu`. Con `monitoring_paused: true` no se abren alertas ni se envían
avisos; los recordatorios a la persona siguen funcionando.

## 3. Contacto

```json
{
  "contact_id": "ctc_01",
  "name": "Carolina",
  "relation": "hija",
  "priority": 1,
  "phone_e164": "+56912345678",
  "channel": "whatsapp"
}
```
`priority`: 1 = principal, 2 = secundario. `channel` ∈ `whatsapp` · `telegram`.

## 4. Dispositivo (conector)

```json
{
  "device_id": "dev_watch_01",
  "source": "watch",
  "name": "Reloj",
  "status": "online",
  "battery_pct": 87,
  "last_seen": "2026-10-01T12:02:15.000Z"
}
```
`source` ∈ `watch` · `pillbox` · `calendar` · `bondup` · `assistant` · `sim`
`status` ∈ `online` · `offline`. Un dispositivo pasa a `offline` cuando no envía nada en 10
minutos o cuando reporta `device_offline`.

## 5. Agenda

Ítems cargados por la familia (o importados de `calendar`/`bondup`). **El LLM nunca crea ni
modifica ítems.**

```json
{
  "item_id": "itm_01",
  "person_id": "per_01",
  "kind": "medication",
  "title": "Losartán 50 mg",
  "times": ["09:00", "21:00"],
  "date": null,
  "compartment": 2,
  "tolerance_min": 30,
  "escalation": [
    { "after_min": 10, "action": "repeat_reminder" },
    { "after_min": 30, "action": "notify_primary" },
    { "after_min": 60, "action": "notify_secondary" }
  ],
  "source": "family",
  "location": null
}
```

| Campo | Regla |
|---|---|
| `kind` | `medication` · `appointment` · `social` |
| `times` | Horas locales `HH:MM`. Se repite a diario si `date` es `null` |
| `date` | `opcional`, `YYYY-MM-DD` para eventos de un solo día (citas, actividades) |
| `compartment` | Solo para `medication`; si no, `null` |
| `escalation` | Solo para `medication`. Para `appointment` y `social`, `[]` (solo se recuerda) |
| `escalation[].action` | `repeat_reminder` · `notify_primary` · `notify_secondary` |
| `source` | `family` · `calendar` · `bondup` |
| `location` | `opcional`, texto libre ("CESFAM Las Condes") |

Con `DEMO_MODE=true`, cada `after_min` y `tolerance_min` se divide por `ESCALATION_TIME_SCALE`
(por ejemplo, `60` hace que los minutos duren segundos).

## 6. Evento de conector — `POST /v1/events`

Formato común para todas las fuentes. Se envía cuando el hecho ocurre.

```json
{
  "event_id": "evt_a91c",
  "ts": "2026-10-01T12:02:15.000Z",
  "source": "pillbox",
  "device_id": "dev_pillbox_01",
  "person_id": "per_01",
  "type": "compartment_opened",
  "payload": { "compartment": 2 }
}
```

| `source` | `type` | `payload` |
|---|---|---|
| `watch` | `fall_detected` | `{}` |
| `watch` | `sos_pressed` | `{}` |
| `pillbox` | `compartment_opened` | `{ "compartment": int }` |
| `pillbox` | `confirm_pressed` | `{}` |
| `pillbox` | `help_pressed` | `{}` (equivale a `sos_pressed`) |
| `watch` · `pillbox` | `battery_low` | `{ "battery_pct": int }` |
| `watch` · `pillbox` | `device_offline` | `{}` |
| `calendar` · `bondup` | `item_upserted` | Un ítem de agenda (§5) con `source` igual al del evento |

`event_id` es idempotente: un segundo POST con el mismo ID responde `200` sin efecto.
**Respuesta:** `202 Accepted`, `{ "accepted": true }`.

## 7. Recordatorio

```json
{
  "reminder_id": "rem_01_0900_20261001",
  "item_id": "itm_01",
  "person_id": "per_01",
  "kind": "medication",
  "title": "Losartán 50 mg",
  "due_at": "2026-10-01T12:00:00.000Z",
  "status": "due",
  "resolution": null,
  "resolved_at": null,
  "escalation_step": 0
}
```
`status` ∈ `scheduled` · `due` · `done` · `missed`
`resolution` ∈ `compartment_opened` · `confirmed_button` · `confirmed_voice` · `null`

Pasa de `due` a `done` con el primer `compartment_opened` del compartimento correcto, con
`confirm_pressed` o con un "sí" explícito en el asistente (§10). Pasa a `missed` al vencer
`tolerance_min` sin nada de lo anterior. `escalation_step` es la cantidad de pasos ya ejecutados.

## 8. Check-in

Pregunta activa del asistente a la persona después de un `fall_detected`.

```json
{
  "checkin_id": "chk_01",
  "person_id": "per_01",
  "reason": "fall_detected",
  "question": "¿Está bien, Don Luis?",
  "opened_at": "2026-10-01T12:05:00.000Z",
  "expires_at": "2026-10-01T12:05:30.000Z",
  "status": "pending"
}
```
`status` ∈ `pending` · `ok` · `help` · `no_response`
**Responder:** `POST /v1/checkins/{id}/answer`, body `{ "answer": "ok" | "help" }`.
Con `help` o `no_response` se abre una alerta `critical`.

## 9. Alerta

La produce solo el core.

```json
{
  "alert_id": "alr_7f3a",
  "rule_id": "FALL_NO_RESPONSE",
  "severity": "critical",
  "status": "open",
  "person_id": "per_01",
  "person_name": "Don Luis",
  "source": "watch",
  "opened_at": "2026-10-01T12:05:30.400Z",
  "title": "Posible caída sin respuesta",
  "detail": "El reloj detectó una posible caída y Don Luis no respondió en 30 segundos.",
  "acknowledged_by": null,
  "acknowledged_at": null,
  "escalated_at": null,
  "resolved_at": null,
  "notifications": []
}
```
`severity` ∈ `critical` · `warning` · `info`
`status` ∈ `open` · `acknowledged` · `escalated` · `resolved`

| `rule_id` | Severidad | Cuándo |
|---|---|---|
| `FALL_NO_RESPONSE` | critical | Check-in de caída con `no_response` |
| `FALL_HELP_REQUESTED` | critical | Check-in de caída con `help` |
| `SOS` | critical | `sos_pressed` o `help_pressed` |
| `EMERGENCY_PHRASE` | critical | El filtro determinista del asistente detectó una frase de emergencia |
| `MEDICATION_NOT_CONFIRMED` | warning | Paso `notify_primary` de un recordatorio de medicación |
| `MEDICAL_QUESTION` | info | El asistente recibió una pregunta clínica (flag del LLM o filtro) |
| `FAMILY_CONTACT_REQUESTED` | info | La persona pidió hablar con su familia |
| `DEVICE_ATTENTION` | info | `battery_low` o `device_offline` |

**Dedupe:** si ya existe una alerta no resuelta con el mismo `(person_id, rule_id)`, no se abre
otra.

## 10. Asistente — `POST /v1/assistant/message`

```json
{ "person_id": "per_01", "channel": "web_voice", "text": "¿qué tengo hoy?" }
```
`channel` ∈ `web_voice` · `web_text` · `telegram` · `whatsapp`

**Respuesta:**
```json
{
  "reply": "Hoy tiene Losartán a las 9 y a las 21, y control en el CESFAM a las 15:00.",
  "flags": {
    "medical_question": false,
    "wants_family_contact": false,
    "confirms_medication": false,
    "emergency": false
  },
  "actions_taken": [],
  "fallback": false,
  "suggestions": ["Bien, gracias", "Más o menos", "¿Qué tengo hoy?"]
}
```
- Las `flags` las produce el LLM o el filtro determinista; **las acciones las decide el core**.
- `confirms_medication: true` solo cierra un recordatorio `due` si hay exactamente uno pendiente.
  Si hay dos o más, el core responde preguntando cuál y no cierra ninguno.
- `actions_taken` ∈ `alert_opened` · `reminder_confirmed` · `family_notified`, para que la web
  pueda mostrarlo.
- `fallback: true` cuando la respuesta vino de los textos fijos y no del modelo.
- `suggestions`: 1 a 3 respuestas cortas (máximo 32 caracteres) que la persona puede tocar en
  vez de hablar. Al tocarlas se envían como un mensaje normal. Las genera el LLM y el core descarta
  las que hablen de medicamentos, dosis o emergencias. Las respuestas fijas traen opciones fijas.

`GET /v1/assistant/briefing?person_id=per_01` devuelve `{ "reply": str, "fallback": bool, "suggestions": [str] }` con el
saludo y el resumen del día (el primer paso del demo).

## 11. Endpoints REST y WebSocket

| Método | Ruta | Para qué |
|---|---|---|
| `POST` | `/v1/events` | Ingesta de conectores (§6) |
| `GET` | `/v1/persons/{id}` | Persona + contactos + dispositivos |
| `PATCH` | `/v1/persons/{id}` | Solo `{ "monitoring_paused": bool }` |
| `GET` | `/v1/agenda?person_id=&date=` | Ítems y recordatorios del día |
| `POST` | `/v1/agenda/items` | Crear o actualizar un ítem (§5), desde el panel de la familia |
| `GET` | `/v1/timeline?person_id=&date=` | Eventos, recordatorios, check-ins y alertas del día, en orden |
| `POST` | `/v1/checkins/{id}/answer` | §8 |
| `GET` | `/v1/alerts?status=` | Alertas |
| `GET` | `/v1/alerts/{id}` | Una alerta (para `/a/:id`) |
| `POST` | `/v1/alerts/{id}/ack` | Body `{ "contact_id": "ctc_01" }` |
| `POST` | `/v1/alerts/{id}/resolve` | Body `{ "contact_id": "ctc_01", "note": "opcional" }` |
| `POST` | `/v1/assistant/message` | §10 |
| `GET` | `/v1/assistant/briefing` | §10 |
| `POST` | `/v1/demo/scenario` | Solo `DEMO_MODE`. Body `{ "scenario": "missed_medication" \| "fall" \| "sos" }` |
| `POST` | `/v1/demo/reset` | Solo `DEMO_MODE`. Borra recordatorios, check-ins y alertas del día, y vuelve a la semilla |
| `POST` | `/v1/channels/whatsapp/webhook` | Webhook de Twilio (form-urlencoded: `From`, `Body`, `NumMedia`). Responde TwiML `<Response><Message>…</Message></Response>` con la respuesta del asistente (§10, `channel: "whatsapp"`). Solo atiende números de `WHATSAPP_PERSON_NUMBERS`; valida `X-Twilio-Signature` si hay `TWILIO_AUTH_TOKEN` y `PUBLIC_CORE_URL` |
| `GET` | `/v1/tts?text=&voice=` | Audio `audio/mpeg` en streaming con la voz de ElevenLabs. `voice` es un `name` de `/v1/tts/voices` (opcional, por defecto la primera). `503` si no está configurado o falla: la web cae a la voz del navegador |
| `GET` | `/v1/tts/voices` | `[{ "name": "Emilia" }, { "name": "Mateo" }]`, las voces disponibles según `ELEVENLABS_VOICES` (`Nombre:voice_id,…`) |
| `GET` | `/health` | `{ "status": "ok", "llm": bool, "tts": bool, "notify": "twilio" \| "telegram" \| "log" }` |

`missed_medication` crea un recordatorio de medicación con `due_at` = ahora. `fall` y `sos`
emiten el evento correspondiente del reloj.

**`WS /v1/stream`.** Todos los mensajes llevan la envoltura
`{ "type": str, "ts": str, "data": {} }`. Al conectarse, el primer mensaje es `snapshot`.

| `type` | `data` |
|---|---|
| `snapshot` | `{ person, devices, reminders, checkins, alerts }` del día |
| `event.received` | Evento §6 |
| `reminder.updated` | Recordatorio §7 |
| `checkin.updated` | Check-in §8 |
| `alert.opened` · `alert.updated` | Alerta §9 |
| `notification.sent` | Notificación §11.1 |
| `assistant.said` | `{ "text": str, "channel": str }`: lo que dijo el asistente, para que la vista `/` lo hable |

El cliente **ignora los tipos que no conoce**.

### 11.1 Notificación

```json
{
  "notification_id": "ntf_01",
  "alert_id": "alr_7f3a",
  "contact_id": "ctc_01",
  "channel": "whatsapp",
  "status": "sent",
  "at": "2026-10-01T12:05:31.100Z",
  "error": null
}
```
`status` ∈ `sent` · `failed` · `skipped_rate_limit` · `logged`. `logged` significa que se escribió
en el log en vez de enviarse (`NOTIFY_CHANNEL=log` o fallback del demo).

## 12. Variables de entorno (`.env.example`)

```
DEMO_MODE=true
ESCALATION_TIME_SCALE=60
CHECKIN_TIMEOUT_S=30
ESCALATION_ACK_S=60
PUBLIC_WEB_URL=http://192.168.1.10:5173
NOTIFY_CHANNEL=log               # twilio | telegram | log
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TELEGRAM_BOT_TOKEN=
PUBLIC_CORE_URL=                 # URL pública del túnel hacia :8000, ej. https://xxxx.trycloudflare.com
WHATSAPP_PERSON_NUMBERS=         # números E.164 que hablan con el asistente como per_01, separados por coma
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-haiku-4-5
ELEVENLABS_API_KEY=
ELEVENLABS_VOICES=Emilia:6Gr4AVmTax1pMJO0lHRK,Mateo:9ZVfdvBemUaGEWZgCiv0
ELEVENLABS_MODEL=eleven_flash_v2_5
```
`PUBLIC_WEB_URL` arma el link `/a/:id` de los WhatsApp; tiene que ser la IP del notebook en el
hotspot.
