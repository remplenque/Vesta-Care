# 00 · Contexto del proyecto

## 1. El encargo

**Hack4Seniors UDD** — jueves 1 de octubre de 2026, La Nave (edificio S). Jornada única,
equipos de 3 a 4 personas. Desafío abierto: una solución tecnológica que mejore la calidad de
vida de las personas mayores y de quienes las acompañan. Ejes sugeridos: autonomía, seguridad,
soledad y carga del cuidado.

Equipo: Vicente Rodríguez, Bato, Luchoo.

## 2. El problema

Un ELEAM mediano en Chile tiene entre 30 y 60 residentes y, en el turno de noche, **uno o dos
cuidadores para todo el recinto**. Ese cuidador trabaja a ciegas: recorre pasillos, abre puertas,
y se entera de una caída o una descompensación cuando pasa por ahí o cuando alguien grita.

El resultado es doble:

- **Para el residente:** el tiempo entre el evento y la atención es el que define el desenlace.
  En una caída no mata el golpe, mata el rato en el suelo sin que nadie sepa.
- **Para el cuidador:** carga mental permanente, rotación alta, y la sensación de que
  cualquier cosa que pase mientras estaba en el otro pasillo es culpa suya.

Las soluciones existentes fallan por extremos opuestos: las cámaras son invasivas y nadie las
mira en tiempo real, y los botones de pánico exigen que la persona esté consciente y lúcida.

## 3. Nuestra respuesta

**Vesta Care** es un centro de monitoreo: una sala de control para un ELEAM que convierte
telemetría de residentes en **alertas localizadas y accionables**, dirigidas al cuidador que está
más cerca.

Cuatro movimientos:

1. **Ver.** Un gemelo digital 3D del centro muestra dónde está cada residente y cómo está.
2. **Detectar.** Un motor de reglas vigila signos vitales y movimiento, y abre alertas.
3. **Avisar.** El dashboard grita visualmente y WhatsApp va al celular del cuidador de esa zona.
4. **Entender.** Un modelo de IA resume la jornada de cada residente en lenguaje humano.

## 4. Por qué simulación y no sensores

No podemos llevar hardware al evento. En vez de disimularlo, lo convertimos en argumento:

- Un ELEAM real **no instala sensores para probar un software**. Primero quiere ver el centro de
  monitoreo funcionando. La simulación es la vía de entrada comercial real.
- Nos permite demostrar en vivo escenarios que serían imposibles o poco éticos de provocar:
  una hipoglicemia, una caída, una fuga por la puerta principal a las 3 AM.
- La capa de ingesta es agnóstica: Unity publica en el mismo contrato que publicaría una pulsera
  real. Reemplazar el simulador por hardware es cambiar el emisor, no el sistema.

> **Frase para el pitch:** *"Lo que están viendo es un ELEAM simulado. El día que haya sensores
> reales, no cambia una sola línea del centro de monitoreo — solo cambia quién manda los datos."*

## 5. Usuarios

| Perfil | Quién es | Qué necesita | Dónde lo usa |
|---|---|---|---|
| **Cuidador de turno** | Técnico en enfermería, 25-50 años, de pie todo el turno | Saber *dónde* y *qué tan grave*, en menos de 5 segundos, sin dejar lo que está haciendo | Celular (WhatsApp) y pantalla del pasillo |
| **Jefe técnico / enfermera supervisora** | Responsable clínico del centro | Panorama del centro, historial por residente, respaldo documental de la atención | Dashboard en notebook |
| **Administrador del ELEAM** | Gerencia, a veces el dueño | Indicadores agregados, tiempos de respuesta, algo que mostrarle a la familia y a la fiscalización | Dashboard, vista de administración |
| **Familiar** *(fuera de alcance del MVP)* | Hijo o hija, 45-65 años | Tranquilidad, resumen semanal | — |

El **cuidador de turno es el usuario primario**. Toda decisión de diseño que lo favorezca a él
gana sobre cualquier otra.

## 6. Alcance

### Dentro (MVP del día)
- Simulación Unity de un piso de ELEAM con 8 a 12 residentes y vitales dinámicos
- Panel de operador para inyectar eventos de emergencia en vivo
- Ingesta de telemetría y motor de reglas en el backend
- Dashboard con plano cenital, cola de alertas, ficha de residente y vista de cámaras
- Notificación por WhatsApp con escalamiento por zona
- Reporte diario por residente generado con IA

### Fuera (decirlo antes de que lo pregunten)
- Hardware real, integración con pulseras o sensores comerciales
- Historia clínica, interoperabilidad HL7/FHIR, integración con FONASA o ISAPRE
- App móvil nativa (WhatsApp cumple ese rol)
- Multi-centro con control de acceso por organización
- Cualquier pretensión de validación clínica o certificación

## 7. Glosario

| Término | Significado |
|---|---|
| **ELEAM** | Establecimiento de Larga Estadía para Adultos Mayores. Residencia regulada en Chile |
| **Residente** | Persona mayor que vive en el ELEAM. Nunca lo llamamos "paciente" en la interfaz |
| **Cuidador** | Personal de turno responsable de atender la alerta |
| **Zona** | Subdivisión del plano: habitación, pasillo, comedor, baño, patio, acceso |
| **Telemetría** | Flujo periódico de posición y signos vitales de un residente |
| **Evento** | Hecho discreto emitido por el simulador (caída, botón SOS, cruce de puerta) |
| **Alerta** | Resultado de aplicar una regla a telemetría o eventos. Tiene ciclo de vida |
| **ACK** | Reconocimiento: un cuidador declara que se hace cargo de la alerta |
| **Gemelo digital** | Representación 3D del centro sincronizada con el estado del sistema |

## 8. Criterios de éxito del demo

El demo es exitoso si, en 90 segundos y sin tocar un terminal:

1. Se ve el plano del centro con residentes moviéndose y en verde
2. Se provoca una emergencia desde Unity y la alerta aparece en el dashboard en **menos de 3 segundos**
3. Llega el mensaje de WhatsApp a un celular físico que el jurado puede ver
4. Un cuidador da ACK desde el dashboard y la alerta cambia de estado en todas las vistas
5. Se abre la ficha del residente y se muestra un reporte redactado por IA
6. Nada se cae

## 9. Restricciones

- **Tiempo:** una jornada, 3 o 4 personas.
- **Red:** el WiFi del evento no es confiable. Todo debe correr en `localhost` contra un hotspot
  propio. Las únicas dependencias externas son Twilio y la API de IA, ambas con modo degradado.
- **Pantalla:** el demo se muestra en un proyector. Contraste alto, tipografía grande, nada de
  gris claro sobre blanco.
- **Energía:** sin enchufes garantizados. Notebooks cargados y un powerbank.
