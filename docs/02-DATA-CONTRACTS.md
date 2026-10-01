# 02 · Contratos de datos

> **Fuente de verdad.** App, servidor y tools del agente se desarrollan en paralelo contra este
> documento. Si un campo no está aquí, no existe.
>
> **Congelación: 10:00 del día del evento.** Después, solo campos opcionales nuevos.

## 1. Convenciones

- Timestamps en **UTC ISO-8601 con `Z`**; horas del día (`"08:00"`) en **hora local de Chile**
- IDs con prefijo: `usr_01`, `med_03`, `act_12`, `evt_55`, `int_09`
- Todos los campos son obligatorios salvo que diga `opcional`

## 2. Usuario

```json
{
  "user_id": "usr_01",
  "nombre": "Juanito",
  "edad": 78,
  "comuna": "Ñuñoa",
  "preferencias": {
    "agente": "emilia",
    "tamano_texto": "grande",
    "voz_activa": true,
    "velocidad_voz": 0.9,
    "tratamiento": "usted"
  },
  "contacto_emergencia": { "nombre": "Pilar (hija)", "telefono_e164": "+56912345678" }
}
```

`agente` ∈ `mateo` · `emilia` — define nombre, género gramatical y voz. Ver
`03-MODULE-ASISTENTE.md` §2.
`tamano_texto` ∈ `normal` · `grande` · `muy_grande` (ver `08-ACCESSIBILITY.md` §3)
`tratamiento` ∈ `tu` · `usted` — el asistente ajusta su registro según esto.

El servidor expone además, en `GET /v1/perfil`, un bloque derivado que el frontend usa para no
escribir nunca el nombre a mano:

```json
"asistente": {
  "id": "emilia", "nombre": "Emilia", "genero": "f",
  "parentesco": "sobrina", "articulo": "tu sobrina", "avatar_url": "/avatars/emilia.png"
}
```

## 3. Medicamento

```json
{
  "medication_id": "med_03",
  "user_id": "usr_01",
  "nombre": "Losartán",
  "dosis": "50 mg",
  "forma": "comprimido",
  "horarios": ["08:00", "20:00"],
  "dias": ["lun","mar","mie","jue","vie","sab","dom"],
  "instrucciones": "Con el desayuno",
  "stock_actual": 24,
  "stock_alerta": 7,
  "color": "#2563EB",
  "activo": true
}
```

`forma` ∈ `comprimido` · `capsula` · `jarabe` · `gotas` · `inyeccion` · `parche` · `otro`
`dias`: días de la semana en que corresponde. Vacío = ninguno.
`color`: para distinguir visualmente en el pastillero. Nunca es el único distintivo.

## 4. Toma (registro)

```json
{
  "intake_id": "int_09",
  "medication_id": "med_03",
  "horario_programado": "2026-10-01T11:00:00Z",
  "estado": "tomada",
  "registrado_at": "2026-10-01T11:04:12Z",
  "origen": "notificacion"
}
```

`estado` ∈ `pendiente` · `tomada` · `omitida` · `pospuesta`
`origen` ∈ `notificacion` · `app` · `mateo`

Al registrar `tomada`, el servidor **descuenta 1 de `stock_actual`**. Si queda bajo
`stock_alerta`, genera un evento en la agenda: "Comprar Losartán".

## 5. Métrica de salud

```json
{
  "metric_id": "mtr_18",
  "user_id": "usr_01",
  "tipo": "presion",
  "valores": { "sistolica": 134, "diastolica": 82 },
  "unidad": "mmHg",
  "medido_at": "2026-10-01T12:30:00Z",
  "fuente": "manual",
  "nota": "Después de caminar"
}
```

`tipo` ∈ `presion` · `glucosa` · `peso` · `pasos` · `sueno` · `frecuencia_cardiaca` · `animo`
`fuente` ∈ `manual` · `mateo` · `dispositivo` · `simulado`

> `fuente: "simulado"` es obligatorio para cualquier dato de reloj en el demo, y la UI lo
> muestra. No se presenta un dato inventado como si viniera de un dispositivo real.

Para `animo`: `valores: { "nivel": 4 }` en escala 1-5. Mateo lo registra conversando, sin
preguntarlo como formulario.

## 6. Actividad comunitaria

```json
{
  "activity_id": "act_12",
  "titulo": "Taller de memoria y juegos de mesa",
  "categoria": "cognitiva",
  "descripcion": "Dos horas de juegos y ejercicios de memoria, con café al medio.",
  "organizador": "Club Adulto Mayor Ñuñoa",
  "inicio": "2026-10-04T18:00:00Z",
  "duracion_min": 120,
  "lugar": { "nombre": "Centro Cultural Ñuñoa", "direccion": "Av. Irarrázaval 4055",
             "comuna": "Ñuñoa" },
  "cupos_totales": 20,
  "cupos_disponibles": 7,
  "precio_clp": 0,
  "accesibilidad": ["sin_escaleras", "cerca_metro"],
  "imagen_url": "/activities/act_12.jpg"
}
```

`categoria` ∈ `fisica` · `cognitiva` · `social` · `creativa` · `salud` · `aire_libre`
`accesibilidad` ⊂ `sin_escaleras` · `cerca_metro` · `estacionamiento` · `bano_accesible` ·
`apoyo_auditivo` · `traslado_incluido`

## 7. Inscripción

```json
{
  "enrollment_id": "enr_04",
  "user_id": "usr_01",
  "activity_id": "act_12",
  "estado": "inscrito",
  "inscrito_at": "2026-10-01T13:00:00Z",
  "event_id": "evt_55"
}
```

`estado` ∈ `inscrito` · `cancelado` · `asistio` · `no_asistio`
Inscribirse **siempre** crea un evento en la agenda. `event_id` es esa referencia.

## 8. Evento de agenda

Unifica todo lo que ocupa tiempo en la vida del usuario.

```json
{
  "event_id": "evt_55",
  "user_id": "usr_01",
  "titulo": "Taller de memoria",
  "tipo": "actividad",
  "inicio": "2026-10-04T18:00:00Z",
  "duracion_min": 120,
  "lugar": "Centro Cultural Ñuñoa",
  "nota": "Llevar lentes",
  "recordatorios_min_antes": [1440, 60],
  "origen_ref": "act_12",
  "estado": "pendiente"
}
```

`tipo` ∈ `medicamento` · `actividad` · `hora_medica` · `personal` · `recado`
`estado` ∈ `pendiente` · `cumplido` · `cancelado`
`recordatorios_min_antes`: minutos antes del evento. `[1440, 60]` = un día antes y una hora antes.

## 9. Recordatorio

Se usa **dos veces con la misma forma**: el servidor lo agenda en APScheduler para enviarlo por
Web Push, y la PWA lo guarda en IndexedDB para su alarma en primer plano. Ver
`06-MODULE-AGENDA.md` §4.

```json
{
  "local_id": "rem_med_03_0800",
  "titulo": "Hora de tu Losartán",
  "cuerpo": "50 mg, un comprimido. Con el desayuno.",
  "trigger": { "tipo": "diario", "hora": "08:00" },
  "accion_ref": { "tipo": "medicamento", "id": "med_03" }
}
```

`trigger.tipo` ∈ `diario` · `semanal` · `fecha_unica`

## 10. Respuesta del asistente

El objeto más importante del sistema. Lo devuelve `POST /v1/asistente/mensaje`.

```json
{
  "texto": "Listo, le dejé el Losartán para las ocho de la mañana y las ocho de la tarde. Yo le aviso.",
  "audio_base64": "SUQzBAAAA...",
  "acciones": [
    { "tipo": "medicamento_creado", "id": "med_03",
      "programar_recordatorios": [
        { "local_id": "rem_med_03_0800", "titulo": "Hora de tu Losartán",
          "cuerpo": "50 mg, con el desayuno",
          "trigger": { "tipo": "diario", "hora": "08:00" },
          "accion_ref": { "tipo": "medicamento", "id": "med_03" } }
      ]
    }
  ],
  "sugerencias": ["Ver mi pastillero", "Agregar otro remedio"],
  "navegar_a": "/salud"
}
```

- **`acciones`**: lo que la app debe ejecutar en el teléfono. La app **debe ignorar tipos
  desconocidos** sin romperse.
- **`sugerencias`**: hasta 3 botones grandes de respuesta rápida. Reducen la necesidad de hablar.
- **`navegar_a`**: `opcional`. Si viene, la app ofrece ir a esa pantalla (no navega sola: un
  cambio de pantalla inesperado desorienta).

`acciones[].tipo` ∈ `medicamento_creado` · `toma_registrada` · `evento_creado` ·
`actividad_inscrita` · `metrica_registrada` · `recordatorio_creado`

## 10b. Lectura de foto — respuesta de `POST /v1/metrics/foto`

```json
{
  "tipo": "presion",
  "valores_detectados": { "sistolica": 134, "diastolica": 82, "pulso": 71 },
  "confianza": "alta",
  "requiere_confirmacion": true,
  "mensaje": "Leí 134 con 82. ¿Está bien?"
}
```

`confianza` ∈ `alta` · `media` · `baja`. **Nada se guarda en este endpoint.** El usuario confirma
y recién ahí la PWA llama a `POST /v1/metrics`. Si `confianza` es `baja`, la PWA abre el teclado
numérico con los valores precargados en vez de preguntar por sí o por no.

## 11. Endpoints

| Método | Ruta | Para qué |
|---|---|---|
| `POST` | `/v1/asistente/mensaje` | Texto o audio del usuario → respuesta (§10) |
| `POST` | `/v1/asistente/iniciar` | Saludo de apertura, contextual a la hora y pendientes |
| `GET` | `/v1/asistente/voces` | Muestra de 3 s de cada voz, para la pantalla de elección |
| `GET` | `/v1/perfil` | Usuario, preferencias y bloque `asistente` derivado |
| `PATCH` | `/v1/perfil` | Cambiar asistente, tamaño de texto, voz, tratamiento |
| `GET` | `/v1/medications` | Pastillero completo |
| `POST` | `/v1/medications` | Alta de medicamento |
| `PATCH` | `/v1/medications/{id}` | Editar o desactivar |
| `POST` | `/v1/medications/{id}/intake` | Body `{ "estado": "tomada" }` |
| `GET` | `/v1/medications/hoy` | Tomas del día con su estado |
| `GET` | `/v1/metrics?tipo=&desde=` | Serie de métricas |
| `POST` | `/v1/metrics` | Registrar una medición |
| `POST` | `/v1/metrics/foto` | Imagen del aparato → valores leídos **para confirmar**, no guardados |
| `GET` | `/v1/activities?categoria=&comuna=&desde=` | Catálogo filtrado |
| `POST` | `/v1/activities/{id}/enroll` | Inscribirse (crea el evento) |
| `GET` | `/v1/agenda?dia=YYYY-MM-DD` | Eventos del día |
| `POST` | `/v1/agenda` | Crear evento |
| `PATCH` | `/v1/agenda/{id}` | Marcar cumplido, cancelar |
| `GET` | `/v1/resumen/hoy` | Lo que la app necesita al abrir: tomas, eventos, alertas de stock |
| `POST` | `/v1/push/subscribe` | Guarda la suscripción Web Push del navegador |
| `DELETE` | `/v1/push/subscribe` | La elimina al revocar permisos |
| `GET` | `/v1/push/vapid-public-key` | Clave pública para suscribirse |
| `GET` | `/health` | `{ "status": "ok", "agente": true, "voz": true, "scheduler": true }` |

## 12. Tools del asistente

Nombres en español, a propósito. Firma, descripción y qué devuelven.

| Tool | Parámetros | Devuelve |
|---|---|---|
| `agregar_medicamento` | `nombre, dosis, horarios[], dias[]?, instrucciones?` | Medicamento + recordatorios a programar |
| `listar_medicamentos` | `solo_hoy: bool = True` | Lista con estado de cada toma |
| `registrar_toma` | `nombre_o_id, estado = "tomada"` | Toma registrada y stock restante |
| `registrar_metrica` | `tipo, valores, nota?` | Métrica + comparación con su promedio |
| `cambiar_asistente` | `cual` (`mateo` \| `emilia`) | Perfil actualizado; la PWA recarga voz y avatar |
| `resumen_salud` | `periodo = "semana"` | Agregados por tipo, en lenguaje natural |
| `buscar_actividades` | `categoria?, comuna?, desde?, hasta?` | Hasta 5 actividades |
| `inscribir_actividad` | `activity_id` | Inscripción + evento + recordatorios |
| `agendar_evento` | `titulo, inicio, tipo, lugar?, recordatorios?` | Evento + recordatorios |
| `consultar_agenda` | `dia = "hoy"` | Eventos ordenados |
| `avisar_contacto` | `mensaje` | Confirmación (P2; en el MVP solo prepara el mensaje) |

**Reglas para toda tool:**
1. Devuelve un `dict` serializable, nunca un objeto de ORM
2. Si falta un dato, **no lo inventa**: devuelve `{"falta": "horarios"}` y Mateo pregunta
3. Nunca borra nada sin confirmación explícita del usuario en la conversación
4. Toda tool que crea algo con hora devuelve los recordatorios a programar — se usan por los
   dos caminos (servidor y navegador)
5. Ninguna tool devuelve texto con el nombre del asistente escrito a mano: eso lo redacta el
   modelo, que ya sabe quién es
