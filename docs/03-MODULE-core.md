# 03 · Módulo: Core (backend)

**Carpeta:** `core/` · Python 3.11, FastAPI, Pydantic v2, SQLite
**Responsabilidad única:** decidir. Recibe hechos, lleva la agenda, abre check-ins y alertas, y
decide a quién avisar.

## 1. Archivos

```
core/app/
├── main.py         ← rutas REST + WS, arranque del scheduler
├── models.py       ← Pydantic, espejo exacto de 02-DATA-CONTRACTS
├── store.py        ← SQLite: persons, contacts, devices, agenda_items, reminders,
│                     checkins, alerts, notifications, events, conversation_log
├── agenda.py       ← genera recordatorios del día y ejecuta el escalamiento
├── rules.py        ← evento → check-in o alerta (tabla de 02 §9)
├── alerts.py       ← ciclo de vida, dedupe, escalamiento por ACK
├── assistant.py    ← ver 04-MODULE-assistant.md
├── notify.py       ← ver 06-MODULE-notify.md
├── demo.py         ← semilla, escenarios y reset (solo DEMO_MODE)
└── prompts/        ← prompts versionados, nunca embebidos en código
core/tests/         ← obligatorio: agenda y escalamiento
```

## 2. Scheduler

Una tarea `asyncio` que hace un tick cada **1 segundo**:

1. Al cambiar de día (hora de `America/Santiago`) o al arrancar, crea los recordatorios del día
   desde `agenda_items` (estado `scheduled`).
2. Los recordatorios con `due_at <= now` pasan a `due`. Se emite `assistant.said` con el texto
   del recordatorio y `reminder.updated`.
3. A cada recordatorio `due` le aplica los pasos de `escalation` cuyo `after_min` (escalado) ya se
   cumplió y que no se han ejecutado (`escalation_step`).
4. Cierra como `missed` los que vencieron `tolerance_min`.
5. Los check-ins `pending` vencidos pasan a `no_response` y abren su alerta.
6. Las alertas `critical` en `open` sin ACK tras `ESCALATION_ACK_S` pasan a `escalated` y se
   notifica al contacto `priority: 2`.

**El scheduler lee la hora de una función inyectable (`now()`).** Así los tests controlan el
tiempo sin dormir.

## 3. Reglas (`rules.py`)

Funciones puras: `(evento, estado) → lista de acciones`. Las acciones posibles son
`open_checkin`, `open_alert`, `resolve_reminder` y `update_device`. La lógica de la tabla de
`02` §9 vive aquí y solo aquí.

- `compartment_opened` resuelve el recordatorio `due` cuyo `compartment` coincide. Si no hay
  ninguno `due` (por ejemplo, abrió a deshoras), solo queda en la línea de tiempo.
- Con `monitoring_paused`, las reglas no producen `open_alert` ni notificaciones. Los
  recordatorios a la persona siguen igual.

## 4. Pruebas obligatorias

Todo recordatorio y todo escalamiento tiene prueba. Como mínimo:

- [ ] Un ítem con `times: ["09:00","21:00"]` genera exactamente 2 recordatorios del día
- [ ] `compartment_opened` del compartimento correcto → `done` con `resolution: compartment_opened`
- [ ] Abrir **otro** compartimento no resuelve el recordatorio
- [ ] Sin respuesta: a los 10 min `repeat_reminder`, a los 30 alerta `warning` + aviso al
      principal, a los 60 aviso al secundario, cada paso una sola vez
- [ ] `ESCALATION_TIME_SCALE=60` convierte esos minutos en segundos
- [ ] `fall_detected` → check-in; `ok` → sin alerta; sin respuesta en 30 s → `FALL_NO_RESPONSE`
- [ ] `sos_pressed` → alerta `critical` sin check-in
- [ ] Dedupe por `(person_id, rule_id)`
- [ ] `critical` sin ACK en 60 s → `escalated` + aviso al secundario
- [ ] Con `monitoring_paused` no se abren alertas
- [ ] Un `event_id` repetido no tiene efecto

## 5. Demo (`demo.py`)

**Semilla.** Una persona (Don Luis, 78, vive solo) y dos contactos. También tres ítems de
agenda:
- Losartán 50 mg a las 09:00 y 21:00, compartimento 2
- Control en el CESFAM hoy a las 15:00 (`calendar`)
- "Taller de uso del celular" de BondUP hoy a las 17:00 (`bondup`)

Dispositivos: reloj y pastillero, ambos `online`. Todos los datos son ficticios.

**Escenarios.** Los escenarios `missed_medication`, `fall` y `sos` se disparan con `02` §11.
`reset` vuelve a la semilla sin reiniciar el proceso.

## 6. Criterios de aceptación

- [ ] Las pruebas de §4 pasan con `pytest`
- [ ] `ruff check .` sin errores
- [ ] Un evento POSTeado aparece por WS en menos de 1 s
- [ ] El panel recibe `snapshot` al reconectar y queda igual que antes de la caída
- [ ] Sin red (sin Twilio ni IA), un escenario `fall` abre la alerta y se puede dar ACK
