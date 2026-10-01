# 01 · Arquitectura

## 1. Vista general

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          VESTA SIM  (Unity · C#)                         │
│  Gemelo digital de un piso de ELEAM                                      │
│  · 8-12 residentes con navegación y máquina de estados de vitales        │
│  · Cámaras en escena = CCTV del centro                                   │
│  · Panel de operador para inyectar emergencias                           │
└───────────────┬──────────────────────────────────────────────────────────┘
                │  POST /v1/telemetry        (1 Hz, lote de residentes)
                │  POST /v1/sim/events       (discreto, al ocurrir)
                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      VESTA CORE  (Python · FastAPI)                      │
│                                                                          │
│   ingest ──► rules engine ──► alert lifecycle ──► fan-out                │
│      │            │                  │               ├──► WebSocket      │
│      │            │                  │               └──► notify         │
│      ▼            ▼                  ▼                                   │
│   store (SQLite: residents · telemetry_ring · alerts · caregivers)       │
│                                                                          │
│   reports ──► API de IA (Claude) ──► resumen por residente               │
└───────┬──────────────────────────────────────────┬───────────────────────┘
        │  WS /v1/stream  +  REST                  │  Twilio WhatsApp API
        ▼                                          ▼
┌─────────────────────────────────┐    ┌─────────────────────────────────┐
│   VESTA BOARD  (React + Vite)   │    │   Celular del cuidador          │
│   · Plano cenital con alertas   │    │   Mensaje con residente, zona,  │
│   · Cola de alertas + ACK       │    │   motivo y link de ACK          │
│   · Ficha de residente + IA     │    └─────────────────────────────────┘
│   · Vista de cámaras (Unity     │
│     WebGL embebido)             │
└─────────────────────────────────┘
```

## 2. Componentes

| Componente | Carpeta | Stack | Responsabilidad única |
|---|---|---|---|
| **Vesta Sim** | `sim/` | Unity 2022 LTS, C# | Producir telemetría y eventos creíbles; ser el CCTV |
| **Vesta Core** | `core/` | Python 3.11, FastAPI, SQLite | Decidir qué es una emergencia y a quién avisar |
| **Vesta Board** | `board/` | React 18, Vite, Tailwind, Recharts | Mostrar el estado del centro y capturar el ACK |
| **Notify** | `core/app/notify.py` | Twilio WhatsApp | Sacar la alerta de la pantalla y meterla al bolsillo |
| **Insight** | `core/app/reports.py` | API de Claude | Convertir series de datos en narrativa clínica |

**Principio rector:** el backend es el único que decide. Unity no sabe qué es una emergencia, solo
reporta hechos. El dashboard no evalúa umbrales, solo pinta lo que el backend le dice.

## 3. Flujos

### 3.1 Flujo de telemetría (continuo)
1. Unity acumula el estado de todos los residentes y hace **un POST por segundo** con el lote
   completo (no un request por residente).
2. `core` valida contra el modelo Pydantic, escribe en el buffer circular y pasa el lote al
   motor de reglas.
3. El motor evalúa cada regla sobre la ventana temporal que esa regla requiere.
4. Si una regla dispara y no hay una alerta abierta equivalente, se abre una alerta.
5. Cada tick se difunde por WebSocket a todos los dashboards conectados.

**Presupuesto de latencia: evento en Unity → pixel en el dashboard ≤ 3 segundos.**

### 3.2 Flujo de alerta
```
   regla dispara
        │
        ▼
   OPEN ──(cuidador presiona ACK)──► ACKNOWLEDGED ──(cierra)──► RESOLVED
     │                                     │
     │ sin ACK en 60 s                     │ sin cierre en 15 min
     ▼                                     ▼
   ESCALATED  ──► notifica a todos      (solo se marca en el dashboard,
   los cuidadores del turno              no re-notifica)
```
Toda transición se difunde por WebSocket y queda registrada con timestamp. Los tiempos de
respuesta de la vista de administración se calculan sobre estos registros.

### 3.3 Flujo de cámaras
Unity compila a **WebGL** y se embebe en el dashboard dentro de un `<iframe>`. El dashboard
cambia de cámara con `postMessage`; Unity responde moviendo la cámara activa.

- **Plan A:** WebGL embebido. Una sola ventana, el jurado ve plano y cámara al mismo tiempo.
- **Plan B (si el build WebGL falla):** Unity corre nativo en un segundo monitor al lado del
  dashboard. Se pierde la integración visual, no se pierde el demo.
- **Plan C:** Unity sube un JPEG por segundo de cada cámara a `POST /v1/cameras/{id}/frame` y el
  dashboard lo muestra como imagen que se refresca. Feo pero funciona.

Decidir entre A y B **antes de las 12:00**. No se intenta C salvo que A y B fallen.

### 3.4 Flujo de reportes IA
Disparo manual desde la ficha del residente. `core` agrega la telemetría del día (mínimos,
máximos, promedios por ventana, cantidad de eventos, historial de alertas), la envía al modelo
con un prompt acotado, y devuelve un resumen estructurado. Se cachea por residente y por día.

## 4. Decisiones técnicas y por qué

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| HTTP POST a 1 Hz desde Unity | MQTT | Un broker más que levantar y depurar. A 12 residentes, HTTP sobra |
| WebSocket hacia el dashboard | Polling cada 2 s | El ACK tiene que verse instantáneo en todas las pantallas |
| SQLite | Postgres | Cero instalación, cero contenedores, el archivo se versiona si hace falta |
| Unity WebGL embebido | Streaming de video real | WebRTC en un día es un suicidio. Las cámaras de la escena ya son el feed |
| Twilio WhatsApp sandbox | API oficial de WhatsApp Business | Meta exige verificación de días. El sandbox funciona hoy |
| Motor de reglas declarativo | Modelo de ML | Explicable ante el jurado, depurable, y con 12 residentes no hay datos para entrenar nada |
| Sin autenticación | JWT, roles | No aporta al demo. Queda documentado como deuda consciente |

## 5. Despliegue

Todo local, en el notebook que proyecta:

```bash
./scripts/dev.sh        # levanta core en :8000 y board en :5173
# Unity corre desde el editor o como build standalone
```

- `core` → `uvicorn app.main:app --port 8000`
- `board` → `vite dev --port 5173`, proxy `/v1` y `/ws` hacia `:8000`
- Unity apunta a `http://localhost:8000` vía `VESTA_CORE_URL` en un `ScriptableObject` de config

Variables de entorno en `.env` (ver `.env.example`):
```
VESTA_CORE_URL=http://localhost:8000
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
ANTHROPIC_API_KEY=
DEMO_MODE=true
```

`DEMO_MODE=true` activa: generador de telemetría de reemplazo si Unity no reporta hace 10 s,
reportes IA cacheados, y mensajes de WhatsApp al log en vez de a la red si Twilio falla.

## 6. Modos de falla y degradación

| Si falla… | El sistema… | Qué ve el jurado |
|---|---|---|
| Unity deja de reportar | Activa el generador sintético de `core` tras 10 s | Nada; el plano sigue vivo |
| Se cae el WebSocket | El dashboard reintenta cada 2 s y mantiene el último estado | Un punto "reconectando" en la barra superior |
| Twilio rechaza o no hay red | La alerta igual se abre; el envío se registra como fallido | El dashboard dice "WhatsApp no disponible"; la alerta funciona |
| La API de IA no responde | Se muestra un reporte precalculado de ejemplo marcado como tal | Un reporte, no un error |
| No hay internet | Todo lo local funciona; se pierden WhatsApp e IA | El 80% del demo intacto |

**Regla:** ningún fallo de un servicio externo puede impedir que una alerta se abra, se vea y se
reconozca. Esa cadena es el corazón del producto y tiene que funcionar sin red.

## 7. Deuda técnica consciente

Decláranla en el pitch antes de que la pregunten; demuestra criterio:

- Sin autenticación ni control de acceso por centro
- Umbrales fijos e iguales para todos los residentes (deberían ser por perfil clínico)
- Sin persistencia de telemetría más allá del buffer en memoria y el día actual
- Sin tests de integración; solo pruebas unitarias del motor de reglas
- El plano es uno solo y está hardcodeado en `shared/layout/eleam-01.json`
