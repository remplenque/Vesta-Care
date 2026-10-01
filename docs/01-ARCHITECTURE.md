# 01 · Arquitectura

## 1. Vista general

```
┌───────────────────────────────────────────────────────────────────┐
│                     PWA  (Vite + React + TypeScript)              │
│              instalada en la pantalla de inicio del teléfono      │
│                                                                   │
│  ┌────────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐    │
│  │ ASISTENTE  │  │ Mi salud │  │ Mi agenda│  │   Comunidad   │    │
│  │Mateo/Emilia│  │pastillero│  │calendario│  │  actividades  │    │
│  └────────────┘  └──────────┘  └──────────┘  └───────────────┘    │
│          │             │             │              │             │
│          └─────────────┴──────┬──────┴──────────────┘             │
│                         lib/api.ts                                │
│                                                                   │
│  IndexedDB  ← copia offline del día (pastillero, agenda)          │
│  Service Worker  ← app shell cacheada + recepción de push         │
│  lib/alarma.ts   ← ★ alarma en primer plano, respaldo que no falla │
└────────────────────────────┬──────────────────────────────────────┘
                             │  HTTPS/JSON        ▲  Web Push (VAPID)
                             ▼                    │
┌───────────────────────────────────────────────────────────────────┐
│               SERVIDOR Flask  (heredado de Mateo-main)            │
│               sirve también los estáticos de la PWA               │
│                                                                   │
│  /asistente/mensaje ──► AGENTE (Pydantic AI + Gemini)             │
│                               │ elige y ejecuta tools             │
│      ┌──────────────┬─────────┴────┬──────────────┐               │
│      │  health.py   │  agenda.py   │ community.py │               │
│      └──────┬───────┴──────┬───────┴──────┬───────┘               │
│             └──────────────┴──────────────┘                       │
│                      store.py (SQLite)                            │
│                            │                                      │
│   scheduler.py (APScheduler) ──► push.py ──► notificación         │
│   voice.py ──► ElevenLabs (dos voces)                             │
└───────────────────────────────────────────────────────────────────┘
```

## 2. El principio central: una sola fuente, dos caminos

Cada módulo expone **la misma lógica** por dos vías:

| Vía | Quién la usa | Ejemplo |
|---|---|---|
| **Endpoint REST** | Las pantallas | `POST /v1/medications` desde el formulario |
| **Tool del agente** | El asistente, cuando el usuario habla | `agregar_medicamento(...)` |

Ambas llaman a la **misma función de `modules/`**. Nunca se duplica lógica.

```python
# modules/health.py  ← la lógica vive acá, una sola vez
def add_medication(user_id: str, nombre: str, dosis: str, horarios: list[str]) -> Medication: ...

# app.py            ← camino táctil
@app.route("/v1/medications", methods=["POST"])
def create_medication(): return jsonify(health.add_medication(**request.json))

# agent/tools.py    ← camino conversacional
@asistente.tool
def agregar_medicamento(ctx, nombre: str, dosis: str, horarios: list[str]) -> dict:
    """Agrega un medicamento al pastillero del usuario."""
    return health.add_medication(ctx.deps.user_id, nombre, dosis, horarios).model_dump()
```

Es **la decisión de arquitectura más importante del proyecto**. Si se rompe, terminan con un
chatbot que dice cosas y una app que no se entera.

## 3. Por qué PWA, y qué cuesta

### Lo que se gana
- Se desarrolla con herramientas que el equipo ya domina, y se recarga en un segundo
- No hay build nativo, ni tienda, ni dispositivo de prueba obligatorio
- Un solo origen: Flask sirve la API y los estáticos, cero CORS
- El jurado la abre en su propio teléfono escaneando un QR, sin instalar nada

### Lo que cuesta, y hay que diseñarlo bien
**La web no puede programar una notificación local.** La API que lo permitía (Notification
Triggers, `showTrigger`) fue un experimento y Chrome la retiró. No hay reemplazo.

Consecuencias concretas:

| Necesidad | En web |
|---|---|
| Recordatorio con la app cerrada | **Solo con Web Push desde el servidor.** Requiere HTTPS, VAPID y que el teléfono tenga internet |
| Recordatorio con la app abierta | Un temporizador en JS. Siempre funciona, sin permisos ni red |
| Despertar el service worker solo | `periodicSync` es solo Chrome y está muy limitado. **No se depende de eso** |
| Push en iOS | Solo iOS 16.4+ **y solo si la PWA está agregada a la pantalla de inicio** |
| Botones de acción en la notificación | Chrome en Android sí. iOS no |

**Por eso el demo se hace en Android con Chrome**, y por eso existe la alarma en primer plano
(`06-MODULE-AGENDA.md` §4), que es el camino que no falla nunca.

## 4. Flujos

### 4.1 Conversación
1. La PWA graba audio o toma texto → `POST /v1/asistente/mensaje`
2. El servidor transcribe si viene audio y corre el agente con el historial
3. El agente decide: ¿conversar, o invocar una tool?
4. Si invoca, la tool modifica SQLite y devuelve un resultado estructurado
5. El servidor responde con `{ texto, audio_base64, acciones[], sugerencias[] }`
6. La PWA reproduce el audio, muestra el texto y **aplica las acciones**: si hubo un
   `recordatorio_creado`, lo guarda en IndexedDB y arma la alarma local

### 4.2 Recordatorio de medicamento — los dos caminos
```
         El asistente crea el medicamento
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
  CAMINO A (servidor)         CAMINO B (navegador)
  APScheduler agenda la       Se guarda en IndexedDB y,
  hora exacta                 si la app está abierta,
        │                     un temporizador la vigila
        ▼                           │
  A la hora: push.py envía           ▼
  Web Push al navegador        A la hora: alarma en
        │                      pantalla + sonido
        ▼                      (sin red, sin permisos)
  El SW muestra la notificación
  con botón "Ya me lo tomé"
```

**B se construye primero.** Es media hora de trabajo, no depende de nada y es lo que salva el
demo si el push falla. A es lo correcto para producción y es lo que se muestra si funciona.

### 4.3 Inscripción a una actividad
El asistente busca con `buscar_actividades` → el usuario elige → `inscribir_actividad` crea la
inscripción, genera el evento en la agenda y devuelve los recordatorios que se programan por
ambos caminos. Una frase del usuario, tres cosas que pasan.

## 5. Decisiones técnicas

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| PWA | Expo / React Native | Más rápido para este equipo. Se asume el costo de los recordatorios (§3) |
| Flask sirve la PWA | Servidor estático aparte | Un proceso, un origen, cero CORS, un solo túnel HTTPS |
| Vite + React | Django templates, vanilla JS | Componentes reutilizables y `vite-plugin-pwa` resuelve el SW |
| Reutilizar el Flask de Mateo | Backend nuevo | El agente ya corre ahí |
| SQLite | Postgres, Firebase | Cero instalación, cero cuenta |
| APScheduler en proceso | Celery, cron | Una dependencia, cero infraestructura |
| IndexedDB (`idb-keyval`) | localStorage | localStorage es síncrono y chico; esto son listas con fechas |
| Túnel HTTPS para el demo | Certificado autofirmado | Los navegadores rechazan push con certificados no confiables |
| Tools en español | Tools en inglés | El modelo razona sobre intención en castellano |
| Sin login | Auth con cuentas | No aporta al demo. Un perfil sembrado, declarado como deuda |

## 6. HTTPS: el requisito que hay que resolver antes

Service Workers, Web Push y el micrófono **exigen contexto seguro**. `localhost` cuenta, pero el
teléfono no entra por localhost.

| Opción | Sirve para | Problema |
|---|---|---|
| **Túnel (`cloudflared` o `ngrok`)** | Todo: push, SW, micrófono | **Necesita internet en el lugar** |
| IP local con certificado autofirmado | SW y micrófono si se acepta la excepción | Push no funciona |
| IP local por HTTP plano | Nada de lo anterior | Inútil |

> ⚠️ **Tensión que hay que asumir:** Web Push obliga a tener internet, lo que contradice la
> regla de no confiar en el WiFi del evento. Por eso la **alarma en primer plano es la que se
> demuestra sí o sí**, y el push es el extra que se muestra si la red acompaña.
>
> **Mitigación:** levantar el túnel de `cloudflared` la noche anterior, dejar la URL fija y
> probar con datos móviles del celular, no con el WiFi del lugar.

## 7. Estado y offline

- **Fuente de verdad:** SQLite en el servidor
- **IndexedDB** guarda el pastillero y la agenda del día. Al abrir, la PWA sincroniza; si falla,
  muestra la copia local con un aviso discreto
- **Service worker** precachea el app shell (`vite-plugin-pwa`, estrategia `autoUpdate`) y cachea
  los GET de la API con `NetworkFirst`
- **Las escrituras sin red se encolan** en IndexedDB y se reenvían al reconectar. Aplica sobre
  todo a `registrar_toma`: que el usuario marque su pastilla sin señal y que no se pierda

## 8. Degradación

| Si falla… | El sistema… | Qué ve el usuario |
|---|---|---|
| No hay internet | Pastillero y agenda del día desde IndexedDB; la alarma en primer plano suena igual | Aviso "sin conexión", todo lo demás anda |
| No hay permiso de notificaciones | Alarma en primer plano, más un aviso suave y permanente | "Los avisos están apagados. Tóquelo para activarlos" |
| Gemini no responde | Mensaje fijo y los botones de los módulos | "Ahora no le puedo escuchar, pero puede tocar aquí" |
| ElevenLabs falla | `speechSynthesis` del navegador | Otra voz, menos cálida, pero habla |
| Falla la transcripción | Se abre el teclado con lo que se alcanzó a entender | Puede corregir y enviar |

**Nunca** una pantalla en blanco, nunca un mensaje técnico, nunca la palabra "error".

## 9. Despliegue

```bash
./scripts/dev.sh          # Vite en :5173 con proxy a Flask en :5000
./scripts/tunnel.sh       # cloudflared → URL HTTPS pública para el teléfono
npm run build             # web/dist, que Flask sirve en producción/demo
```

```
PUBLIC_BASE_URL=https://xxxx.trycloudflare.com
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID_MATEO=
ELEVENLABS_VOICE_ID_EMILIA=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:equipo@vesta.cl
DEMO_MODE=true
VESTA_USER_ID=usr_01
```

## 10. Deuda técnica consciente

- Un solo usuario sembrado, sin autenticación ni multiperfil
- Sin integración nativa con plataformas de salud (ver `04-MODULE-HEALTH.md` §4)
- Los recordatorios con la app cerrada dependen de internet
- Sin sincronización entre dispositivos ni respaldo en la nube
- El catálogo de actividades es un JSON sembrado
- Sin validación con usuarios reales — es lo primero que haríamos después
