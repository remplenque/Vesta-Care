# Pendientes y riesgos

> Resultado de cruzar el acta, el esquema de Supabase (`src/types/supabase.ts`), la especificación
> v3 descartada y el código de `legacy/Mateo-main/`. Cada punto lo decide el equipo.

## 1. Bloqueantes

| # | Tema | Problema | Propuesta |
|---|---|---|---|
| 1 | **Migraciones fuera del repo** | Solo están los tipos generados. Un clon limpio no puede recrear la base, y RLS, `CHECK`, triggers y el cuerpo de las funciones no se pueden revisar | Commitear la carpeta `supabase/` (migraciones, `seed.sql`, funciones) o, como mínimo, un dump del esquema |
| 2 | **Sin tabla para Web Push** | El acta pide Web Push al usuario, pero el esquema no tiene dónde guardar las suscripciones del navegador | Agregar `push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)` y regenerar tipos |
| 3 | **"Dosis omitida > 30 min" no tiene disparador** | `ingest_reading` reacciona cuando llega una lectura. Una dosis omitida es una lectura que **no** llega, así que nada la evalúa | Job periódico (Supabase Cron / `pg_cron`) o que el simulador lo emita como escenario explícito. **Parcial:** el simulador de `/demo` emite `dose_missed` para el perfil que olvida remedios (Rosa) mientras está encendido |
| 4 | **Proveedor de LLM** | En uso: Anthropic `claude-haiku-4-5` vía AI SDK (`/api/mateo`), por créditos disponibles. Falta confirmarlo con el equipo | Cambiar de proveedor = otro paquete `@ai-sdk/*` y su clave; el prompt y los filtros (`src/lib/mateo/`) no cambian. El legacy usa Gemini |
| 5 | **Roles P1 / P2 / P3** | Sin asignar (acta §10). Tampoco quién presenta y quién opera el demo | Asignar ahora. Baptiste ya trabaja el esquema Supabase |

## 2. Por confirmar en la base

- Valores válidos de las columnas `text` sin enum: `alerts.status`, `readings.source`,
  `user_modules.thresholds_source`, `chat_messages.role`, `reset_demo(p_mode)`
  (`DATA-MODEL.md` §5).
- Qué devuelven `ingest_reading` e `ingest_bp` (`text`): ¿el id de la lectura, el nivel, el id de
  la alerta?
- Que RLS esté activo en todas las tablas con `user_id`, y que `get_contact_view` sea la única
  puerta de la vista del contacto.
- Bucket de Storage `medical-records` y Realtime en `readings`, `alerts` y `outbound_messages`
  (acta §5). No aparecen en los tipos.
- Estructura de `medications.schedule` y de `user_modules.thresholds` (json). Conviene fijarla en
  `DATA-MODEL.md` antes de que front, simulador y Mateo la interpreten distinto.

## 3. Restricciones de plataforma (aprendidas en la v3)

Siguen valiendo con Next.js + Supabase. Detalle en `archive/v3/`.

- **Una PWA no puede programar notificaciones locales** (`showTrigger` se retiró). Todo aviso con
  la app cerrada es Web Push desde el servidor, y necesita HTTPS e internet
  (`archive/v3/06-MODULE-AGENDA.md` §4.1).
- **Web Push en iOS** solo funciona desde 16.4 y con la PWA instalada en la pantalla de inicio. Los
  botones de acción en la notificación solo funcionan en Android. **Demo en Android con Chrome**
  (`archive/v3/01-ARCHITECTURE.md` §3).
- **HTTPS en el teléfono:** service worker, push y micrófono lo exigen. Desplegar en Vercel lo
  resuelve; para probar en local, un túnel (`legacy/vesta-v3/scripts/tunnel.sh`). La PWA
  instalada y la suscripción push quedan atadas al origen: si cambia la URL, hay que reinstalar.
- **Apple Health y Health Connect no tienen API web.** Refuerza la decisión de simular dispositivos.
  Si el jurado pregunta: `archive/v3/04-MODULE-HEALTH.md` §4.
- **Web Speech API:** `SpeechRecognition` solo existe en Chrome y Edge. Hace falta un respaldo de
  teclado (`archive/v3/03-MODULE-ASISTENTE.md` §6).

## 4. Ideas de la v3 que podrían sumarse

No están en el acta. Solo si sobra tiempo y el equipo lo aprueba.

- **Foto del tensiómetro:** el LLM multimodal lee el valor y el usuario confirma antes de llamar a
  `ingest_bp`. Muestra un dispositivo "real" sin hardware (`archive/v3/04-MODULE-HEALTH.md` §4).
- **Alarma en primer plano:** recordatorio que suena con la app abierta, sin red ni permisos.
  Respaldo si Web Push falla en vivo (`archive/v3/06-MODULE-AGENDA.md` §4.2).
- **Botón "Oír"** antes de que hable Mateo: desbloquea el autoplay del navegador.
- **Tokens de accesibilidad listos:** `legacy/vesta-v3/web/src/theme.ts`.
