# 07 · Plan de construcción

## 1. Prioridades

**Si hay que cortar, se corta de abajo hacia arriba, sin discutir en el momento.**

### P0: sin esto no hay demo
- Core: modelos, `POST /v1/events`, agenda + escalamiento con pruebas, check-in de caída,
  alertas con ACK, WS con `snapshot`, semilla y escenarios del demo
- Web: `/sim`, `/familia` (estado, alertas, línea de tiempo) y `/a/:id`
- Web `/`: recordatorio y check-in **con botones** (la voz puede faltar)
- Recorrido completo: escenario en `/sim` → check-in en `/` → alerta en `/familia` → ACK

### P1: lo que gana la hackathon
- WhatsApp real a un celular físico + escalamiento al secundario
- Voz en `/`: hablar recordatorios y escuchar respuestas
- Asistente con LLM: briefing del día y derivación de preguntas médicas
- Chat por Telegram con la persona

### P2: solo si sobra tiempo
- WhatsApp entrante con túnel
- Edición de agenda desde `/familia`
- Pausa del monitoreo desde `/`
- Alerta de bienestar por días sin conversar

## 2. Cronograma (desde las 10:45)

Los roles A, B y C los reparte el equipo.

| Hora | Hito | Quién |
|---|---|---|
| 10:45–11:15 | Leer `00`–`02`, crear `core/` y `web/`, `.env.example`, `.gitignore`, `scripts/dev.sh` | Todos |
| 11:00 | Activar los celulares en el sandbox de Twilio y crear el bot de Telegram | C |
| **12:00** | **🔒 Congelación de `02-DATA-CONTRACTS.md`** | Todos |
| 11:15–13:30 | Core: modelos, store, agenda + pruebas, reglas, alertas, WS | A |
| 11:15–13:30 | Web: `/sim`, `/familia`, `/a/:id` contra datos mock | B |
| 11:15–13:30 | Asistente: filtro determinista, fallback, prompt, notify | C |
| **13:30–14:30** | **🔗 Integración end-to-end. Nadie trabaja en otra cosa** | Todos |
| 14:30 | **Punto de control:** si no hay recorrido P0 completo, se corta todo P1 | Todos |
| 14:30–16:00 | P1: WhatsApp, voz en `/`, LLM, Telegram | Repartido |
| 16:00–16:30 | Pulido de textos y legibilidad en el proyector | Todos |
| 16:30–17:30 | Slides, **video de respaldo** y ensayo del demo **tres veces completas** | Todos |
| 17:30 | Congelación total: solo se arreglan fallos que rompan el demo | Todos |

## 3. Reglas de equipo

1. **Nadie espera a nadie.** Cada parte corre con datos falsos hasta la integración.
2. **Timebox de 45 minutos.** Si algo no muestra un resultado visible en ese plazo, se avisa.
3. **Una persona es dueña del demo.** Después de las 14:30 decide qué entra, con un solo
   criterio: *¿esto puede romper el recorrido de los 90 segundos?*
4. **Commits cada hora**, aunque el trabajo esté incompleto.
5. **Si algo funciona, no se refactoriza.**

## 4. Guion del demo (90 segundos)

Pantallas: el proyector muestra `/` (la casa de Don Luis) y `/familia` lado a lado. El operador
tiene `/sim` en su notebook y un celular con WhatsApp está a mano.

| Tiempo | Qué pasa |
|---|---|
| 0:00–0:15 | *"Don Luis tiene 78 años, vive solo y usa un reloj, un pastillero y BondUP. Ninguno habla con el otro."* |
| 0:15–0:30 | **Briefing:** el asistente saluda por voz y resume el día: medicación, CESFAM y taller de BondUP |
| 0:30–0:50 | **Medicación:** escenario `missed_medication`. Se repite el recordatorio, nadie abre el compartimento, y **suena el WhatsApp** de Carolina: "no ha confirmado su medicación". Se muestra el celular |
| 0:50–1:10 | **Caída:** escenario `fall`. `/` pregunta "¿Está bien?" con cuenta regresiva; nadie responde; la franja de `/familia` pasa a 🔴 y llega el WhatsApp |
| 1:10–1:20 | Carolina presiona **Me hago cargo**; todo cambia de estado |
| 1:20–1:30 | Alguien le dice al asistente *"¿me tomo otra pastilla?"*. Responde que lo vea con su médico y que le avisa a Carolina. Cierre |

**Cierre:** *"Vesta no reemplaza al reloj ni al pastillero: los une. Y no decide nada médico:
acompaña, recuerda y avisa, para que Don Luis siga viviendo en su casa."*

## 5. Si algo falla en vivo

| Falla | Reacción |
|---|---|
| No llega el WhatsApp | Se sigue sin pausa y se muestra el registro de la notificación en `/familia` |
| La voz no funciona | Se usan los botones; el asistente muestra el texto en grande |
| La IA no responde | El fallback responde (`fallback: true`); el guion no cambia |
| Se cae el WS | Se recarga la pestaña; el `snapshot` restaura el estado |
| Se cae todo | Se pone el **video de 60 s grabado antes de las 17:30** |

## 6. Checklist antes de presentar

- [ ] Celulares del demo activados en el sandbox de Twilio y con un mensaje de prueba recibido
- [ ] `PUBLIC_WEB_URL` con la IP del notebook en el hotspot, y link probado desde el celular
- [ ] Briefing probado con y sin red
- [ ] `/v1/demo/reset` ejecutado justo antes de subir
- [ ] Video de respaldo grabado
- [ ] Demo ensayado tres veces y cronometrado
