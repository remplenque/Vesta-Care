# 03 · Módulo: Vesta Sim (Unity)

**Carpeta:** `sim/` · **Stack:** Unity 2022 LTS, C#, URP
**Responsabilidad única:** producir telemetría y eventos creíbles, y ser el CCTV del centro.
**Lo que NO hace:** decidir qué es una emergencia. Unity reporta hechos, no juicios.

## 1. Escena

Un piso de ELEAM, vista cenital por defecto. Geometría simple: cubos y planos con materiales
planos de color. **Cero tiempo en modelado.** El plano viene de `shared/layout/eleam-01.json`
y la escena se construye por código a partir de él (o se replica a mano respetando las mismas
coordenadas, pero el JSON manda).

Layout mínimo: 6 habitaciones, 1 pasillo central, comedor, 2 baños, acceso principal, patio.

## 2. Residente simulado

Cada residente es un `GameObject` con:

| Componente | Función |
|---|---|
| `ResidentAgent` | Navegación con `NavMeshAgent` entre puntos de interés |
| `VitalsModel` | Máquina de estados de signos vitales |
| `TelemetryEmitter` | Arma el tick y lo entrega al `TelemetryBatcher` |

### 2.1 Comportamiento
Rutina por horario simulado (el reloj del sim corre acelerado, configurable 1x a 60x):
`dormir en habitación` → `ir al comedor` → `estar en común` → `caminar pasillo` → `volver`.
Destinos elegidos con pesos aleatorios para que no se vea coreografiado.

### 2.2 Modelo de vitales
Cada métrica se simula como **línea base del residente + ruido rosa + desviación por estado**.

```
valor(t) = base + ruido(t) + offset_estado(t) + offset_escenario(t)
```

Rangos normales de referencia para adulto mayor (valores de simulación, no clínicos):

| Métrica | Normal | Advertencia | Crítico |
|---|---|---|---|
| HR (lpm) | 60 – 95 | 50-59 o 96-120 | < 45 o > 130 |
| SpO2 (%) | 94 – 99 | 90 – 93 | < 88 |
| Glucosa (mg/dL) | 80 – 150 | 61-79 o 151-250 | < 60 o > 300 |
| Temperatura (°C) | 36.0 – 37.2 | 37.3 – 38.0 | > 38.5 o < 35.0 |

El estado afecta la base: caminar sube HR 15-25 lpm, dormir la baja 8-12, un residente con
`diabetes_t2` tiene mayor varianza de glucosa.

## 3. Escenarios inyectables

El operador los dispara desde el panel. Cada uno modifica `offset_escenario` con una curva en el
tiempo y, cuando corresponde, emite un evento discreto.

| Escenario | Qué hace | Evento emitido |
|---|---|---|
| **Caída** | `motion.state` → `fallen`, pico de aceleración, HR +30, luego inmovilidad | `fall_detected` |
| **Hipoglicemia** | Glucosa baja 4 mg/dL por segundo hasta 45, HR sube | — (lo detecta el backend) |
| **Hiperglicemia** | Glucosa sube hasta 340 en 2 min | — |
| **Desaturación** | SpO2 cae a 85 en 60 s | — |
| **Taquicardia** | HR sube a 145 y se sostiene | — |
| **Fuga / vagabundeo** | El agente camina a `entrance` y la cruza | `door_exit` |
| **Botón SOS** | Inmediato | `panic_button` |
| **Inactividad prolongada** | Acelera el reloj de `seconds_since_movement` a 4 h | — |
| **Pulsera retirada** | Deja de reportar vitales del residente | `device_removed` |

> **Para el demo se usan tres:** caída, hipoglicemia y fuga. Los demás existen para responder
> si el jurado pide "¿y si pasa otra cosa?".

## 4. Panel de operador

UI de Unity (uGUI), visible solo en el build nativo, **oculta en el build WebGL embebido**.

- Dropdown de residente
- Botones grandes, uno por escenario
- Slider de velocidad del reloj (1x – 60x)
- Indicador de conexión con `core` (verde/rojo) y contador de ticks enviados
- Botón **"Resetear todo a normal"** ← crítico para repetir el demo sin reiniciar

## 5. Red

### 5.1 Telemetría
Un `TelemetryBatcher` acumula los ticks de todos los residentes y hace **un POST por segundo** a
`{VESTA_CORE_URL}/v1/telemetry`. Nunca un request por residente.

- `UnityWebRequest` con `Content-Type: application/json`
- Timeout de 2 s; si falla, se descarta el lote y se sigue (no se encola, no sirve telemetría vieja)
- Si fallan 5 lotes seguidos, el indicador se pone rojo pero el sim sigue corriendo

### 5.2 Eventos
POST inmediato a `/v1/sim/events`. Si falla, **reintenta hasta 3 veces** con 500 ms de espera:
un evento perdido sí importa.

### 5.3 Configuración
Un `ScriptableObject` llamado `VestaConfig` con `coreUrl`, `facilityId`, `tickRateHz`,
`timeScale`. Nada de URLs hardcodeadas en los scripts.

## 6. Cámaras

Cada zona con `camera_id` tiene una `Camera` en escena, posicionada según el JSON del plano.

- **Build WebGL:** el dashboard embebe el canvas y manda `postMessage` con
  `{ "action": "setCamera", "cameraId": "cam_03" }`. Unity expone un método
  `SetActiveCamera(string)` vía `[DllImport("__Internal")]` / `SendMessage`.
- Las cámaras renderizan a la vista principal (una activa a la vez), no a RenderTextures
  simultáneas: ahorra rendimiento y tiempo de desarrollo.
- Overlay en cámara: nombre de la zona y hora simulada, estilo CCTV. Barato y vende muchísimo.

## 7. Build

```
Objetivo:   WebGL, compresión Brotli desactivada (carga más rápido en local)
Salida:     board/public/sim/
Calidad:    Low, sin post-procesado, sombras desactivadas
```

> **Advertencia de tiempo:** el primer build WebGL de Unity puede tardar 15-25 minutos. Lánzalo
> **antes del mediodía** aunque la escena esté incompleta, solo para saber que compila. Si a las
> 14:00 no hay build funcionando, se pasa al Plan B (Unity nativo en segundo monitor) y nadie
> vuelve a tocarlo.

## 8. Criterios de aceptación

- [ ] 8 o más residentes se mueven por el plano sin atravesar paredes
- [ ] Los vitales varían de forma creíble y distinta entre residentes
- [ ] `POST /v1/telemetry` llega a 1 Hz con el lote completo y schema válido
- [ ] Los tres escenarios del demo se disparan desde el panel y se reflejan en los datos
- [ ] "Resetear todo a normal" devuelve el sistema a estado verde sin reiniciar
- [ ] El indicador de conexión refleja el estado real del backend
- [ ] Al menos 3 cámaras posicionadas y conmutables
