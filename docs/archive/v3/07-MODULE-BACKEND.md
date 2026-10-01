# 07 · Módulo: Servidor

**Carpeta:** `server/` · **Stack:** Flask (heredado de Mateo-main), Pydantic v2, SQLite,
APScheduler, pywebpush
**Responsabilidad única:** guardar la verdad, ejecutar el agente, disparar los recordatorios y
servir la PWA.

## 1. Punto de partida

**No se parte de cero.** `legacy/Mateo-main/Backend/app.py` ya tiene Flask + CORS, el agente Pydantic
AI con Gemini, `call_elevenlabs()` funcionando y el patrón de respuesta con audio en base64.

Plan de migración, en orden:
1. Copiar `Backend/app.py` a `server/app.py`, dejando vivos `/health`, `/start`, `/respond`
2. Extraer el agente a `server/agent/asistente.py` y el prompt a `prompts/asistente.md`
3. Extraer `call_elevenlabs()` a `server/voice.py` y **parametrizar el `voice_id`** (dos voces)
4. Crear `server/store.py` con SQLite y las tablas de §3
5. Crear los tres módulos y **sus tools** — acá está el trabajo nuevo real
6. Agregar `scheduler.py` y `push.py`
7. Servir `web/dist` desde Flask (§6)
8. Renombrar `/start` → `/v1/asistente/iniciar` y `/respond` → `/v1/asistente/mensaje`,
   manteniendo los viejos como alias

> El historial de conversación en `Mateo-main` es una **variable global**. Funciona para un
> usuario y para un demo. **Déjalo así.** Arreglarlo cuesta tiempo y no cambia lo que el jurado ve.

## 2. Estructura

```
server/
├── app.py              rutas HTTP + estáticos. Nada de lógica de negocio
├── agent/
│   ├── asistente.py    agente Pydantic AI
│   ├── persona.py      ★ Mateo / Emilia: nombre, género, voice_id
│   ├── tools.py        ★ todas las tools
│   └── prompts/asistente.md
├── modules/
│   ├── health.py       pastillero, métricas, lectura de foto
│   ├── community.py    actividades e inscripciones
│   └── agenda.py       eventos y cálculo de recordatorios
├── scheduler.py        ★ APScheduler
├── push.py             ★ Web Push (VAPID)
├── store.py            SQLite
├── models.py           Pydantic, espeja 02-DATA-CONTRACTS.md
├── voice.py            ElevenLabs, dos voces
└── seed.py             carga shared/seed/*.json
```

**Regla estructural:** `app.py` y `tools.py` **nunca** contienen lógica de negocio. Ambos llaman
a `modules/`. Si una validación aparece en los dos, está en el lugar equivocado.

## 3. Base de datos

SQLite, archivo `vesta.db`. Tablas espejo de `02-DATA-CONTRACTS.md`:

```sql
users(user_id, nombre, edad, comuna, preferencias_json, contacto_json)
medications(medication_id, user_id, nombre, dosis, forma, horarios_json, dias_json,
            instrucciones, stock_actual, stock_alerta, color, activo)
intakes(intake_id, medication_id, horario_programado, estado, registrado_at, origen)
metrics(metric_id, user_id, tipo, valores_json, unidad, medido_at, fuente, nota)
activities(activity_id, titulo, categoria, descripcion, organizador, inicio, duracion_min,
           lugar_json, cupos_totales, cupos_disponibles, precio_clp, accesibilidad_json,
           imagen_url)
enrollments(enrollment_id, user_id, activity_id, estado, inscrito_at, event_id)
events(event_id, user_id, titulo, tipo, inicio, duracion_min, lugar, nota,
       recordatorios_json, origen_ref, estado)
push_subscriptions(sub_id, user_id, endpoint, p256dh, auth, creado_at)
```

Los eventos de tipo `medicamento` **no se persisten**: se derivan de `medications` al vuelo.

## 4. El endpoint que importa

`POST /v1/asistente/mensaje` concentra la complejidad:

```python
@app.route("/v1/asistente/mensaje", methods=["POST"])
def asistente_mensaje():
    texto = request.json.get("texto")
    audio_b64 = request.json.get("audio_base64")

    if audio_b64 and not texto:
        texto = transcribir(audio_b64)              # Gemini acepta audio directo

    persona = PERSONAS[perfil.preferencias.agente]  # mateo | emilia
    contexto = resumen_del_dia(USER_ID)
    resultado = asistente.run_sync(
        texto,
        deps=Deps(user_id=USER_ID, contexto=contexto, persona=persona),
        message_history=chat_history,
    )

    acciones = recolectar_acciones(resultado)       # ← lo que devolvieron las tools
    programar_en_scheduler(acciones)                # ← camino A de los recordatorios
    audio = sintetizar(resultado.output.texto, persona["voice_id"])

    return jsonify({
        "texto": resultado.output.texto,
        "audio_base64": audio,
        "acciones": acciones,                       # ← camino B: la PWA los arma localmente
        "sugerencias": resultado.output.sugerencias[:3],
        "navegar_a": resultado.output.navegar_a,
    })
```

**`recolectar_acciones` es la pieza clave.** Cada tool que crea algo con hora devuelve, además
del objeto, los recordatorios a programar. Esa lista se usa **dos veces**: el servidor la agenda
en APScheduler y la PWA la guarda en IndexedDB para su alarma local. Si esto no funciona, el
asistente dice que creó un recordatorio y nunca suena nada — la peor falla posible.

## 5. Scheduler

`APScheduler` con `BackgroundScheduler`, arrancado junto a Flask.

```python
scheduler = BackgroundScheduler(timezone="America/Santiago")
```

- **Es el único lugar del sistema que trabaja en hora local.** Todo lo demás es UTC. El resto de
  los horarios se guarda como `"08:00"` en hora de Chile y se interpreta acá
- IDs determinísticos (`rem_med_03_0800`) con `replace_existing=True`: reprogramar no duplica
- Jobs en memoria, no persistidos. Al reiniciar el servidor se reconstruyen desde la base en el
  arranque, con `reprogramar_todo()`
- Para medicamentos, `CronTrigger`; para eventos puntuales, `DateTrigger`

> ⚠️ **Flask en modo debug recarga el proceso y duplica el scheduler.** Arrancarlo con
> `use_reloader=False` o detrás de un guard. Es el bug clásico y cuesta media hora encontrarlo
> a las 16:00.

## 6. Servir la PWA

Flask sirve `web/dist` para que haya **un solo origen y un solo túnel HTTPS**:

```python
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def spa(path):
    full = os.path.join(DIST, path)
    if path and os.path.exists(full):
        return send_from_directory(DIST, path)
    return send_from_directory(DIST, "index.html")   # fallback de rutas del cliente
```

Dos cuidados:
- **`/sw.js` y `/manifest.webmanifest` se sirven desde la raíz**, nunca desde `/static/`. Un
  service worker solo controla desde su propio directorio hacia abajo
- `Service-Worker-Allowed: /` y `Cache-Control: no-cache` para `sw.js`, o el navegador se queda
  con una versión vieja y nadie entiende por qué no se actualiza

En desarrollo se usa el dev server de Vite con proxy a `:5000`; `web/dist` solo se sirve para el
demo.

## 7. Rendimiento y timeouts

| Operación | Presupuesto | Si se pasa |
|---|---|---|
| Transcripción | 3 s | Se pide escribir |
| Agente sin tools | 4 s | Respuesta fija de reintento |
| Agente con tools | 8 s | Idem |
| Lectura de foto (Gemini) | 6 s | Se abre el teclado numérico |
| ElevenLabs | 5 s | Se devuelve sin audio; la PWA usa `speechSynthesis` |
| Cualquier endpoint REST | 300 ms | Es SQLite local, no debería ocurrir |

Mientras el asistente piensa, la PWA muestra que está pensando — con una animación suave, nunca
un spinner técnico ni la palabra "cargando".

## 8. Criterios de aceptación

- [ ] `/health` reporta estado del agente, la voz y el scheduler
- [ ] Las 10 tools de `02-DATA-CONTRACTS.md` §12 están registradas y probadas
- [ ] `recolectar_acciones` devuelve recordatorios programables en cada creación con hora
- [ ] El scheduler dispara una push real a la hora exacta, sin duplicados tras reiniciar
- [ ] Flask sirve la PWA y el service worker se registra desde la raíz
- [ ] Sin `GEMINI_API_KEY`, el servidor arranca y los endpoints REST funcionan
- [ ] Sin `ELEVENLABS_API_KEY`, se responde con `audio_base64: null` sin romper nada
- [ ] Cambiar de asistente cambia la voz sin reiniciar nada
- [ ] `seed.py` deja la base lista para el demo en un comando
- [ ] Ninguna lógica de negocio vive en `app.py` ni en `tools.py`
