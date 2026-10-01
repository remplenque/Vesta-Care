# Modelo de datos (Supabase)

> **Fuente de verdad:** `src/types/supabase.ts`, generado desde el proyecto Supabase (commit
> `5536197`, Baptiste). Este documento lo explica y lo conecta con el acta; **si difieren, manda
> el archivo generado**. No se edita a mano: se cambia el esquema en Supabase y se regeneran los
> tipos.
>
> ```bash
> npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_ID" > src/types/supabase.ts
> ```

## 1. Lo que los tipos no muestran

Los tipos generados solo ven columnas, relaciones y firmas de funciones del esquema `public`.
**No incluyen:** políticas RLS, restricciones `CHECK`, triggers, Realtime, Storage, ni el cuerpo
de las funciones. Las migraciones **no están en el repositorio** (ver `OPEN-ISSUES.md` #1). Por eso
los valores permitidos de abajo vienen del acta y hay que confirmarlos contra la base.

## 2. Tablas

`*` = opcional al insertar (tiene default o acepta `null`). Todas las tablas con `user_id`
referencian `profiles.id`.

| Tabla | Columnas | Relaciones | Para qué (acta) |
|---|---|---|---|
| `profiles` | `id`, `full_name*`, `birth_date*`, `phone*`, `timezone*`, `created_at*` | `id` = `auth.users.id` (acta §5) | El adulto mayor. Paciente demo: Don Luis |
| `emergency_contacts` | `id*`, `user_id`, `name`, `relation*`, `phone*`, `access_token*`, `created_at*` | — | Contactos que agrega el usuario. `access_token` abre la vista `/c/[token]` |
| `medical_records` | `id*`, `user_id`, `file_path*`, `extracted*` (json), `confirmed*`, `created_at*` | — | Ficha médica PDF y lo que Mateo extrajo. Nada se usa hasta `confirmed` |
| `conditions` | `id*`, `user_id`, `name`, `source*` | — | Condiciones: hipertensión, diabetes… |
| `medications` | `id*`, `user_id`, `name`, `dose*`, `schedule*` (json) | — | Pastillero |
| `modules` | `id`, `status`, `manifest*` (json) | — | Catálogo de módulos: un `ModuleManifest` por fila (acta §3) |
| `user_modules` | `user_id`, `module_id`, `enabled*`, `thresholds*` (json), `thresholds_source*`, `confirmed*` | `module_id` → `modules` | Módulos activos del usuario y sus umbrales personalizados |
| `readings` | `id*`, `user_id`, `module_id`, `metric`, `value`, `unit*`, `ts*`, `source*`, `metadata*` (json), `reading_group*` | `module_id` → `modules` | Cada lectura simulada. `reading_group` une valores que se miden juntos (sistólica + diastólica) |
| `alerts` | `id*`, `user_id`, `module_id`, `reading_id*`, `metric`, `value*`, `level`, `message`, `explanation*`, `status*`, `ts*`, `ack_at*` | `module_id` → `modules`, `reading_id` → `readings` | Alerta generada por el motor de reglas. `explanation` la redacta Mateo |
| `outbound_messages` | `id*`, `user_id`, `alert_id*`, `contact_id*`, `channel*`, `body`, `ts*` | `alert_id` → `alerts`, `contact_id` → `emergency_contacts` | Mensajes a contactos. Hoy solo WhatsApp **simulado** |
| `goals` | `id*`, `user_id`, `module_id*`, `description`, `target*` (json) | `module_id` → `modules` | Objetivos del usuario por módulo |
| `chat_messages` | `id*`, `user_id`, `role`, `content*`, `metadata*` (json), `ts*` | — | Historial con Mateo |

## 3. Funciones (RPC)

Firmas exactas del archivo generado. El comportamiento se infiere del nombre y del acta: **hay que
confirmarlo leyendo la función en Supabase**.

| Función | Argumentos | Devuelve | Rol en el flujo |
|---|---|---|---|
| `ingest_reading` | `p_user_id, p_module_id, p_metric, p_value`, opcionales `p_unit, p_ts, p_source, p_metadata, p_reading_group` | `text` | Entrada única de lecturas (reemplaza la Edge Function `ingest` del acta) |
| `ingest_bp` | `p_user_id, p_systolic, p_diastolic`, opcional `p_source` | `text` | Atajo para presión: dos lecturas con el mismo `reading_group` |
| `evaluate_level` | `thresholds` (json), `value` | `text` | El motor de reglas: compara un valor con umbrales y devuelve el nivel |
| `get_contact_view` | `p_token` | `json` | Vista del contacto por `access_token`, sin exponer tablas |
| `get_whatsapp_feed` | `p_since?` | filas con `contact_name`, `contact_phone`, `patient_name`, `body`… | Alimenta el simulador `/demo/whatsapp` |
| `reset_demo` | `p_mode`, `p_user_id?` | `json` | Deja el demo en un estado conocido. Valores de `p_mode`: por confirmar |

## 4. Flujo de una alerta (acta §7, sobre este esquema)

1. El simulador llama a `ingest_reading` (o `ingest_bp`) → fila en `readings`.
2. El motor de reglas aplica `evaluate_level` con `user_modules.thresholds`.
3. Si supera un umbral → fila en `alerts` con `level`, `metric`, `value` y `reading_id`.
4. Si es **crítica** → una fila en `outbound_messages` por contacto; el simulador la lee con
   `get_whatsapp_feed`; Web Push al usuario.
5. Mateo completa `alerts.explanation`. La PWA muestra "Estoy bien" / "Llamar"; al responder se
   escribe `ack_at` y cambia `status`.

**La alerta la decide el paso 2, nunca el LLM** (acta §4).

## 5. Valores esperados (según el acta; en la base son `text`)

| Columna | Valores |
|---|---|
| `modules.id` | `pillbox` · `bp` · `heart_rate` · `glucose` |
| `modules.status` | `active` · `proposed` |
| `readings.metric` | `dose_taken`, `dose_scheduled` (pastillero) · `systolic`, `diastolic` en mmHg (presión) · `bpm` · `mg_dl` |
| `alerts.level` | `warn` · `critical` |
| `outbound_messages.channel` | `whatsapp_sim` |
| `conditions.source` | `ficha` · `manual` |
| `alerts.status`, `readings.source`, `user_modules.thresholds_source`, `chat_messages.role` | No están en el acta: por confirmar |

Escenarios de alerta del demo (acta §3): dosis omitida > 30 min · presión 185/115 · FC < 45 o > 130
en reposo · glucosa < 70.

## 6. Cambios respecto del acta §5

El esquema real evolucionó; estos campos no estaban en el acta:

- `alerts`: `module_id`, `metric`, `value`, `explanation`, `status`, `ack_at` (el acta tenía `ack bool`)
- `readings`: `reading_group`, `metadata`
- `user_modules`: `thresholds_source`, `confirmed`
- `modules`: `status` como columna (el acta lo tenía dentro del manifiesto)
- `profiles`: `timezone`, `created_at` · `emergency_contacts`: `created_at`
- `chat_messages`: `metadata` · `outbound_messages`: `user_id`
- Funciones nuevas: `ingest_bp`, `get_contact_view`, `get_whatsapp_feed`, `reset_demo`
