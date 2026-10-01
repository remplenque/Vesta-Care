# 09 · Plan de construcción

## 1. Prioridades

**Si hay que cortar, se corta de abajo hacia arriba. Sin discusión en el momento.**

### P0 — Sin esto no hay demo
- PWA que carga, instalable, con el tema accesible aplicado
- Pantalla de elección Mateo / Emilia, con muestra de voz
- Chat de texto funcionando contra el agente
- Tres tools: `agregar_medicamento`, `listar_medicamentos`, `registrar_toma`
- Pastillero con vista del día y botón "Ya me lo tomé"
- **Alarma en primer plano que suena y toma la pantalla** (`06-MODULE-AGENDA.md` §4.2)
- Datos sembrados para que ninguna pantalla esté vacía

### P1 — Esto es lo que gana
- Voz: entrada por micrófono y salida con ElevenLabs, con las dos voces
- **Web Push real** con el scheduler del servidor
- **Foto del tensiómetro** leída por Gemini
- Comunidad con catálogo e inscripción que entra a la agenda
- Vista de agenda del día unificada
- Prompt de instalación en la pantalla de inicio

### P2 — Solo si sobra
- Entrada por Web Bluetooth
- Modo compañía pulido con historial de temas
- Resumen semanal para la familia
- Filtros y recomendación en Comunidad
- Cola de escrituras offline

## 2. Antes del evento

**Lo primero de esta lista es lo más importante.**

- [ ] **Levantar un túnel HTTPS y probar una Web Push en un teléfono Android real.** Si eso
      funciona una vez, el camino A está validado. Si no, se va solo con la alarma en primer
      plano y se decide **ahora**, no el día del evento
- [ ] Generar las claves VAPID y guardarlas en `.env`
- [ ] Elegir y probar las **dos voces de ElevenLabs** (una masculina, una femenina, ambas es-CL
      o neutras). Guardar los dos `voice_id`
- [ ] Probar que Gemini lee un tensiómetro real desde una foto de celular. Si falla con el
      aparato que tienen, se sabe antes y no se promete
- [ ] Verificar que las claves de Gemini y ElevenLabs siguen activas
- [ ] Confirmar que el agente de `legacy/Mateo-main/` responde (ver `legacy/README.md`)
- [ ] Escribirle a Michelle de BondUp
- [ ] Teléfono del demo: **Android con Chrome**, cargado, con el túnel probado
- [ ] Repositorio con esta documentación y la estructura de carpetas
- [ ] Revisar las bases del evento sobre trabajo previo

## 3. Cronograma del día

| Hora | Hito | Quién |
|---|---|---|
| 09:00 | Clonar, levantar servidor y Vite, túnel arriba, todos corriendo | Todos |
| **10:00** | **🔒 Congelación de contratos.** `02-DATA-CONTRACTS.md` se cierra | Todos |
| 10:00–12:00 | Servidor: `store.py`, `persona.py`, `health.py` y las 3 tools P0 | Vicente |
| 10:00–12:00 | PWA: manifest, service worker, tema accesible, elección de asistente | Baptiste |
| 10:00–11:00 | **Alarma en primer plano. Nada más hasta que suene** | Luis-Felipe |
| **11:00** | **Punto de control: ¿sonó una alarma en un teléfono?** Si no, es prioridad absoluta de todo el equipo hasta que suene | Todos |
| 11:00–13:00 | Web Push: VAPID, suscripción, scheduler | Luis-Felipe |
| 12:00–14:00 | Pastillero completo conectado a las tools | Vicente + Baptiste |
| 13:00–14:00 | Comunidad: catálogo, inscripción, seed | Luis-Felipe |
| **14:00–15:00** | **🔗 Integración. Nadie trabaja en otra cosa** | Todos |
| 15:00 | **Corte:** sin recorrido completo, se abandona todo P1 | Todos |
| 15:00–16:00 | Voz (entrada y salida), foto del tensiómetro, agenda del día | Repartido |
| 16:00–16:30 | Accesibilidad: checklist de `08` en cada pantalla, **probada instalada** | Todos |
| 16:30–17:30 | Slides y ensayo del demo **tres veces completas** | Todos |
| 17:30 | Congelación total. Solo arreglos que salven el demo | Todos |

## 4. Reglas de equipo

1. **Nadie espera a nadie.** Cada módulo corre con datos sembrados.
2. **El contrato se congela a las 10:00.** Después, solo campos opcionales nuevos.
3. **Timebox de 45 minutos** sin resultado visible → se avisa y se busca otro camino.
4. **Una persona es dueña del demo.** Después de las 15:00 decide qué entra, con un criterio:
   *¿esto puede romper el recorrido de dos minutos?*
5. **Si funciona, no se refactoriza.**
6. **Nada se da por terminado sin pasar el checklist de accesibilidad.**
7. **Nadie escribe "Mateo" ni "Emilia" a mano en el código.** Revisión rápida:
   `grep -ri "mateo\|emilia" web/src`

## 5. Guion del demo (2 minutos)

| Tiempo | Qué pasa |
|---|---|
| 0:00–0:15 | *"Mi abuela necesitaría cinco aplicaciones para esto. Nosotros hicimos una, y no se navega: se le habla."* Se muestra el teléfono con la app **ya instalada en la pantalla de inicio** |
| 0:15–0:30 | Pantalla de elección: se tocan las dos voces, se elige Emilia. *"Con quién uno habla todos los días no es un detalle"* |
| 0:30–0:55 | Se le habla: *"Emilia, recuérdame el Losartán de 50 todos los días a las ocho."* Pregunta lo que falta, confirma con voz |
| 0:55–1:10 | Se abre el pastillero: **el medicamento ya está ahí**. Nadie llenó un formulario |
| 1:10–1:30 | **Suena el recordatorio.** La pantalla se toma, suena y vibra. Un toque en "Ya me lo tomé" y queda registrado |
| 1:30–1:45 | Se le saca una **foto al tensiómetro** y el valor queda cargado tras confirmar |
| 1:45–2:00 | Cierre: *"Un pastillero, una agenda, una app de salud y una comunidad. Una sola aplicación, una sola forma de usarla, y se instala sin pasar por ninguna tienda."* |

**El momento que convence es 1:10.** Si todo lo demás falla, ese segmento tiene que funcionar —
y por eso la alarma en primer plano se construye primero: no depende de red ni de permisos.

> **Truco:** programar el recordatorio del demo a una hora concreta ya conocida, no "en 2
> minutos". Volumen al máximo y, si se puede, el teléfono conectado al audio de la sala.

## 6. Si algo falla en vivo

| Falla | Reacción |
|---|---|
| No llega la Web Push | Mostrar la alarma en primer plano y decir que el recordatorio tiene dos caminos justamente por eso. **Es un punto a favor, no una excusa** |
| Se cae el túnel | La PWA cacheada sigue abriendo: pastillero y agenda del día funcionan desde IndexedDB. Mostrarlo a propósito |
| No hay internet | Poner el teléfono en modo avión y que la alarma suene igual es una demostración potentísima. **Considerar hacerlo a propósito en el guion** |
| El agente no responde | Seguir por los botones de los módulos: la app no depende del agente para funcionar, y eso es verdad |
| ElevenLabs falla | Habla la voz del navegador. No pedir disculpas, seguir |
| La foto no se lee | Se abre el teclado numérico con lo detectado. Es el comportamiento diseñado, no una falla |
| Se cae todo | **Video de 90 segundos grabado la noche anterior** |

## 7. Checklist de la noche anterior

- [ ] Demo ensayado completo tres veces, cronometrado
- [ ] Video de respaldo grabado
- [ ] PWA **instalada** en el teléfono del demo, con permisos ya aceptados
- [ ] Web Push probada con el teléfono bloqueado
- [ ] Alarma en primer plano probada en modo avión
- [ ] Túnel levantado con URL conocida, probado con datos móviles
- [ ] Ambas voces probadas en el teléfono del demo
- [ ] Datos sembrados cargados: ninguna pantalla vacía
- [ ] Un clon limpio levanta con `./scripts/dev.sh`
- [ ] Claves de API verificadas esa misma noche
