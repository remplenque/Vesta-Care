# 04 · Módulo: Vesta Core (backend)

**Carpeta:** `core/` · **Stack:** Python 3.11, FastAPI, Pydantic v2, SQLite, `websockets`
**Responsabilidad única:** decidir qué es una emergencia, a quién avisar y mantener la verdad del sistema.

## 1. Estructura

```
core/app/
├── main.py       FastAPI, rutas, montaje del WebSocket
├── models.py     Pydantic — espejo exacto de 02-DATA-CONTRACTS.md
├── store.py      SQLite + buffer circular de telemetría en memoria
├── rules.py      motor de reglas
├── alerts.py     ciclo de vida, deduplicación, escalamiento
├── notify.py     WhatsApp (ver 06)
├── reports.py    IA (ver 07)
├── simfallback.py generador sintético si Unity no responde
└── seed.py       residentes, cuidadores y plano de demo
```

## 2. Almacenamiento

**SQLite** (`vesta.db`) para lo que debe sobrevivir: `residents`, `caregivers`, `alerts`,
`notifications`, `reports`.

**Memoria** para telemetría: un `deque` por residente con los últimos **900 ticks** (15 minutos a
1 Hz). Suficiente para todas las ventanas de reglas y para los gráficos de la ficha. Para el
reporte diario se guarda además un agregado por minuto en SQLite (`telemetry_rollup`).

No se persiste cada tick crudo. Son 12 residentes × 86.400 s y no aporta nada al demo.

## 3. Motor de reglas

Declarativo. Cada regla es un objeto con: `rule_id`, `severity`, métrica, comparador, umbral,
ventana de sostenimiento y plantilla de mensaje.

```python
Rule(
    rule_id="GLUCOSE_CRITICAL_LOW",
    severity="critical",
    metric="vitals.glucose_mgdl",
    op="<", threshold=60, window_s=30,
    title="Hipoglicemia severa",
    detail="Glucosa en {value} mg/dL, sostenida por {elapsed}s.",
)
```

### 3.1 Catálogo de reglas

| `rule_id` | Condición | Ventana | Severidad |
|---|---|---|---|
| `FALL_DETECTED` | evento `fall_detected` | inmediato | critical |
| `FALL_NO_RECOVERY` | `motion.state == fallen` sostenido | 20 s | critical |
| `PANIC_BUTTON` | evento `panic_button` | inmediato | critical |
| `HR_CRITICAL_HIGH` | `hr_bpm > 130` | 30 s | critical |
| `HR_CRITICAL_LOW` | `hr_bpm < 45` | 30 s | critical |
| `HR_WARNING` | `hr_bpm > 115` o `< 50` | 60 s | warning |
| `SPO2_CRITICAL` | `spo2_pct < 88` | 45 s | critical |
| `SPO2_WARNING` | `spo2_pct < 92` | 90 s | warning |
| `GLUCOSE_CRITICAL_LOW` | `glucose_mgdl < 60` | 30 s | critical |
| `GLUCOSE_CRITICAL_HIGH` | `glucose_mgdl > 300` | 60 s | critical |
| `GLUCOSE_WARNING_LOW` | `glucose_mgdl < 70` | 60 s | warning |
| `FEVER` | `temp_c > 38.5` | 120 s | warning |
| `HYPOTHERMIA` | `temp_c < 35.0` | 120 s | critical |
| `UNAUTHORIZED_EXIT` | evento `door_exit` fuera de horario | inmediato | critical |
| `INACTIVITY` | `seconds_since_movement > 14400` | — | warning |
| `BATHROOM_OVERSTAY` | zona `bathroom` por más de 20 min | 1200 s | warning |
| `DEVICE_REMOVED` | evento `device_removed` | inmediato | warning |
| `SIGNAL_LOST` | sin ticks del residente | 60 s | warning |

> Los umbrales son **plausibles pero no validados clínicamente**. Están centralizados en
> `rules.py` para que un equipo clínico pueda ajustarlos sin tocar lógica. Decirlo así en el pitch.

### 3.2 Severidad efectiva
`severidad_final = severidad_regla × risk_weight de la zona`. Si el resultado supera el umbral de
`critical`, una `warning` escala. Una caída en el baño pesa más que una en el comedor.

### 3.3 Deduplicación
No se abre una alerta nueva si ya existe una **abierta o reconocida** con el mismo
`(resident_id, rule_id)`. Se actualiza `evidence` con el valor más extremo observado. Sin esto,
el dashboard se llena de 30 alertas idénticas en 30 segundos.

## 4. Ciclo de vida de la alerta

```
OPEN ──ack──► ACKNOWLEDGED ──resolve──► RESOLVED
  └──60 s sin ack──► ESCALATED ──ack──► ACKNOWLEDGED
```

- Al abrir: se persiste, se difunde `alert.opened`, se dispara `notify`
- Al escalar: se notifica a **todos** los cuidadores en turno, no solo a los de la zona
- Toda transición registra `caregiver_id` y timestamp
- Las alertas `warning` **no** se notifican por WhatsApp; solo se ven en el dashboard

## 5. Asignación de cuidador

1. Cuidadores en turno cuyas `zones_assigned` incluyan la zona de la alerta
2. Si no hay, el cuidador con `role == "nurse"` en turno
3. Si no hay, todos los que estén en turno

## 6. WebSocket

`/v1/stream` mantiene una lista de clientes conectados. Difusión con `asyncio.gather` y
tolerancia a fallos: un cliente caído se descarta de la lista sin interrumpir a los demás.
Al conectarse, el cliente recibe un `snapshot` inicial con residentes, alertas abiertas y
estado del sim, para que no tenga que hacer tres llamadas REST.

## 7. Fallback de simulación

Si no llega telemetría de Unity por más de 10 s y `DEMO_MODE=true`, `simfallback.py` genera
ticks sintéticos para todos los residentes. El campo `sim.status.connected` pasa a `false` y el
dashboard muestra "modo autónomo". **El demo nunca se queda con el plano congelado.**

## 8. Criterios de aceptación

- [ ] `POST /v1/telemetry` procesa un lote de 12 residentes en menos de 50 ms
- [ ] Las 18 reglas del catálogo están implementadas y tienen test unitario
- [ ] La deduplicación impide alertas repetidas del mismo residente y regla
- [ ] El ACK se refleja en todos los dashboards conectados en menos de 500 ms
- [ ] El escalamiento se dispara exactamente a los 60 s sin ACK
- [ ] Con Unity apagado y `DEMO_MODE=true`, el sistema sigue produciendo datos
- [ ] `GET /health` reporta correctamente si el sim está conectado
