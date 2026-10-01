# 05 · Módulo: Vesta Board (dashboard)

**Carpeta:** `board/` · **Stack:** React 18, Vite, TypeScript, Tailwind, Recharts
**Responsabilidad única:** mostrar el estado del centro y capturar el ACK.
**Lo que NO hace:** evaluar umbrales ni decidir severidad. Pinta lo que el backend dice.

## 1. Principio de diseño

El usuario es un cuidador de turno, de pie, cansado, mirando una pantalla a tres metros de
distancia. Eso impone todo lo demás:

- **Legible a 3 metros.** Tipografía base 16px, títulos de alerta 24px o más
- **El color no carga información solo.** Cada severidad lleva color + ícono + texto
- **Objetivos táctiles grandes.** El botón ACK no baja de 48×48 px
- **Cero scroll para lo urgente.** Las alertas críticas siempre visibles sin desplazar
- **Sonido para críticas.** Un tono corto y repetido, con botón de silencio por 60 s

Paleta de severidad:

| Severidad | Color | Uso |
|---|---|---|
| Crítica | `#DC2626` rojo | Fondo sólido, texto blanco, parpadeo lento (no estroboscópico) |
| Advertencia | `#D97706` ámbar | Borde grueso, fondo tenue |
| Normal | `#16A34A` verde | Puntos del plano, indicadores de estado |
| Reconocida | `#2563EB` azul | La alerta sigue visible pero ya tiene dueño |

> **Accesibilidad:** nada de parpadeo más rápido que 2 Hz (riesgo fotosensible) y contraste
> mínimo AA en todo texto sobre color.

## 2. Rutas

| Ruta | Pantalla | Prioridad |
|---|---|---|
| `/` | **Sala de control** — plano + cola de alertas | P0 |
| `/resident/:id` | Ficha del residente: vitales, historial, reporte IA | P0 |
| `/cameras` | Vista de cámaras (Unity WebGL embebido) | P1 |
| `/admin` | Indicadores del centro, cuidadores, tiempos de respuesta | P2 |

## 3. Sala de control (`/`)

```
┌────────────────────────────────────────────────────────────────┐
│ VESTA CARE   ELEAM Vesta Demo        ● En línea   14:32  🔔    │
├──────────────────────────────────────┬─────────────────────────┤
│                                      │  ALERTAS ACTIVAS   (2)  │
│        PLANO CENITAL                 │ ┌─────────────────────┐ │
│                                      │ │ 🔴 CRÍTICA          │ │
│    ○ ○      ●← crítica parpadeando   │ │ Hipoglicemia severa │ │
│       ○  ○                           │ │ Carmen Soto · H-104 │ │
│  ○        ○     ○                    │ │ hace 00:12          │ │
│                                      │ │ [ ME HAGO CARGO ]   │ │
│                                      │ └─────────────────────┘ │
│  Verde: normal · Ámbar: advertencia  │ ┌─────────────────────┐ │
│  Rojo: crítica · Azul: atendida      │ │ 🟠 ADVERTENCIA  ... │ │
└──────────────────────────────────────┴─────────────────────────┘
```

### 3.1 Plano
SVG generado desde `/v1/facility`. Zonas como polígonos, residentes como círculos posicionados
con `position.x/y` escalado a `bounds`. Transición CSS de 1 s para que el movimiento se vea
fluido pese a recibir datos a 1 Hz.

Click en un residente → panel lateral con sus vitales en vivo. Doble click → ficha completa.
Una zona con alerta crítica se tiñe de rojo tenue completa, no solo el punto: así se ve de lejos.

### 3.2 Cola de alertas
Ordenada por severidad y luego por antigüedad. Cada tarjeta muestra residente, zona, motivo,
tiempo transcurrido corriendo en vivo, y el botón de acción. Tras el ACK la tarjeta pasa a azul
y muestra quién se hizo cargo, sin desaparecer.

## 4. Ficha del residente (`/resident/:id`)

- Encabezado: foto, nombre, edad, habitación, movilidad, etiquetas
- Cuatro gráficos de línea (HR, SpO2, glucosa, temperatura) de las últimas 2 h, con bandas de
  rango normal pintadas de fondo — así una anomalía se ve sin leer números
- Línea de tiempo de alertas del día
- Bloque **"Reporte del día"** con botón para generar, estado de carga, y el `disclaimer`
  del backend siempre visible

## 5. Cámaras (`/cameras`)

`<iframe>` con el build WebGL en `public/sim/`. Selector de cámara arriba; al cambiar se envía
`postMessage({ action: "setCamera", cameraId })`. Al abrir una alerta crítica cuya zona tiene
`camera_id`, aparece un botón **"Ver cámara"** que lleva acá con esa cámara ya activa.

Si el `iframe` no carga en 10 s, se muestra un placeholder que dice que el módulo de cámaras
está desconectado. **Nunca una pantalla en blanco.**

## 6. Conexión de datos

Todo pasa por `src/lib/api.ts`. Ningún componente hace `fetch` por su cuenta.

- Un único WebSocket a `/v1/stream`, con reconexión exponencial (1s, 2s, 4s, máx 10s)
- El estado vive en un store (Zustand o `useReducer` + Context; no hace falta Redux)
- Los tipos de TypeScript se escriben a mano espejando `02-DATA-CONTRACTS.md`, en
  `src/lib/types.ts`, en el mismo orden que el documento para poder compararlos de un vistazo
- Mensaje con `type` desconocido → se ignora en silencio

Indicador de conexión en la barra superior: **En línea** / **Reconectando** / **Modo autónomo**
(este último cuando `sim.status.connected === false`).

## 7. Criterios de aceptación

- [ ] El plano renderiza las zonas y posiciones correctas desde `/v1/facility`
- [ ] Los residentes se mueven con transición fluida, sin saltos bruscos
- [ ] Una alerta crítica aparece en menos de 1 s desde el mensaje del WebSocket
- [ ] El ACK funciona y se propaga a una segunda pestaña abierta en paralelo
- [ ] Legible desde 3 metros en un proyector (probarlo de verdad, no estimarlo)
- [ ] Al cortar el backend, la UI muestra "Reconectando" y conserva el último estado
- [ ] Todos los textos en español, sin cadenas en inglés sueltas
