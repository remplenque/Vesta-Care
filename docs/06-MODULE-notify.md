# 06 · Módulo: Notificaciones

**Archivo:** `core/app/notify.py`
**Responsabilidad única:** llevar el aviso al bolsillo del contacto, con el mínimo de datos de
salud.

## 1. Canales

- **Twilio WhatsApp Sandbox (principal).** Funciona en unos 20 minutos, pero **cada número que
  recibe tiene que haber enviado antes `join <dos-palabras>`** al número del sandbox. La
  activación vence tras 72 h sin uso.
  > ⚠️ Activen **hoy, antes del almuerzo**, los celulares que se van a mostrar en el demo, y
  > dejen uno de respaldo activado. Verifiquen en la consola de Twilio que estas condiciones del
  > sandbox siguen vigentes.
- **Telegram (respaldo).** Un bot creado con BotFather, sin activación previa.
- **Log.** Escribe el mensaje en el log del core. Se usa con `NOTIFY_CHANNEL=log` y como último
  recurso en `DEMO_MODE`.

Todos los canales van detrás de la misma interfaz:
```python
class Notifier(Protocol):
    def send(self, to: str, message: str) -> NotificationResult: ...
```

## 2. Política

| Origen | ¿Notifica? | A quién |
|---|---|---|
| Alerta `critical` | Sí, inmediato | Contacto `priority: 1` |
| `critical` escalada (60 s sin ACK) | Sí | Contacto `priority: 2` |
| Medicación: paso `notify_primary` | Sí | Contacto `priority: 1` |
| Medicación: paso `notify_secondary` | Sí | Contacto `priority: 2` |
| Alerta `info` (pregunta médica, pidió hablar con la familia) | Sí, agrupada | Contacto `priority: 1` |
| `DEVICE_ATTENTION` | No | Solo el panel |
| `monitoring_paused` | No | Nadie |

**Límite:** como máximo 1 mensaje por contacto cada 30 s. Lo que llegue mientras tanto se agrupa
en el siguiente mensaje. Las `critical` se saltan la espera, pero siguen agrupándose entre sí.

## 3. Formato: mínimo de datos de salud

El mensaje dice **qué pasa y dónde mirar**. El detalle queda en el panel.

```
🔴 Vesta · Don Luis necesita ayuda

El reloj detectó una posible caída y no respondió.

Ver y responder: http://192.168.1.10:5173/a/alr_7f3a
12:05
```
```
🟠 Vesta · Don Luis no ha confirmado su medicación de las 9:00.

Revisa el panel: http://192.168.1.10:5173/familia
09:30
```

Reglas:
- No se escriben nombres de medicamentos, dosis ni diagnósticos en WhatsApp.
- El emoji de severidad va al inicio y la acción primero. Sin saludos ni firmas.
- El link sale de `PUBLIC_WEB_URL`.

## 4. Registro

Cada intento queda en `notifications` (`02` §11.1) y se difunde como `notification.sent`. El
panel muestra en cada alerta a quién se avisó y si llegó.

## 5. Degradación

Si el envío falla, la alerta **igual se abre y se ve**, la notificación queda `failed` con su
`error` y el panel muestra "WhatsApp no disponible". **Nunca se lanza una excepción que
interrumpa la apertura de una alerta.**

## 6. Criterios de aceptación

- [ ] Una alerta crítica llega a un celular físico en menos de 5 s
- [ ] Sin ACK en 60 s se avisa al secundario
- [ ] Ningún mensaje contiene nombre de medicamento ni dosis (hay prueba)
- [ ] Con Twilio caído, la alerta se abre y el fallo queda registrado
- [ ] Cambiar `NOTIFY_CHANNEL` a `telegram` o `log` funciona sin tocar código
