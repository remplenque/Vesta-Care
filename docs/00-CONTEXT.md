# 00 · Contexto del proyecto

## 1. El encargo

**Hack4Seniors UDD**: jueves 1 de octubre de 2026, La Nave (edificio S). Es una jornada única
con equipos de 3 a 4 personas. El desafío es abierto: una solución tecnológica que mejore la
calidad de vida de las personas mayores y de quienes las acompañan. Los ejes sugeridos son
autonomía, seguridad, soledad y carga del cuidado.

Equipo: Vicente Rodríguez, Bato, Luchoo.

> **Historial de decisiones.** Partimos con un centro de monitoreo para ELEAM con gemelo digital
> en Unity (archivado en `docs/archive/eleam/`). Lo descartamos porque los presupuestos son
> ajustados, la instalación es cara, hay demencia y los ciclos de venta son largos. Después
> evaluamos un pastillero inteligente con IA de compañía y también lo dejamos atrás: el pastillero
> pasa a ser **una de las fuentes** que conecta el producto actual.

## 2. El problema

Una persona mayor que vive sola ya usa (o podría usar) varias soluciones sueltas: un reloj que
detecta caídas, un pastillero, la agenda de controles médicos y una app de comunidad como
BondUP. Ninguna habla con las otras:

- **Para la persona mayor:** cada aparato tiene su app, su alarma y su forma de uso. La suma
  confunde, y lo que confunde termina en un cajón.
- **Para la familia a distancia:** la información está repartida en cinco lugares, o no está.
  Se enteran de una caída o de una semana sin medicación tarde y por casualidad.
- **El resultado:** la familia termina presionando por llevarla a una residencia, aunque la
  persona puede y quiere seguir viviendo en su casa.

## 3. Nuestra respuesta

**Vesta** es un **asistente centralizado**. Se conecta a las soluciones que la persona ya usa,
junta su información en un solo lugar y la ayuda a mantener su independencia.

1. **Conectar.** Reloj (caídas y SOS), pastillero, agenda de citas y BondUP envían sus eventos a
   Vesta en un formato común.
2. **Acompañar.** La persona habla con un solo asistente, por voz en una pantalla de la casa o
   por WhatsApp. Le recuerda lo del día, conversa y le avisa a la familia cuando ella lo pide.
3. **Avisar.** Si algo importante no tiene respuesta (una caída, una medicación sin confirmar),
   Vesta escala a la familia por WhatsApp en un orden configurado.
4. **Mostrar.** La familia ve en un panel una sola línea de tiempo con todo junto.

**Objetivo de fondo:** que la persona siga viviendo en su casa con seguridad, decidiendo ella.
Vesta es una red de apoyo, no una cámara de vigilancia.

## 4. Por qué conectores simulados

En el evento no hay hardware ni acceso a las APIs reales de los relojes o de BondUP. Cada
conector se simula y publica en **el mismo contrato que usaría la integración real**
(`02-DATA-CONTRACTS.md` §6).

> **Frase para el pitch:** *"Vesta no compite con el reloj ni con el pastillero: los une. Hoy
> los conectores están simulados; conectar uno real es cambiar quién manda el evento, no el
> asistente."*

## 5. Usuarios

| Perfil | Quién es | Qué necesita | Dónde lo usa |
|---|---|---|---|
| **Persona mayor** (usuaria principal) | 70–85 años, **vive sola**, autovalente | Un solo punto de contacto, simple, que la trate como adulta y no la vigile | Pantalla con voz en casa y WhatsApp |
| **Contacto principal** | Hija o hijo, 45–60 años, trabaja y vive en otra casa | Tranquilidad: enterarse a tiempo de lo importante y no de todo | WhatsApp y panel web en el celular |
| **Contacto secundario** | Otro familiar, vecina o amiga | Ser el respaldo si el principal no responde | WhatsApp |

**La persona mayor gana cualquier empate de diseño.** El contacto principal es quien
probablemente paga, pero el producto fracasa si la persona lo siente como vigilancia y lo apaga.

## 6. Alcance

### Dentro (MVP del día)
- Conectores simulados: reloj (caída, SOS), pastillero (apertura, botones), agenda de citas y
  actividades de BondUP
- Panel de operador para disparar eventos en vivo
- Agenda y escalamiento deterministas en el backend, con pruebas
- Asistente de voz en web (voz + botones grandes de Sí/No) y por chat (WhatsApp o Telegram)
- Panel de la familia: línea de tiempo del día, alertas y botón "Me hago cargo"
- Aviso por WhatsApp al contacto principal y escalamiento al secundario

### Fuera (decirlo antes de que lo pregunten)
- Hardware real e integración real con las APIs de relojes, pastilleros o BondUP
- Detección de caídas propia: la hacen los relojes que ya existen
- Historia clínica, FHIR, FONASA o ISAPRE
- Cámaras, micrófono siempre encendido o grabaciones
- Cualquier pretensión de dispositivo médico o de diagnóstico

## 7. Glosario

| Término | Significado |
|---|---|
| **Persona** | La persona mayor que usa Vesta. En pantalla se usa su nombre ("Don Luis"), nunca "paciente" ni "usuario" |
| **Contacto** | Familiar o persona de confianza que recibe avisos. Tiene un orden: principal o secundario |
| **Conector** | Integración con una solución externa (reloj, pastillero, agenda, BondUP). Hoy está simulado |
| **Evento** | Hecho discreto que reporta un conector: caída, apertura de compartimento, botón SOS |
| **Agenda** | Medicación, citas y actividades, cargadas por la familia o importadas de un conector |
| **Recordatorio** | Instancia de un ítem de la agenda a una hora dada. Tiene ciclo de vida |
| **Alerta** | Algo que requiere que un contacto actúe. La abre el backend, nunca el LLM |
| **Asistente** | La interfaz conversacional (voz o chat). Lee el estado; no lo decide |

## 8. Criterios de éxito del demo

El demo es exitoso si, en 90 segundos y sin tocar un terminal:

1. El asistente saluda por voz y resume el día de la persona usando datos de 3 conectores
2. Un recordatorio de medicación no se confirma, escala, y **llega un WhatsApp a un celular
   físico**
3. Una caída del reloj dispara la pregunta "¿Está bien?" y, sin respuesta, abre una alerta
   crítica en menos de 3 segundos desde el fin de la espera
4. El contacto presiona "Me hago cargo" en el panel y el estado cambia en todas las pantallas
5. Alguien le pregunta al asistente "¿me tomo otra pastilla?" y el asistente no da consejo
   médico: deriva al médico y avisa a la familia
6. Nada se cae

## 9. Restricciones

- **Tiempo:** una jornada, 3 personas.
- **Red:** el WiFi del evento no es confiable. Todo corre en `localhost` con un hotspot propio.
  Las dependencias externas (Twilio, API de IA, reconocimiento de voz del navegador) tienen modo
  degradado.
- **Pantalla:** el demo se ve en un proyector, así que va con contraste alto y tipografía grande.
