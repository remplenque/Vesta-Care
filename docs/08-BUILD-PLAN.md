# 08 · Plan de construcción

## 1. Prioridades

**Si hay que cortar, se corta de abajo hacia arriba. Sin discusión en el momento.**

### P0 — Sin esto no hay demo
- Unity: plano, residentes moviéndose, vitales, POST de telemetría
- Unity: panel de operador con los 3 escenarios del demo
- Core: ingesta, 6 reglas principales, ciclo de alerta con ACK, WebSocket
- Board: plano cenital, cola de alertas, botón ACK
- Un recorrido completo: evento en Unity → alerta en pantalla → ACK

### P1 — Esto es lo que gana la hackathon
- WhatsApp funcionando a un celular físico
- Ficha de residente con gráficos de vitales
- Reporte diario con IA
- Escalamiento a los 60 s

### P2 — Solo si sobra tiempo
- Vista de cámaras con Unity WebGL embebido
- Vista de administración con indicadores
- Triaje de alerta con IA
- Sonido de alerta y modo pantalla completa

## 2. Trabajo previo al evento

Revisar primero si las bases lo permiten. Lo que sí es legítimo en cualquier caso:

- [ ] Activar los celulares en el sandbox de WhatsApp de Twilio **(la noche anterior)**
- [ ] Crear el bot de Telegram de respaldo
- [ ] Conseguir la clave de la API de IA y verificar que responde
- [ ] Hacer un build WebGL de prueba de un proyecto Unity vacío, para saber cuánto demora
- [ ] Hotspot propio configurado y probado
- [ ] Repositorio creado con esta documentación y la estructura de carpetas
- [ ] Ensayar el montaje completo un fin de semana

## 3. Cronograma del día

| Hora | Hito | Quién |
|---|---|---|
| 09:00 | Clonar, `./scripts/dev.sh`, todos corriendo localmente | Todos |
| **10:00** | **🔒 Congelación de contratos.** `02-DATA-CONTRACTS.md` se cierra | Todos |
| 10:00–12:00 | Unity: escena, agentes, vitales, emisor | Bato + Luchoo |
| 10:00–12:00 | Core: modelos, ingesta, motor de reglas, WebSocket | Vicente |
| 11:00 | Board arranca contra datos mock (no espera al backend) | Quien esté libre |
| **12:00** | **Decisión WebGL:** Plan A o Plan B. Sin volver atrás | Todos |
| 12:00–14:00 | Board: plano, cola de alertas, ACK | Vicente |
| 12:00–14:00 | Unity: panel de operador y escenarios | Bato + Luchoo |
| **14:00–15:00** | **🔗 Integración end-to-end. Nadie trabaja en otra cosa** | Todos |
| 15:00 | **Punto de control:** si no hay recorrido completo, se corta todo P1 | Todos |
| 15:00–16:00 | WhatsApp + ficha de residente + reporte IA | Repartido |
| 16:00–16:30 | Pulido visual, textos, legibilidad en proyector | Todos |
| 16:30–17:30 | Slides y ensayo del demo **tres veces completas** | Todos |
| 17:30 | Congelación total. Solo se arreglan fallos que rompan el demo | Todos |

## 4. Reglas de equipo

1. **Nadie espera a nadie.** Cada módulo corre con datos falsos hasta la integración.
2. **El contrato se congela a las 10:00.** Después solo campos opcionales nuevos.
3. **Timebox de 45 minutos.** Si algo no muestra resultado visible en ese plazo, se avisa.
4. **Una persona es dueña del demo.** Esa persona decide qué entra después de las 15:00 y su
   criterio es uno solo: *¿esto puede romper el recorrido de los 90 segundos?*
5. **Commits frecuentes.** Cada hora, aunque esté incompleto.
6. **Si algo funciona, no se refactoriza.** Es el día de la hackathon, no una code review.

## 5. Guion del demo (90 segundos)

| Tiempo | Qué pasa | Quién habla |
|---|---|---|
| 0:00–0:15 | *"Un ELEAM en la noche tiene un cuidador para 40 residentes. Trabaja a ciegas."* Se muestra el plano con todo en verde | Narrador |
| 0:15–0:30 | Se explica que es un gemelo digital: residentes reales, datos simulados | Narrador |
| 0:30–0:45 | **Se dispara la hipoglicemia desde Unity.** El punto pasa a rojo, la zona se tiñe, suena la alerta | Operador |
| 0:45–1:00 | **El celular suena.** Se levanta y se muestra el mensaje de WhatsApp al jurado | Quien recibe |
| 1:00–1:15 | Se presiona **ME HAGO CARGO**; la alerta pasa a azul en todas las pantallas | Cuidador |
| 1:15–1:30 | Se abre la ficha y se muestra el reporte del día redactado por IA. Cierre | Narrador |

**Cierre sugerido:** *"No instalamos un solo sensor. El día que un ELEAM los instale, no cambia
una línea de este centro de monitoreo — solo cambia quién manda los datos."*

## 6. Qué hacer si algo falla en vivo

| Falla | Reacción inmediata |
|---|---|
| No llega el WhatsApp | Seguir sin pausa, mostrar el registro de notificación en el dashboard y decir que el mensaje queda documentado |
| Unity se cae | El fallback sintético mantiene el plano vivo; disparar la alerta desde el endpoint de prueba |
| Se cae el WebSocket | Recargar la pestaña; el snapshot inicial restaura el estado |
| No hay internet | Saltarse WhatsApp e IA, mostrar el reporte cacheado |
| Se cae todo | Tener un **video de 60 segundos del demo grabado la noche anterior**. Es el seguro más barato que existe |

## 7. Checklist de la noche anterior

- [ ] Números activados en el sandbox de Twilio y mensaje de prueba recibido
- [ ] Reportes IA precalculados para los 3 residentes del demo
- [ ] Video de respaldo grabado
- [ ] Notebooks cargados, hotspot probado, adaptador de proyector en la mochila
- [ ] Demo ensayado completo tres veces, cronometrado
- [ ] Un clon limpio del repositorio levanta con `./scripts/dev.sh` sin pasos manuales
