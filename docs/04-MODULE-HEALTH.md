# 04 · Módulo: Mi salud (monitoreo personal)

**Archivo:** `server/modules/health.py` · **Pantalla:** `web/src/routes/Salud.tsx`
**Responsabilidad única:** que el usuario sepa qué remedio le toca, si ya se lo tomó, y cómo va.
**Lo que NO hace:** diagnosticar, interpretar síntomas, recomendar o ajustar medicamentos.

## 1. Prioridad dentro del módulo

1. **Pastillero** — P0. Justifica la app por sí solo
2. **Entrada de datos de salud** — P1. Varias vías, ver §4
3. **Resumen visual** — P1. Cómo vengo esta semana
4. **Reloj / dispositivo** — P2. **Una opción más, nunca la principal**

## 2. Pastillero

### 2.1 Vista del día
Lo primero que se ve. No una lista de medicamentos: **una lista de tomas de hoy**, por hora, con
su estado.

```
┌─────────────────────────────────┐
│  Mis remedios de hoy            │
│                                 │
│  ✅ 08:00  Losartán 50 mg       │
│      Ya se lo tomó              │
│                                 │
│  🔵 14:00  Metformina 850 mg    │
│      En 2 horas                 │
│      [  YA ME LO TOMÉ  ]        │
│                                 │
│  ⚪ 20:00  Losartán 50 mg       │
│                                 │
│  ⚠️ Le quedan 5 Losartán        │
│      [ Recordarme comprar ]     │
└─────────────────────────────────┘
```

Reglas:
- **Una sola acción primaria por toma.** Posponer y omitir son secundarias
- Estado con **color + ícono + texto**, nunca solo color
- Las tomas pasadas sin registrar se marcan en ámbar, **sin regañar**: *"No quedó registrado.
  ¿Se lo tomó?"*, nunca *"¡Olvidó su medicamento!"*
- Nunca la palabra "dosis" en la interfaz: "pastilla", "comprimido", "remedio"

### 2.2 Alta de medicamento
Dos caminos, misma lógica (`health.add_medication`): hablando con el asistente (el principal) o
por formulario, para quien prefiere tocar. Con `tamano_texto: muy_grande`, un campo por pantalla.

### 2.3 Stock
Cada toma descuenta 1. Al bajar de `stock_alerta` (7 por defecto), se crea un evento `recado`:
"Comprar Losartán". Es un detalle chico y de los que más se agradecen en la vida real.

### 2.4 Recordatorios
Ver `06-MODULE-AGENDA.md` §4. **Dos caminos: alarma en primer plano (P0) y Web Push (P1).**

## 3. Resumen visual

| Tipo | Se muestra como |
|---|---|
| Presión | Línea de 7 días con banda de referencia |
| Glucosa | Línea de 7 días |
| Peso | Línea de 30 días |
| Ánimo | Cómo vino la semana, en caras |
| Pasos / Sueño | Barras |

**El resumen no juzga.** Se muestra el dato con su rango de referencia y, si está fuera, una
frase neutra: *"Esta semana estuvo más alta que de costumbre. Puede ser buena idea comentarlo en
su próximo control."* Nunca *"su presión es peligrosa"*.

## 4. Cómo entran los datos de salud

**El reloj inteligente es una opción, no el camino.** La mayoría del público objetivo no tiene
reloj, y una app que lo exige deja fuera a casi todos sus usuarios. Por eso hay cuatro vías, en
este orden de prioridad:

### Vía 1 — Entrada manual rápida (P0, por defecto)
La que siempre está. Diseñada para que tomar la presión y anotarla no sea una tarea.

- **Teclado numérico grande**, propio, no el del sistema. Teclas de 72 px
- Presión: dos campos, uno al lado del otro, con el formato que la gente usa (`13` / `8`,
  no `130` / `80` — se normaliza por detrás)
- **Tres toques máximo** desde abrir la app hasta guardar
- Valores recientes como sugerencia tocable: si siempre anota algo parecido, un toque basta

### Vía 2 — Conversacional (P1)
*"Emilia, me tomé la presión, trece con ocho"* → `registrar_metrica`. Para muchos usuarios es la
vía más natural: no hay que encontrar una pantalla ni entender un formulario.

El asistente también puede preguntar, con el contexto del día: *"¿Se tomó la presión hoy?"*. Una
pregunta conversada es una fuente de datos perfectamente válida, y más cálida que un sensor.

### Vía 3 — Foto del aparato (P1, y es el diferencial)
El usuario ya tiene un tensiómetro o un glucómetro digital en la casa. **Le saca una foto a la
pantalla y Gemini lee el número.**

- `<input type="file" accept="image/*" capture="environment">` abre la cámara en el teléfono,
  sin librerías ni permisos especiales
- La imagen va a `POST /v1/metrics/foto`, Gemini extrae los valores, y **se muestran para que el
  usuario confirme antes de guardar**. Nunca se guarda sin confirmación
- Si no logra leerlos, se abre el teclado numérico con lo que haya detectado

> Esto resuelve el problema real —transcribir números de un aparato a mano— sin pedirle al
> usuario que compre nada. Es barato de construir (Gemini ya es multimodal y ya está integrado)
> y es lo que más se va a notar en el demo.

### Vía 4 — Dispositivo conectado (P2)
Acá sí entra el reloj, con honestidad sobre lo que es posible en una PWA:

| Opción | Viabilidad real |
|---|---|
| **Web Bluetooth** con una banda de frecuencia cardíaca estándar (GATT `0x180D`) | ✅ Funciona en Chrome Android. Es la vía realista para leer un dispositivo de verdad |
| Google Fit / Health Connect | ❌ Health Connect no tiene API web. Fit requiere OAuth y su API pública está siendo descontinuada |
| Apple HealthKit | ❌ No existe acceso desde la web. Punto |
| Importar un archivo exportado del reloj (CSV/JSON) | ✅ Feo pero funciona, y sirve para mostrar el concepto |

**Arquitectura:** `HealthSource` como interfaz, con `ManualSource`, `PhotoSource`,
`BluetoothSource` y `SimulatedSource`. Cambiar entre ellas es una variable de entorno.

**En el demo se usa `SimulatedSource` y se dice que es simulado.** La pantalla lo muestra y el
campo `fuente` lo marca.

> **Cómo decirlo en el pitch:** *"La conexión con dispositivos está diseñada como un adaptador,
> y en la web lo que realmente se puede leer hoy es Bluetooth directo. Pero el punto es otro: la
> mayoría de nuestros usuarios no tiene reloj. Por eso la vía principal es sacarle una foto al
> tensiómetro que ya tienen en el velador."*
>
> Esa respuesta es más fuerte que fingir una integración. Un jurado técnico detecta lo segundo
> en diez segundos.

## 5. Datos sembrados

`shared/seed/medications.json`: tres medicamentos con horarios repartidos, uno con stock bajo
para mostrar la alerta, y tomas de días anteriores para que los gráficos no estén vacíos. **Una
pantalla vacía en un demo se ve como un producto que no funciona.**

## 6. Límites — esto no es software médico

1. Vesta **recuerda y registra**. No diagnostica, no interpreta, no recomienda
2. Nunca sugiere tomar, suspender ni ajustar un medicamento
3. Nunca interpreta una métrica como señal de enfermedad
4. Ante un síntoma preocupante, deriva al doctor o al contacto de emergencia
5. El pastillero refleja lo que el usuario cargó, no una receta validada. La pantalla de alta lo
   dice: *"Cargue aquí lo que le indicó su doctor."*
6. **Un valor leído de una foto se confirma siempre.** Un OCR equivocado que entra solo al
   registro de salud es un riesgo real, no una molestia de UX
7. En el pitch: *"Es una herramienta de autogestión, no un dispositivo médico, y cualquier
   despliegue real necesita revisión clínica y regulatoria."*

## 7. Criterios de aceptación

- [ ] El pastillero muestra las tomas del día ordenadas y con estado correcto
- [ ] "Ya me lo tomé" registra y descuenta stock en menos de 1 segundo, **también sin red**
- [ ] El stock bajo genera el recado en la agenda automáticamente
- [ ] Un medicamento creado por el asistente aparece sin recargar
- [ ] La entrada manual se completa en 3 toques
- [ ] La foto del tensiómetro extrae los valores y **pide confirmación** antes de guardar
- [ ] Los datos simulados están marcados como tales en la interfaz
- [ ] Ningún texto da consejo médico ni regaña al usuario
- [ ] Todo legible con `tamano_texto: muy_grande` sin que se corte nada
