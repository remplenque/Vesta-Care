# 06 · Módulo: Alertas y WhatsApp

**Archivo:** `core/app/notify.py`
**Responsabilidad única:** sacar la alerta de la pantalla y meterla al bolsillo del cuidador.

## 1. El problema de WhatsApp (léelo antes de planificar)

La **API oficial de WhatsApp Business** requiere cuenta de Meta Business, verificación de la
empresa y aprobación de plantillas de mensaje. Eso toma **días o semanas**. No es viable.

La vía realista es el **Sandbox de WhatsApp de Twilio**:

- Funciona en unos 20 minutos
- Es gratis para pruebas
- **Cada número que vaya a recibir mensajes debe enviar primero un código de activación**
  (`join <dos-palabras>`) al número del sandbox de Twilio
- La activación dura 72 horas de inactividad

> ⚠️ **Acción crítica:** activar los celulares del equipo y de quien reciba el mensaje en el
> demo **la noche anterior al evento**. Si un número no está activado, el mensaje no llega y no
> hay forma de arreglarlo en vivo. Dejar un celular de respaldo también activado.

### Plan B: Telegram
Un bot de Telegram vía BotFather no tiene activación previa ni restricciones. Si Twilio falla,
`notify.py` cambia de canal con una variable de entorno. **Implementar ambos adaptadores detrás
de la misma interfaz** desde el principio — son 20 líneas extra y es un seguro barato.

```python
class Notifier(Protocol):
    def send(self, to: str, message: str) -> NotificationResult: ...
```

## 2. Política de notificación

| Severidad | ¿Notifica? | A quién |
|---|---|---|
| `critical` | Sí, inmediato | Cuidadores asignados a la zona |
| `critical` escalada | Sí, a los 60 s sin ACK | Todos los cuidadores en turno |
| `warning` | No | Solo dashboard |
| `info` | No | Solo dashboard |

**Límite de seguridad:** máximo 1 mensaje por cuidador cada 30 segundos. Si se disparan cinco
alertas juntas, se agrupan en un mensaje. Un cuidador con el teléfono vibrando sin parar deja de
leer los mensajes, y ahí el sistema dejó de servir.

## 3. Formato del mensaje

Corto, escaneable, con la acción primero. El cuidador lo lee caminando.

```
🔴 EMERGENCIA · Vesta Care

Carmen Soto (84)
Habitación 104 · Ala norte

Hipoglicemia severa
Glucosa 54 mg/dL hace 45 segundos

Responder: http://10.0.0.5:5173/a/alr_7f3a
14:32
```

Reglas de redacción:
- Emoji de severidad al inicio: 🔴 crítica, 🟠 advertencia
- Nombre y edad en la segunda línea; la zona en la tercera
- El motivo en lenguaje natural, nunca el `rule_id`
- Enlace corto que abre el dashboard directo en esa alerta
- Sin saludos, sin firmas, sin "estimado cuidador"

## 4. ACK desde el mensaje

El link lleva a `/a/{alert_id}` en el dashboard, que muestra la alerta a pantalla completa con un
botón grande. **No** se implementa ACK por respuesta de texto en WhatsApp: requiere webhook
entrante, URL pública y un túnel. No cabe en un día.

> Si el jurado pregunta: *"El ACK por respuesta de WhatsApp está diseñado pero no implementado;
> necesita un webhook público y preferimos que el demo corra sin depender de internet."*

## 5. Registro

Cada intento se guarda en la tabla `notifications` con `alert_id`, `caregiver_id`, `channel`,
`status` (`sent` · `failed` · `skipped_rate_limit`), `provider_message_id` y timestamp, y se
difunde por WebSocket como `notification.sent`. El dashboard muestra en la tarjeta de la alerta
quién fue notificado y si el envío llegó. **Eso es lo que convierte esto en un respaldo
documental para el ELEAM**, y vale la pena mencionarlo en el pitch.

## 6. Degradación

Si el envío falla (sin red, Twilio caído, número no activado):
1. La alerta **igual se abre** y se ve en el dashboard
2. La notificación queda `failed` con el motivo
3. La barra superior muestra "WhatsApp no disponible"
4. Con `DEMO_MODE=true`, el mensaje se imprime en el log del backend

Nunca se levanta una excepción que interrumpa la apertura de la alerta.

## 7. Criterios de aceptación

- [ ] Una alerta crítica genera un mensaje real en un celular físico en menos de 5 s
- [ ] El escalamiento a los 60 s notifica a los demás cuidadores
- [ ] El límite de frecuencia agrupa alertas simultáneas en un solo mensaje
- [ ] Con Twilio desconectado, la alerta se abre igual y el fallo queda registrado
- [ ] El adaptador de Telegram funciona cambiando una variable de entorno
- [ ] El link del mensaje abre la alerta correcta en el dashboard
