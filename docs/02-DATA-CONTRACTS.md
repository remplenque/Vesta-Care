# 02 · Contratos de datos

> **Fuente de verdad del sistema.** Unity, el backend y el dashboard se desarrollan en paralelo
> contra este documento. Si un campo no está aquí, no existe. Modificarlo requiere avisar al
> equipo completo y actualizar este archivo en el mismo commit.
>
> **Congelación:** este documento se cierra a las **10:00** del día del evento. Después de esa
> hora solo se aceptan cambios aditivos (campos opcionales nuevos), nunca renombres ni borrados.

## 1. Convenciones

- Timestamps: **UTC, ISO-8601 con Z** → `"2026-10-01T14:32:05.120Z"`
- Identificadores: string, prefijo por tipo → `res_01`, `zone_hab_104`, `alr_7f3a`, `cg_02`
- Coordenadas: metros desde la esquina inferior izquierda del plano, eje Y hacia el norte
- Unidades: HR en lpm, SpO2 en %, glucosa en mg/dL, temperatura en °C
- Todos los campos son obligatorios salvo que diga `opcional`

## 2. Plano del centro — `shared/layout/eleam-01.json`

Lo leen Unity y el dashboard. Nadie más define zonas.

```json
{
  "facility_id": "eleam-01",
  "name": "ELEAM Vesta Demo",
  "bounds": { "width_m": 40.0, "height_m": 24.0 },
  "zones": [
    {
      "zone_id": "zone_hab_104",
      "name": "Habitación 104",
      "type": "bedroom",
      "polygon": [[2.0, 2.0], [8.0, 2.0], [8.0, 7.0], [2.0, 7.0]],
      "camera_id": "cam_03",
      "risk_weight": 1.0
    }
  ],
  "cameras": [
    { "camera_id": "cam_03", "name": "Pasillo norte", "position": [5.0, 7.0], "yaw_deg": 180 }
  ]
}
```

`type` ∈ `bedroom` · `corridor` · `dining` · `bathroom` · `common` · `outdoor` · `entrance`

`risk_weight` multiplica la severidad: el baño es 1.5 (caídas más graves y menos visibles), el
comedor 0.8 (siempre hay gente alrededor).

## 3. Telemetría — `POST /v1/telemetry`

Unity envía **un lote por segundo** con todos los residentes activos.

```json
{
  "facility_id": "eleam-01",
  "ts": "2026-10-01T14:32:05.120Z",
  "ticks": [
    {
      "resident_id": "res_01",
      "zone_id": "zone_hab_104",
      "position": { "x": 5.2, "y": 4.1 },
      "vitals": {
        "hr_bpm": 78,
        "spo2_pct": 96,
        "glucose_mgdl": 112,
        "temp_c": 36.6
      },
      "motion": {
        "state": "walking",
        "accel_magnitude_g": 1.02,
        "seconds_since_movement": 0
      },
      "device": { "battery_pct": 84, "rssi_dbm": -62 }
    }
  ]
}
```

`motion.state` ∈ `still` · `walking` · `sitting` · `lying` · `fallen`

**Respuesta:** `202 Accepted`, cuerpo `{ "received": 12, "alerts_opened": 1 }`

## 4. Eventos del simulador — `POST /v1/sim/events`

Hechos discretos. Se envían al ocurrir, no en el lote periódico.

```json
{
  "event_id": "evt_a91c",
  "ts": "2026-10-01T14:32:06.000Z",
  "type": "fall_detected",
  "resident_id": "res_01",
  "zone_id": "zone_bano_1",
  "payload": { "impact_g": 3.4 }
}
```

| `type` | Cuándo | `payload` |
|---|---|---|
| `fall_detected` | Impacto seguido de postura tendida | `impact_g` |
| `panic_button` | El residente presiona SOS | `{}` |
| `door_exit` | Cruce de zona `entrance` hacia afuera | `door_id` |
| `device_removed` | Se quitó la pulsera | `{}` |
| `manual_trigger` | El operador inyecta un escenario desde el panel | `scenario` |

## 5. Alerta

Objeto central del sistema. Lo produce `core`, nunca Unity ni el dashboard.

```json
{
  "alert_id": "alr_7f3a",
  "rule_id": "GLUCOSE_CRITICAL_LOW",
  "severity": "critical",
  "status": "open",
  "resident_id": "res_01",
  "resident_name": "Carmen Soto",
  "zone_id": "zone_hab_104",
  "zone_name": "Habitación 104",
  "opened_at": "2026-10-01T14:32:06.400Z",
  "title": "Hipoglicemia severa",
  "detail": "Glucosa en 54 mg/dL, sostenida por 45 segundos.",
  "evidence": { "metric": "glucose_mgdl", "value": 54, "threshold": 60, "window_s": 45 },
  "assigned_to": null,
  "acknowledged_at": null,
  "resolved_at": null,
  "notifications": [
    { "channel": "whatsapp", "to": "cg_02", "status": "sent",
      "at": "2026-10-01T14:32:07.100Z" }
  ]
}
```

`severity` ∈ `critical` · `warning` · `info`
`status` ∈ `open` · `acknowledged` · `escalated` · `resolved`

## 6. Residente

```json
{
  "resident_id": "res_01",
  "name": "Carmen Soto",
  "age": 84,
  "room_zone_id": "zone_hab_104",
  "mobility": "walker",
  "baseline": { "hr_bpm": [62, 92], "spo2_pct": [93, 99],
                "glucose_mgdl": [85, 150], "temp_c": [36.0, 37.2] },
  "conditions_tags": ["diabetes_t2", "hipertension"],
  "photo_url": "/avatars/res_01.png"
}
```

`mobility` ∈ `independent` · `cane` · `walker` · `wheelchair` · `bedridden`

`conditions_tags` son etiquetas de ficción con fines de simulación: alimentan el perfil de
vitales del simulador y el contexto del reporte IA. **No son datos clínicos reales.**

## 7. Cuidador

```json
{
  "caregiver_id": "cg_02",
  "name": "Pablo Muñoz",
  "role": "tens",
  "phone_e164": "+56912345678",
  "zones_assigned": ["zone_hab_104", "zone_hab_105", "zone_pasillo_n"],
  "on_shift": true
}
```

`role` ∈ `tens` · `nurse` · `supervisor` · `admin`

## 8. Endpoints REST

| Método | Ruta | Para qué |
|---|---|---|
| `POST` | `/v1/telemetry` | Ingesta de lote (Unity) |
| `POST` | `/v1/sim/events` | Evento discreto (Unity) |
| `GET` | `/v1/facility` | Devuelve `eleam-01.json` |
| `GET` | `/v1/residents` | Lista de residentes con su último tick |
| `GET` | `/v1/residents/{id}` | Ficha + serie de vitales del día |
| `GET` | `/v1/alerts?status=open` | Cola de alertas |
| `POST` | `/v1/alerts/{id}/ack` | Body `{ "caregiver_id": "cg_02" }` |
| `POST` | `/v1/alerts/{id}/resolve` | Body `{ "caregiver_id": "cg_02", "note": "..." }` |
| `GET` | `/v1/caregivers` | Turno actual |
| `POST` | `/v1/reports/{resident_id}` | Genera reporte IA del día |
| `GET` | `/v1/metrics` | Agregados para la vista de administración |
| `GET` | `/health` | `{ "status": "ok", "sim_connected": true }` |

## 9. WebSocket — `WS /v1/stream`

Envoltura común para todo mensaje empujado al dashboard:

```json
{ "type": "alert.opened", "ts": "2026-10-01T14:32:06.400Z", "data": { } }
```

| `type` | `data` contiene |
|---|---|
| `telemetry.tick` | El lote completo de la sección 3 |
| `alert.opened` | Objeto alerta |
| `alert.updated` | Objeto alerta (ACK, escalamiento, resolución) |
| `notification.sent` | `{ alert_id, channel, to, status }` |
| `sim.status` | `{ connected: bool, residents: int }` |

El cliente debe **ignorar tipos desconocidos** sin romperse. Eso permite agregar mensajes nuevos
sin romper el dashboard.

## 10. Reporte IA — respuesta de `POST /v1/reports/{resident_id}`

```json
{
  "resident_id": "res_01",
  "generated_at": "2026-10-01T18:00:00Z",
  "period": "2026-10-01",
  "summary": "Jornada estable con una descompensación en la tarde...",
  "observations": [
    "La glucosa bajó de 60 mg/dL a las 14:32 y se normalizó tras la atención.",
    "Menor actividad que su promedio: 2.1 h fuera de la habitación."
  ],
  "suggested_follow_up": [
    "Revisar horario de colación de la tarde con el equipo clínico."
  ],
  "data_quality_note": "Basado en telemetría simulada de 8 horas.",
  "disclaimer": "Apoyo a la decisión. No constituye diagnóstico médico."
}
```

El campo `disclaimer` es **obligatorio** y el dashboard debe renderizarlo siempre visible.
