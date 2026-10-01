# 05 · Módulo: Web

**Carpeta:** `web/` · React 18, Vite, Tailwind, TypeScript estricto
**Responsabilidad única:** mostrar lo que el core empuja y devolver respuestas y ACK. **La web no
evalúa reglas ni decide severidades.**

## 1. Rutas

| Ruta | Para quién | Qué es |
|---|---|---|
| `/` | Persona mayor | Asistente con voz y botones (`04` §4) |
| `/familia` | Contacto | Panel: estado, línea de tiempo del día, alertas, agenda |
| `/a/:id` | Contacto desde WhatsApp | Una alerta a pantalla completa con **Me hago cargo** |
| `/sim` | Operador del demo | Botones que emiten eventos de conectores y escenarios |

`web/src/lib/api.ts` es el único archivo que habla con el core (REST + WS).

## 2. Panel de la familia (`/familia`)

Responde en menos de 5 segundos a la pregunta **"¿está bien mi papá hoy?"**.

1. **Franja de estado** arriba, en una línea: 🟢 "Todo en orden", 🟠 "Hay algo pendiente" o
   🔴 "Necesita ayuda ahora". La calcula el core a partir de las alertas abiertas; la web solo
   la pinta.
2. **Alertas abiertas** con botón **Me hago cargo** (ACK) y luego **Resolver**.
3. **Línea de tiempo del día**, con un ícono por fuente: ⌚ reloj, 💊 pastillero,
   📅 agenda, 👥 BondUP, 💬 asistente. Ejemplos de frases:
   - "09:04 · Se abrió el compartimento 2 (Losartán)": **nunca** "tomó su pastilla"
   - "11:20 · Conversó con el asistente"
   - "15:00 · Control en el CESFAM"
4. **Dispositivos:** conectado o sin conexión, y batería.
5. **Monitoreo en pausa:** si `monitoring_paused`, aparece un aviso visible arriba ("Don Luis
   pausó el monitoreo") y la franja de estado no se pinta en verde.

El contenido de las conversaciones **no** se muestra a la familia. Solo se muestra que hubo
conversación y las alertas que esta generó. Es parte de la propuesta de privacidad.

## 3. Panel de operador (`/sim`)

Un botón por evento de `02` §6, agrupados por conector, más los escenarios `missed_medication`,
`fall` y `sos` y **Resetear todo**. Hace POST a `/v1/events` o `/v1/demo/*`. Se abre en una
pestaña aparte durante el demo.

## 4. Legibilidad

- La severidad siempre se muestra con color + ícono + texto.
- Contraste AA o mejor, nada de gris claro sobre blanco, y nada que parpadee a más de 2 Hz.
- Se lee a 3 m en un proyector. En `/` la letra es grande; en `/familia` el panel es usable en
  un celular.
- Ningún `rule_id`, enum ni texto en inglés llega a la pantalla: todo pasa por
  `web/src/lib/labels.ts`.

## 5. Degradación

Si se cae el WS, la web reintenta cada 2 s, mantiene el último estado y muestra "Reconectando…".
Nunca deja la pantalla en blanco.

## 6. Criterios de aceptación

- [ ] `/familia` refleja un evento de `/sim` en menos de 1 s
- [ ] El ACK en `/a/:id` cambia la alerta en `/familia` sin recargar
- [ ] `/` habla los recordatorios y muestra el check-in de caída con cuenta regresiva
- [ ] Nada en pantalla dice "tomó" la medicación
- [ ] Con el core apagado, las páginas muestran el último estado y "Reconectando…"
