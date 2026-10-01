# 06 · Módulo: Mi agenda (calendario, recordatorios y notificaciones)

**Archivos:** `server/modules/agenda.py`, `server/scheduler.py`, `server/push.py`,
`web/src/lib/alarma.ts` · **Pantalla:** `web/src/routes/Agenda.tsx`
**Responsabilidad única:** que no se le olvide nada.

Es el módulo más importante después del pastillero, porque hace que todos los demás sirvan: una
actividad sin recordatorio es una actividad a la que no se va.

## 1. Una sola agenda

Todo lo que ocupa tiempo entra acá, venga de donde venga:

| Origen | Tipo de evento |
|---|---|
| Pastillero | `medicamento` (generado, no editable desde la agenda) |
| Comunidad | `actividad` (creado al inscribirse) |
| El asistente o el usuario | `hora_medica`, `personal`, `recado` |

El usuario no distingue entre "la app de remedios" y "la app de calendario". Ve **su día**.

## 2. Vista de día

La vista por defecto. **No se abre en vista de mes**: en una pantalla chica es ilegible y además
no es información que el usuario necesite.

```
┌─────────────────────────────────┐
│  ◀   Hoy, jueves 1   ▶          │
│                                 │
│  ✅ 08:00  Losartán             │
│  ✅ 09:30  Caminata en el parque│
│                                 │
│  ──── AHORA ──────────────────  │
│                                 │
│  🔵 14:00  Metformina           │
│  🔵 16:00  Control Dr. Pérez    │
│      Consultorio Ñuñoa          │
│      [ Cómo llegar ]            │
│                                 │
│  ⚪ 20:00  Losartán             │
│                                 │
│         [  + AGREGAR  ]         │
└─────────────────────────────────┘
```

- Flechas grandes para navegar. **Siempre un botón "Hoy"** para volver
- Lo pasado se ve, atenuado, pero no desaparece: ver lo cumplido da sensación de logro
- Vista semanal simple es P2. La de mes, fuera de alcance

## 3. Crear un evento

Dos caminos, misma lógica:
- **Hablando:** *"Tengo control con el doctor el martes a las cuatro"* → `agendar_evento`
- **Formulario:** título, fecha, hora, lugar, cuándo avisar. Nada más

Recordatorios por defecto según el tipo:

| Tipo | Por defecto |
|---|---|
| `medicamento` | A la hora exacta + a los 30 min si no se registró |
| `hora_medica` | 1 día antes + 2 horas antes |
| `actividad` | 1 día antes + 1 hora antes |
| `personal` | 1 hora antes |
| `recado` | A las 10:00 del día indicado |

## 4. Notificaciones — leer completo antes de programar

### 4.1 La restricción
**Una PWA no puede programar una notificación local.** La API `showTrigger` fue un experimento
de Chrome y se retiró; no hay reemplazo estándar. Esto cambia por completo el diseño respecto a
una app nativa, y hay que asumirlo en vez de pelearlo.

Se resuelve con **dos caminos complementarios**:

| | Camino A — Web Push | Camino B — Alarma en primer plano |
|---|---|---|
| Funciona con la app cerrada | ✅ | ❌ |
| Funciona sin internet | ❌ | ✅ |
| Necesita permiso del usuario | ✅ | ❌ |
| Necesita HTTPS | ✅ | Solo para el SW, no para la alarma |
| Funciona en iOS | Solo 16.4+ y con la PWA instalada | ✅ |
| Botones de acción | Android sí, iOS no | ✅ (es la pantalla) |
| Esfuerzo | ~3 horas | ~30 minutos |

> **Orden de construcción: B primero, A después.** B es media hora, no depende de nada y es lo
> que salva el demo. A es lo correcto para producción. Un equipo que construye solo A y se queda
> sin red a las 17:00 no tiene demo.

### 4.2 Camino B — alarma en primer plano (P0)

`web/src/lib/alarma.ts`. Mientras la PWA esté abierta, un temporizador revisa cada 30 segundos
los recordatorios guardados en IndexedDB. Al llegar la hora:

1. **Toma la pantalla completa** con el aviso: nombre del medicamento, dosis, instrucción
2. **Suena** con Web Audio, en bucle suave hasta que se responda
3. Dos botones enormes: **"Ya me lo tomé"** y **"Más tarde"**
4. Vibra con `navigator.vibrate([400, 200, 400])` si el dispositivo lo soporta
5. Si además hay permiso de notificaciones, muestra también la notificación del sistema con
   `registration.showNotification()` — así se ve igual aunque el usuario tenga otra pestaña

```ts
// El audio necesita un gesto previo del usuario para poder sonar.
// Ese gesto ya ocurrió: el botón "Oír" de la pantalla de elección de asistente.
// Por eso ese botón no se quita. Ver 03-MODULE-ASISTENTE.md §6.
```

**Esta pantalla es el momento del demo.** Es grande, suena, y se responde de un toque.

### 4.3 Camino A — Web Push (P1)

**Servidor:**
```python
# scheduler.py — APScheduler en el proceso de Flask
scheduler.add_job(
    disparar_recordatorio,
    trigger=CronTrigger(hour=8, minute=0, timezone="America/Santiago"),
    args=["usr_01", "med_03"],
    id="rem_med_03_0800", replace_existing=True,
)
```

```python
# push.py — pywebpush con claves VAPID
webpush(subscription_info=sub, data=json.dumps(payload),
        vapid_private_key=VAPID_PRIVATE_KEY,
        vapid_claims={"sub": VAPID_SUBJECT})
```

**Cliente:** `web/src/lib/push.ts` pide permiso, se suscribe con la clave pública VAPID y manda
la suscripción a `POST /v1/push/subscribe`.

**Service worker:**
```ts
self.addEventListener("push", (e) => {
  const d = e.data.json();
  e.waitUntil(self.registration.showNotification(d.titulo, {
    body: d.cuerpo,
    icon: "/icons/192.png",
    vibrate: [400, 200, 400],
    requireInteraction: true,          // no se va sola
    tag: d.local_id,                   // evita duplicados
    actions: [                          // Android sí, iOS no
      { action: "tomada", title: "Ya me lo tomé" },
      { action: "luego",  title: "Más tarde" },
    ],
    data: d.accion_ref,
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  if (e.action === "tomada") {
    e.waitUntil(fetch(`/v1/medications/${e.notification.data.id}/intake`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "tomada", origen: "notificacion" }),
    }));
  } else {
    e.waitUntil(clients.openWindow("/salud"));
  }
});
```

`requireInteraction: true` y `tag` son importantes: la notificación no desaparece sola y no se
acumulan tres iguales si el servidor reintenta.

### 4.4 Permisos
Nunca se pide el permiso al abrir. Primero una pantalla que explica para qué sirve, con un botón
grande. Si el usuario dice que no, la app funciona igual (camino B) y queda un aviso suave y
permanente arriba, que al tocarlo vuelve a ofrecerlo.

### 4.5 Instalación
Web Push en iOS **solo funciona si la PWA está en la pantalla de inicio**. Y en general, una app
instalada se usa mucho más que una pestaña.

- Capturar `beforeinstallprompt` en Chrome y ofrecer **"Agregar a mi teléfono"** con un botón
  grande, después de la primera conversación exitosa (no al entrar)
- En iOS no existe ese evento: mostrar instrucciones con dibujos — *"Toque el cuadrito con la
  flecha ↑ y después 'Agregar a inicio'"*
- `manifest.webmanifest`: `display: "standalone"`, `theme_color` del tema, íconos 192, 512 y
  maskable, `start_url: "/"`, `lang: "es-CL"`

### 4.6 Reglas de oro
1. **Nunca más de dos avisos por evento.** El tercero hace que silencien la app para siempre
2. **Nunca avisos agrupados ni genéricos.** "Tienes 3 pendientes" no sirve
3. **Lenguaje humano.** "Hora de su Losartán", no "Recordatorio: medicamento med_03"
4. **Reprogramar al abrir.** En cada apertura la PWA sincroniza y recalcula los recordatorios de
   los próximos 7 días, sin duplicar

## 5. Registro de lo que hizo

Marcar un evento como cumplido alimenta dos cosas: la sensación de logro del usuario (*"Esta
semana cumplió 18 de 21 tomas"*) y el contexto del asistente (*"Oye, fue a la caminata el martes.
¿Cómo estuvo?"*).

**Nunca como porcentaje de fracaso.** Nada de "83% de adherencia". Se dice qué hizo, no qué no
hizo.

## 6. Criterios de aceptación

- [ ] La vista de día muestra medicamentos, actividades y eventos personales juntos y ordenados
- [ ] Un evento creado por el asistente aparece sin recargar
- [ ] **La alarma en primer plano suena y toma la pantalla, sin red y sin permisos**
- [ ] El botón "Ya me lo tomé" de la alarma registra la toma
- [ ] Con permiso concedido, llega una Web Push real a un teléfono físico
- [ ] La acción "Ya me lo tomé" de la notificación registra sin abrir la app (Android)
- [ ] El prompt de instalación aparece después de la primera conversación, no al entrar
- [ ] Al abrir, se reprograman los próximos 7 días sin duplicar avisos
- [ ] Si se niegan los permisos, la app funciona y lo avisa con claridad
