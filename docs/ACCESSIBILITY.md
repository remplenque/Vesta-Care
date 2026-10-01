# Accesibilidad y diseño para personas mayores

> **Este documento es vinculante desde el primer componente.** Texto chico, contraste bajo o un
> botón de 32 px son **bugs**, no detalles de pulido. En este producto, la accesibilidad no es
> una capa: es la función principal.
>
> Viene de la spec v3 y no depende del stack: se adoptó para el plan Supabase porque concreta lo
> que pide el acta, "accesible pero no infantilizada". Si una guía genérica (Apple HIG, Material)
> pide mínimos más bajos, gana este documento.
>
> **Skill `apple-design` (`.claude/skills/`):** úsalo para respuesta inmediata, springs
> interrumpibles, `prefers-reduced-motion` y tipografía. **No** apliques sus barras translúcidas
> con `backdrop-filter` ni sus bordes reemplazados por difuminados: rompen el contraste 7:1 y los
> bordes visibles (§4). Tampoco gestos como único camino: todo arrastre o deslizamiento necesita
> un botón equivalente (§6).

## 1. A quién le estamos diseñando

Una persona de 78 años, sin discapacidad diagnosticada, tiene en promedio:

- **Presbicia**: no enfoca de cerca; necesita texto más grande y más espaciado
- **Menor sensibilidad al contraste**: el gris claro sobre blanco literalmente no se ve
- **Menor discriminación de azules y violetas**: el cristalino amarillea con la edad
- **Menor motricidad fina**: el toque es menos preciso y a veces se repite sin querer
- **Menos memoria de trabajo**: un flujo de cinco pasos se pierde en el tercero

Nada de esto es patológico. Es el envejecimiento normal, y es el contexto de uso por defecto.

**La trampa a evitar:** diseñar "para viejitos" con estética infantil, colores pastel y lenguaje
condescendiente. Eso ofende y hace que la app se abandone. Se diseña **grande, claro y digno**,
no tierno.

## 2. Reglas duras

| Regla | Mínimo | Por qué |
|---|---|---|
| Tamaño de texto base | **20 pt** (no 16) | Presbicia |
| Texto secundario | **17 pt** mínimo absoluto | Nada por debajo, nunca |
| Área táctil | **56 × 56 pt** (no 44) | Motricidad fina reducida |
| Separación entre botones | **16 pt** | Evita toques accidentales |
| Contraste texto normal | **7:1** (AAA, no AA) | Sensibilidad al contraste |
| Contraste elementos gráficos | **4.5:1** | Íconos y bordes también |
| Interlineado | **1.5** | Facilita el seguimiento de línea |
| Pasos por tarea | **Máximo 3** | Memoria de trabajo |
| Profundidad de navegación | **Máximo 2 niveles** | Nadie debe perderse |

## 3. Escala de texto

Configurable desde el perfil y respeta además el ajuste del navegador y del sistema (muchos
mayores ya lo tienen subido, y pisarlo es un error común).

**En la web esto obliga a dos cosas:** usar `rem` en vez de `px` para todo tipo de letra, con el
tamaño base en `html`, y **nunca** poner `maximum-scale=1` o `user-scalable=no` en el viewport.
Bloquear el zoom en una app para personas mayores es de los peores errores posibles.

```ts
// Listo para copiar: legacy/vesta-v3/web/src/theme.ts
export const escalas = {
  normal:     { base: 20, titulo: 28, grande: 34, boton: 22 },
  grande:     { base: 24, titulo: 34, grande: 42, boton: 26 },
  muy_grande: { base: 30, titulo: 42, grande: 52, boton: 32 },
};
```

**Todo layout debe soportar `muy_grande` sin que se corte, se superponga ni desaparezca nada.**
Probarlo en ese modo **antes** de darlo por terminado, no después. Es la prueba que más bugs
encuentra.

## 4. Color

```ts
export const colores = {
  fondo:        "#FFFFFF",
  texto:        "#1A1A1A",   // 16:1 sobre blanco
  textoSuave:   "#4A4A4A",   // 9:1 — el gris más claro permitido
  primario:     "#B4530A",   // ámbar oscuro, legible y cálido
  exito:        "#1B6B3A",   // verde oscuro
  atencion:     "#A35200",   // ámbar fuerte
  urgente:      "#B32020",   // rojo oscuro
  borde:        "#8A8A8A",   // bordes visibles de verdad
};
```

- **El color nunca carga información solo.** Todo estado va con color + ícono + texto
- **Nada de azul o violeta como único distintivo** entre elementos
- **Fondo blanco, no gris.** Los fondos `#F5F5F5` de moda reducen el contraste efectivo
- **Bordes visibles en todo lo tocable.** Los botones "fantasma" sin borde no se reconocen
  como botones

## 5. Lenguaje

| No escribir | Escribir |
|---|---|
| "Error al procesar la solicitud" | "No pude hacerlo. ¿Lo intentamos de nuevo?" |
| "Dosis" | "Pastilla", "comprimido", "remedio" |
| "Adherencia al tratamiento" | "Tus remedios de hoy" |
| "Sincronizando datos" | "Un momento…" |
| "¡Olvidaste tu medicamento!" | "No quedó registrado. ¿Te lo tomaste?" |
| "Configuración de notificaciones" | "Cuándo quieres que te avise" |
| "Perfil de usuario" | "Mis datos" |

Reglas:
- Tono **adulto**. Nada de diminutivos sistemáticos ni emojis infantiles
- **Nunca regañar.** El usuario no le debe nada a la aplicación
- Frases cortas, voz activa, una idea por frase
- El tratamiento (`tú` / `usted`) sale del perfil y se respeta en toda la interfaz y en Mateo

## 6. Interacción

- **Sin gestos ocultos.** Nada de deslizar para borrar, pellizcar ni mantener presionado como
  única vía. En la web además hay que evitar el deslizamiento horizontal dentro del contenido:
  el navegador lo interpreta como "volver atrás" y el usuario se sale de la pantalla sin
  entender por qué
- **El micrófono es toque simple**, no mantener presionado: en la web ese gesto es menos
  confiable que en una app nativa
- **Sin temporizadores.** Nada que desaparezca solo. Los toasts se quedan hasta que se cierren
- **Confirmación para lo destructivo**, con botones que dicen la acción: **"Sí, eliminar"** /
  **"No, volver"**. Nunca "Aceptar" / "Cancelar"
- **Siempre una salida visible.** Un botón de volver grande en cada pantalla
- **Feedback inmediato en cada toque**: cambio visual y, opcionalmente, vibración corta
- **Tolerancia al doble toque:** ignorar el segundo toque dentro de 500 ms. Evita inscripciones
  duplicadas y dosis registradas dos veces

## 7. Voz

- Siempre acompañada de texto en pantalla, nunca sola
- Velocidad por defecto **0.9**, ajustable desde el perfil
- Un botón visible para repetir lo último que dijo Mateo
- Todo lo que se puede hacer hablando se puede hacer tocando. **La voz amplía, no reemplaza**

## 8. Checklist antes de dar por terminada una pantalla

- [ ] Se lee con el teléfono a 40 cm, con `tamano_texto: muy_grande`
- [ ] Ningún texto bajo 17 pt, ningún botón bajo 56 pt
- [ ] Todo estado se entiende sin distinguir colores (probar en escala de grises)
- [ ] La tarea principal se completa en 3 toques o menos
- [ ] Hay un botón de volver visible
- [ ] Ningún mensaje técnico, ningún reproche, ningún diminutivo forzado
- [ ] Funciona sin red o lo avisa con claridad
- [ ] Probado con el deslizador de fuente del sistema al máximo

## 9. Para el pitch

Esta lista **es** un argumento. La mayoría de los equipos va a mostrar una app bonita con texto
de 14 pt. Mostrar que el tamaño de letra, el contraste y el área táctil son decisiones
documentadas y medibles demuestra que el equipo entendió al usuario en vez de suponerlo.

Una frase que funciona: *"No hicimos una app y después la agrandamos. El tamaño de la letra fue
la primera decisión de arquitectura."*

## 10. Específico de PWA

Cosas que solo aplican por ser una aplicación web y que son fáciles de olvidar:

- **Viewport sin restricciones:** `<meta name="viewport" content="width=device-width,
  initial-scale=1, viewport-fit=cover">`. Sin `maximum-scale`, sin `user-scalable=no`
- **Tipografía en `rem`**, con `html { font-size: ... }` como ancla, para que el ajuste del
  navegador funcione
- **Objetivos táctiles con `min-height` y `min-width` en `px`**, no en `em`: no deben encogerse
  si el usuario baja el tamaño de letra
- **`touch-action: manipulation`** en los botones para eliminar el retardo de 300 ms del doble
  toque. Ese retardo se percibe como "la app no responde"
- **Nada de `:hover` como única señal.** En táctil no existe
- **Foco visible y grueso** (`outline: 3px solid`): hay usuarios con teclado externo o switch
- **Sin autoplay de audio al cargar.** El navegador lo bloquea igual, y asusta
- **Pantalla de carga con contenido, no con spinner.** El esqueleto de la pantalla real se
  entiende mejor que un círculo girando
- **Probarlo instalada**, no solo en la pestaña: en modo `standalone` no hay barra de navegación
  del navegador, así que **el botón de volver tiene que estar en la interfaz**. Es el error más
  común en PWA y deja al usuario atrapado
