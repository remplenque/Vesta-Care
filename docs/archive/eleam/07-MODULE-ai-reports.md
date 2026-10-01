# 07 · Módulo: Vesta Insight (reportes con IA)

**Archivo:** `core/app/reports.py`
**Responsabilidad única:** convertir series de datos en narrativa que un cuidador lea en 30 segundos.
**Lo que NO hace:** diagnosticar, recomendar tratamientos, ni sugerir medicación.

## 1. Para qué sirve

Un turno genera 86.400 puntos de datos por residente. Nadie los mira. El valor de la IA acá no es
predecir nada: es **que alguien lea los datos y escriba lo que pasó**, en castellano, para que el
turno siguiente tome el relevo sabiendo qué ocurrió.

Dos usos, en este orden de prioridad:

| Uso | Prioridad | Disparo |
|---|---|---|
| **Reporte diario por residente** | P1 | Manual, desde la ficha |
| **Triaje de alerta** — un párrafo de contexto en la tarjeta de la alerta | P2 | Automático al abrir una crítica |

## 2. Entrada: qué se le manda al modelo

**Nunca la serie cruda.** Se agrega primero, en Python, y se envía un resumen compacto:

```json
{
  "resident": { "name": "Carmen Soto", "age": 84, "mobility": "walker",
                "conditions_tags": ["diabetes_t2", "hipertension"] },
  "period": "2026-10-01",
  "vitals_summary": {
    "hr_bpm":       { "min": 58, "max": 134, "avg": 81, "time_out_of_range_min": 12 },
    "spo2_pct":     { "min": 91, "max": 99, "avg": 96, "time_out_of_range_min": 3 },
    "glucose_mgdl": { "min": 54, "max": 188, "avg": 121, "time_out_of_range_min": 22 },
    "temp_c":       { "min": 36.1, "max": 37.0, "avg": 36.5, "time_out_of_range_min": 0 }
  },
  "activity": { "hours_in_room": 14.2, "hours_common_areas": 2.1,
                "zone_changes": 18, "longest_inactivity_min": 95 },
  "alerts": [
    { "at": "14:32", "title": "Hipoglicemia severa", "severity": "critical",
      "ack_after_s": 38, "resolved_after_s": 420 }
  ],
  "baseline_comparison": { "activity_vs_7d_avg_pct": -31 }
}
```

Esta agregación es trabajo de Python, no del modelo. El modelo redacta; no calcula.

## 3. El prompt

Vive en `core/app/prompts/daily_report.md`, versionado, **nunca embebido en el código**.

```
Eres un asistente que redacta el resumen de jornada de un residente en un
establecimiento de larga estadía para adultos mayores en Chile, dirigido al
equipo de cuidado del turno siguiente.

Recibirás datos agregados de monitoreo. Tu tarea es describir lo que ocurrió.

REGLAS ESTRICTAS
- No diagnostiques. No nombres enfermedades que no estén en conditions_tags.
- No sugieras medicamentos, dosis ni tratamientos.
- No especules sobre causas clínicas. Describe el patrón, no su origen.
- Si los datos no alcanzan para afirmar algo, dilo explícitamente.
- Escribe en español de Chile, en tono profesional y claro, sin tecnicismos
  innecesarios. Un técnico en enfermería debe entenderlo sin releer.
- Máximo 120 palabras en "summary". Máximo 4 observaciones.
- Las sugerencias de seguimiento son organizativas (revisar horarios,
  comentar con el equipo clínico), nunca clínicas.

Responde ÚNICAMENTE con un objeto JSON válido, sin markdown ni texto previo,
con esta forma exacta:
{ "summary": str, "observations": [str], "suggested_follow_up": [str],
  "data_quality_note": str }
```

## 4. Llamada e integración

- Modelo: Claude vía la API de Anthropic, `max_tokens` 1000, temperatura baja
- Timeout de 20 s. Si expira, se devuelve el reporte cacheado o el de ejemplo
- La respuesta se parsea con `json.loads` tras quitar posibles cercos de código
- Si el parseo falla, **un solo reintento** pidiendo explícitamente JSON válido. Si vuelve a
  fallar, se devuelve el fallback. No se entra en un bucle de reintentos
- El `disclaimer` lo agrega el backend, no el modelo: es texto fijo y no negociable

## 5. Límites éticos y legales

Esto no es software médico y no puede presentarse como tal.

1. Todo reporte lleva: *"Apoyo a la decisión. No constituye diagnóstico médico."* — visible en
   pantalla, no en un tooltip
2. El modelo no nombra condiciones fuera de `conditions_tags`
3. El sistema no recomienda acciones clínicas, solo organizativas
4. Los datos son sintéticos y el reporte lo dice en `data_quality_note`
5. En el pitch se declara explícitamente: *"Esto asiste al equipo de cuidado, no lo reemplaza,
   y cualquier despliegue real requiere validación clínica y revisión regulatoria."*

Decir esto **suma**: un jurado con gente del área de salud va a castigar a cualquier equipo que
presente un LLM como si diagnosticara.

## 6. Caché y costo

Clave `(resident_id, date)`. Un reporte por residente por día. Un botón "regenerar" invalida la
entrada. Esto evita gastar llamadas y, sobre todo, evita que el demo dependa de la latencia de
red: **genera los reportes de los residentes del demo antes de presentar.**

## 7. Triaje de alerta (P2, solo si sobra tiempo)

Un párrafo de una o dos frases que se muestra en la tarjeta de la alerta crítica, con el contexto
reciente del residente: *"Es la segunda baja de glucosa de Carmen hoy; la anterior fue a las
09:15 y se resolvió sola."* Útil de verdad, pero es lo primero que se corta si el reloj aprieta.

## 8. Criterios de aceptación

- [ ] `POST /v1/reports/{id}` devuelve JSON válido conforme a `02-DATA-CONTRACTS.md` §10
- [ ] El reporte menciona la alerta del día y el cambio de actividad
- [ ] Nunca aparece un diagnóstico ni una recomendación de medicamento
- [ ] El `disclaimer` se renderiza siempre en el dashboard
- [ ] Sin `ANTHROPIC_API_KEY`, se devuelve el reporte de ejemplo marcado como tal
- [ ] El caché evita una segunda llamada para el mismo residente y día
