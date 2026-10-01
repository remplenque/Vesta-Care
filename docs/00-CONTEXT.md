# 00 · Contexto del proyecto

## 1. El encargo

**Hack4Seniors UDD** — jueves 1 de octubre de 2026, La Nave (edificio S). Jornada única, equipos
de 3 a 4. Ejes: autonomía, seguridad, soledad y carga del cuidado.

**Equipo:** Vicente Rodríguez · Baptiste Vial · Luis-Felipe Cáceres.

## 2. El problema

Una persona mayor que vive de forma autónoma hoy tiene que manejar, por separado:

- **Sus medicamentos** — con qué, cuándo, cuántos quedan, y si ya se la tomó hoy o no
- **Su salud** — presión, glucosa, pasos, sueño; datos repartidos entre un cuaderno, una app del
  reloj que no entiende, y la memoria
- **Sus horas médicas** — una llamada, un papel, un recordatorio que nadie le puso
- **Su vida social** — que es, en términos de salud, tan determinante como lo anterior

Para cada cosa existe una aplicación. **Y ese es exactamente el problema.** Cinco aplicaciones son
cinco logins, cinco interfaces, cinco maneras distintas de equivocarse. El resultado práctico es
que no se usa ninguna, y la carga se traslada al hijo o la hija que llama todos los días a
preguntar si tomó la pastilla.

El error de diseño de fondo: estas apps asumen que el usuario va a **aprender a navegarlas**. Una
persona de 78 años no quiere aprender una interfaz. Quiere pedir algo y que pase.

## 3. Nuestra respuesta

**Vesta Care** es una sola aplicación donde la persona mayor se administra a sí misma. Y la forma
de usarla no es navegar: es **hablar con Mateo**.

```
   ┌─────────────────────────────────────────┐
   │        MATEO  /  EMILIA                 │   ← pantalla de entrada
   │   "Hola Juanito, ¿en qué andamos hoy?"  │
   │                                         │
   │   🎤  Hablar        ⌨️  Escribir        │
   └─────────────────────────────────────────┘
        │              │               │
        ▼              ▼               ▼
   ┌─────────┐   ┌───────────┐   ┌──────────┐
   │ Mi salud│   │ Mi agenda │   │ Comunidad│
   │ pastille│   │ calendario│   │actividade│
   │ métricas│   │recordatori│   │ BondUp   │
   └─────────┘   └───────────┘   └──────────┘
```

El usuario dice *"Emilia, recuérdame tomar la pastilla de la presión todos los días a las ocho"* y
el medicamento queda cargado, el recordatorio programado en el teléfono y el evento en la agenda.
Nadie navegó un formulario.

Las tres pantallas existen igual, porque hay gente que prefiere tocar, y porque **ver** su propia
información es parte del valor. Pero la vía principal es la conversación.

## 4. Los cuatro módulos

### 4.1 El asistente — Mateo o Emilia
Hereda del proyecto previo del equipo: un "sobrino digital" de 15 años, curioso y respetuoso, que
conversa para estimular cognitivamente y combatir la soledad. **Lo nuevo es que ahora además
hace cosas**: carga medicamentos, agenda, busca actividades, registra que el usuario se tomó la
pastilla. Pasa de compañía a compañía útil.

Y ahora tiene **dos presentaciones**: **Mateo** (sobrino, voz masculina) y **Emilia** (sobrina,
voz femenina). El usuario elige al entrar, y puede cambiar cuando quiera. No son dos personajes:
es la misma persona con dos voces. Dejar elegir importa — con quién uno quiere hablar todos los
días no es un detalle estético. Ver `03-MODULE-ASISTENTE.md`.

### 4.2 Mi salud — monitoreo personal
- **Pastillero digital:** medicamentos, horarios, stock, registro de tomas. El corazón del módulo.
- **Métricas:** presión, glucosa, peso, pasos, sueño. Ingreso manual, siempre disponible.
- **Varias vías de entrada:** manual con teclado grande, conversada con el asistente, **foto del
  tensiómetro o glucómetro** que el usuario ya tiene en la casa, y dispositivo conectado por
  Bluetooth. **El reloj es una opción más, nunca el camino principal:** la mayoría del público
  objetivo no tiene uno. Ver `04-MODULE-HEALTH.md` §4.

### 4.3 Mi agenda — organización
Calendario, horas médicas, recordatorios, registro de lo que hizo. El objetivo declarado es
**evitar olvidos**: la hora al doctor, el remedio, el cumpleaños del nieto.

### 4.4 Comunidad — actividades
Catálogo de actividades presenciales por comuna: talleres, caminatas, gimnasia, baile, charlas.
El usuario descubre, se inscribe, y la actividad entra sola a su agenda con su recordatorio.

> **Inspiración declarada:** la charla de **Michelle, CEO de BondUp**, sobre construir comunidad
> en torno a la persona mayor para mantenerla activa y acompañada.
>
> ⚠️ **No tenemos acuerdo con BondUp.** En el pitch se dice "inspirado en" y "el tipo de
> organización con la que esto se integraría", nunca "en alianza con". Si quieren que sea real,
> escríbanle a Michelle antes del evento: una respuesta suya, aunque sea un "me parece
> interesante", vale más que cualquier slide.

## 5. Usuarios

| Perfil | Quién es | Qué necesita |
|---|---|---|
| **Usuario primario** | Persona de 70-85 años, autovalente, vive sola o en pareja. Tiene smartphone y lo usa para WhatsApp y poco más | Que la app no la haga sentir torpe. Letra grande, voz, pocos pasos |
| **Usuario con apoyo** | Persona mayor con deterioro leve | Que alguien más pueda configurarle las cosas y que ella solo confirme |
| **Familiar** *(P2)* | Hijo o hija, 45-65 | Saber que tomó sus remedios sin tener que llamar a preguntar |
| **Organizador de actividades** *(fuera de alcance)* | BondUp, municipio, junta de vecinos | Publicar y llenar cupos |

**El usuario primario manda.** Cualquier decisión que lo beneficie gana sobre cualquier otra, aunque
le complique la vida al familiar o al desarrollador.

## 6. Alcance

### Dentro (MVP del día)
- **PWA instalable** en la pantalla de inicio del teléfono
- Asistente (Mateo o Emilia, a elección) con voz, texto y **tools reales**
- Pastillero: alta de medicamentos, horarios, registro de toma, stock
- **Recordatorios que suenan en el teléfono** por dos caminos: alarma en pantalla y Web Push
- Métricas de salud por varias vías, incluida la foto del aparato, y resumen visual
- Catálogo de actividades sembrado, con inscripción que entra a la agenda
- Agenda unificada con vista de día
- Perfil con tamaño de letra, voz y elección de asistente

### Fuera (y hay que decirlo antes de que lo pregunten)
- Integración con Apple Health, Google Fit o Health Connect — **no existe acceso desde la web**
  (ver `04-MODULE-HEALTH.md` §4)
- Cuentas, login, sincronización entre dispositivos
- Telemedicina, receta electrónica, interoperabilidad con FONASA o ISAPRE
- Panel para el familiar
- Actividades cargadas por organizadores reales

## 7. Por qué esto gana (y por qué puede perder)

**A favor:**
- Resuelve un problema que el jurado reconoce al instante: la fragmentación de apps
- El agente ya existe y está probado — el equipo no parte de cero
- Es demostrable en un teléfono real, en vivo, sin hardware
- La voz no es un adorno: es el mecanismo de accesibilidad principal

**En contra, y hay que anticiparlo:**
- *"¿Y esto no lo hace ya una app de recordatorios?"* → Respuesta: ninguna junta pastillero,
  agenda, salud y comunidad bajo un agente que las opera hablando. La integración **es** la
  innovación, no una excusa por no innovar.
- *"¿Un adulto mayor va a hablarle al teléfono?"* → Respuesta honesta: no todos. Por eso toda
  función tiene camino táctil equivalente. La voz amplía, no obliga.
- *"¿Por qué una web y no una app de la tienda?"* → Se instala igual en la pantalla de inicio,
  no ocupa espacio, se actualiza sola y no exige que el usuario navegue una tienda —que es, para
  este público, una barrera real. El costo lo pagamos nosotros en los recordatorios, no él.
- *"¿Cómo lo validaron?"* → No lo validamos con usuarios. Decirlo así, y proponer el siguiente
  paso: pruebas con 5 personas mayores en un club de adulto mayor.

## 8. Criterios de éxito del demo

En 2 minutos, con un teléfono en la mano y sin tocar un computador:

1. Se elige asistente y se oye su voz
2. Se le habla y responde con voz
3. Se le pide cargar un medicamento y **aparece en el pastillero** sin tocar un formulario
4. **Suena el recordatorio en el teléfono** a la hora programada
5. Se marca la toma de un toque y queda registrada
6. Se le pide una actividad para el sábado y la inscripción entra a la agenda
7. Se le saca una foto al tensiómetro y el valor queda cargado

El punto 4 es el que convence. Un recordatorio que suena de verdad en un teléfono real, frente al
jurado, vale más que cualquier gráfico. El 7 es el que sorprende.

## 9. Glosario

| Término | Significado |
|---|---|
| **Mateo / Emilia** | Las dos presentaciones del asistente. Misma personalidad, distinta voz |
| **Asistente** | Cómo se le llama en la documentación y en el código, sin fijar un nombre |
| **Vesta Care** | El producto completo. El usuario casi no lo ve: él habla con su asistente |
| **PWA** | Aplicación web instalable en la pantalla de inicio, que funciona sin conexión |
| **Tool** | Función que el agente puede invocar para cambiar el estado de la app |
| **Pastillero** | Módulo de medicamentos: qué, cuándo, cuánto queda, si ya se tomó |
| **Toma** | Registro de que el usuario tomó (o saltó) una dosis |
| **Actividad** | Evento comunitario presencial al que el usuario puede inscribirse |
| **Recordatorio** | Notificación local programada en el teléfono |
| **ELEAM** | Establecimiento de Larga Estadía. Vesta busca retrasar o evitar esa transición |
