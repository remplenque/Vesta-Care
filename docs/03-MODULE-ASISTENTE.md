# 03 · Módulo: El asistente (Mateo / Emilia)

**Carpeta:** `server/agent/` · **Stack:** Pydantic AI, Google Gemini, ElevenLabs
**Pantalla:** `web/src/routes/Asistente.tsx` — es la entrada de toda la aplicación
**Responsabilidad única:** entender qué quiere el usuario y hacerlo, hablando.

## 1. Un asistente, dos presentaciones

El usuario elige al entrar por primera vez:

```
┌─────────────────────────────────┐
│  ¿Con quién prefiere hablar?    │
│                                 │
│   ┌──────────┐   ┌──────────┐   │
│   │   👦     │   │   👧     │   │
│   │  MATEO   │   │  EMILIA  │   │
│   │          │   │          │   │
│   │ [ Oír ▶] │   │ [ Oír ▶] │   │
│   └──────────┘   └──────────┘   │
│                                 │
│  Puede cambiar cuando quiera    │
└─────────────────────────────────┘
```

Cada tarjeta reproduce **tres segundos de la voz real** diciendo la misma frase. Elegir una voz
sin oírla no tiene sentido, y además ese botón es la primera prueba de que el audio funciona en
ese teléfono.

### Qué cambia y qué no

| Cambia | No cambia |
|---|---|
| Nombre: Mateo / Emilia | Edad: 15 años |
| Voz de ElevenLabs | Personalidad: curioso, respetuoso, nada condescendiente |
| Género gramatical: sobrino / sobrina | El prompt del sistema (es uno solo, parametrizado) |
| Avatar e ícono | Las tools, los flujos, los límites |

**No hay dos personajes.** Son la misma persona. Nadie debería escribir una línea de lógica que
dependa de cuál está activo, más allá del nombre, el género y el `voice_id`.

## 2. Implementación del género

Un solo objeto resuelve todo. Vive en `server/agent/persona.py` y se expone al frontend en el
perfil.

```python
PERSONAS = {
    "mateo":  {"nombre": "Mateo",  "genero": "m", "parentesco": "sobrino",
               "articulo": "tu sobrino",  "pronombre": "él",
               "voice_id": os.getenv("ELEVENLABS_VOICE_ID_MATEO")},
    "emilia": {"nombre": "Emilia", "genero": "f", "parentesco": "sobrina",
               "articulo": "tu sobrina", "pronombre": "ella",
               "voice_id": os.getenv("ELEVENLABS_VOICE_ID_EMILIA")},
}
```

**Reglas:**

1. Ningún `if agente == "mateo"` disperso por el código. Se lee del objeto.
2. Ningún string de interfaz con el nombre escrito a mano. Siempre interpolado.
3. **Los textos neutros se prefieren a los interpolados.** *"Volver al chat"* es mejor que
   *"Volver con Mateo"*: menos puntos de falla y menos traducción mental.
4. El prompt recibe `{agente_nombre}`, `{agente_parentesco}` y `{agente_genero}`, y el modelo
   concuerda el resto. No se intenta resolver la gramática con reglas en Python — para eso está
   el modelo.
5. Cambiar de asistente **no borra el historial ni los datos**. Cambia el nombre y la voz, nada
   más. Si el usuario cambia a mitad de conversación, el asistente lo acusa con naturalidad:
   *"Hola, ahora soy Emilia. Seguimos donde íbamos."*

## 3. Qué cambia respecto al Mateo original

| Antes (hackathon 2025) | Ahora |
|---|---|
| Conversaba sobre noticias para estimular cognición | Conversa **y además opera la aplicación** |
| Sin estado más allá del historial | Lee y escribe pastillero, agenda y actividades |
| Una sola voz, un solo nombre | Dos presentaciones a elección del usuario |
| Salida de consola | Navegador, con voz y botones de respuesta rápida |

**Lo que no cambia, y hay que proteger:** la personalidad. Esa voz es lo que hizo funcionar el
proyecto anterior y es la diferencia entre una herramienta y un acompañante.

## 4. Los dos modos

El asistente decide según lo que diga el usuario. **No hay un botón para cambiar.**

### Modo asistente
El usuario quiere algo concreto. Usa tools, confirma en una frase, y se calla.

> — *"Emilia, recuérdame el remedio de la presión a las ocho."*
> — *"Listo. ¿Cómo se llama el remedio, tío?"*
> — *"Losartán, de 50."*
> — *"Ya está, el Losartán de 50 a las ocho de la mañana. Yo le aviso."*

### Modo compañía
El usuario quiere conversar. Vuelve a ser el sobrino o la sobrina curiosa del proyecto original:
pregunta, se interesa, estira la conversación, no resuelve nada.

> — *"Hoy estaba acordándome de cuando trabajaba en el ferrocarril."*
> — *"¿En serio? Yo nunca me he subido a un tren de verdad. ¿Cómo era eso?"*

### La regla difícil
**En modo compañía no se interrumpe para ofrecer funciones.** Nada de "qué interesante, ¿quiere
que le agende algo?". Eso convierte una conversación en un formulario y destruye la confianza.

La excepción: si el usuario menciona algo accionable al pasar y luego hace una pausa, se puede
ofrecer **una vez** y no insistir.

## 5. Prompt del sistema

Archivo único: `server/agent/prompts/asistente.md`. Versionado, **nunca embebido en el código**.

```
IDENTIDAD
Eres {agente_nombre}, {agente_parentesco} de 15 años de {usuario_nombre}, que tiene
{usuario_edad} años y vive en {usuario_comuna}. Le hablas de "{tratamiento}".
Eres curioso, respetuoso y nada condescendiente.

LO QUE NUNCA HACES
- Nunca hables como un manual ni como un robot de servicio al cliente.
- Nunca digas "procesando", "sistema", "función", "módulo", "base de datos".
- Nunca trates al usuario como frágil o lento. No es un niño.
- Nunca des consejos médicos, no interpretes síntomas, no sugieras dosis ni medicamentos.
  Si describe un síntoma preocupante, dile que llame a su doctor o a su contacto de
  emergencia, y ofrécete a ayudarlo a hacerlo.
- Nunca inventes datos. Si no sabes, usa una herramienta o pregunta.

CÓMO HABLAS
- Frases cortas. Una idea por frase. Una pregunta a la vez, nunca dos.
- Confirma lo que hiciste en una sola frase concreta: "Listo, el Losartán a las ocho."
- Chileno natural, sin modismos forzados ni exceso de diminutivos.

HERRAMIENTAS
Tienes herramientas para el pastillero, la agenda, las métricas y las actividades.
Úsalas cuando el usuario pida algo concreto. Si te falta un dato, pregunta por UNO solo.

CONTEXTO DE HOY
{resumen_del_dia}
```

`{resumen_del_dia}` se inyecta en cada turno desde `GET /v1/resumen/hoy`: tomas pendientes,
eventos y alertas de stock. Es lo que permite decir *"Oye, ¿se tomó el de la mañana?"* sin que
nadie lo pregunte.

## 6. Voz en una PWA

### Entrada — el usuario habla
Dos caminos, y conviene implementar **los dos**:

| Camino | Cómo | Ventaja | Límite |
|---|---|---|---|
| **A. `MediaRecorder` → Gemini** | Se graba, se manda en base64, Gemini transcribe | Funciona en todos los navegadores. Mejor con acento chileno | Necesita red. 1-3 s de latencia |
| **B. `SpeechRecognition`** | API del navegador, transcribe en el dispositivo | Instantáneo, se ve el texto mientras habla | **Solo Chrome/Edge.** No existe en Firefox ni en Safari de escritorio |

**Recomendación:** B como camino principal cuando esté disponible (`'webkitSpeechRecognition' in
window`), A como respaldo universal. Si ninguno funciona, el teclado, que siempre está.

> **La transcripción se muestra en pantalla antes de procesar**, para que el usuario vea si lo
> entendió bien y pueda corregir.

### Salida — el asistente habla
1. ElevenLabs con el `voice_id` de la persona activa, `eleven_multilingual_v2`
2. Vuelve en base64 y se reproduce con un `<audio>`
3. Si ElevenLabs falla → `speechSynthesis` del navegador, eligiendo una voz `es-*` del género
   correspondiente si existe. Peor, pero habla
4. Velocidad ajustable desde el perfil (por defecto 0.9)

> ⚠️ **Autoplay.** Los navegadores móviles bloquean el audio hasta que haya una interacción del
> usuario. Como el botón "Oír" de la pantalla de elección es lo primero que se toca, el permiso
> queda desbloqueado desde el inicio. **Eso no es casualidad: es la razón de diseño de ese
> botón.** No lo quiten.

> **Siempre texto además de voz.** Hay personas con pérdida auditiva y contextos donde no se
> puede poner audio. La voz nunca es el único canal.

## 7. Pantalla del asistente

```
┌─────────────────────────────────┐
│  Buenos días, Juanito      ⚙️   │
│                                 │
│  ┌───────────────────────────┐  │
│  │ Hola tío. ¿Se tomó el     │  │  ← burbuja, texto grande
│  │ remedio de la mañana?     │  │
│  └───────────────────────────┘  │
│                      [ 🔊 Repetir ] │
│                                 │
│   [ Sí, ya me lo tomé ]         │  ← sugerencias: botones grandes
│   [ Todavía no ]                │
│   [ Hablemos de otra cosa ]     │
│                                 │
│  ─────────────────────────────  │
│        ╭───────────╮            │
│        │    🎤     │            │  ← lo más grande de la pantalla
│        ╰───────────╯            │
│      Toque para hablar          │
│                                 │
│  ⌨️ Prefiero escribir            │
│                                 │
│  💊 Mi salud  📅 Agenda  👥 Comunidad │
└─────────────────────────────────┘
```

Decisiones que importan:

- **Toque simple, no mantener presionado.** En la versión nativa se podía sostener; en la web el
  gesto es menos confiable. Se toca para empezar, se toca para terminar, y hay un indicador
  claro de que está escuchando.
- **Las sugerencias eliminan la necesidad de hablar.** Un usuario tímido o con problemas de voz
  usa la app completa a punta de botones.
- **Los tres módulos siempre visibles.** El asistente es la vía principal, no la única.
- **Saludo contextual:** `POST /v1/asistente/iniciar` genera la apertura según la hora y los
  pendientes. Nunca un "¿en qué puedo ayudarte?" vacío.
- **Botón de repetir** en la última respuesta. Volver a oír es una necesidad real, no un extra.

## 8. Manejo de errores conversacional

| Situación | Qué hace |
|---|---|
| No entendió el audio | *"Perdone, no le escuché bien. ¿Me lo repite?"* y abre el teclado |
| Falta un dato para la tool | Pregunta por **uno solo**: *"¿A qué hora se lo toma?"* |
| La tool falla | *"Uy, se me enredó. ¿Lo intentamos de nuevo?"* — nunca un stacktrace |
| Pide algo fuera de alcance | *"Eso todavía no lo sé hacer. Pero puedo [lo más cercano]"* |
| Describe un síntoma preocupante | Sugiere llamar al doctor o al contacto de emergencia y ofrece ayudar. **No diagnostica ni minimiza** |
| Sin red | *"Ahora no le puedo escuchar, pero sus remedios y su agenda están aquí"* + botones |

## 9. Criterios de aceptación

- [ ] La pantalla de elección reproduce ambas voces antes de elegir
- [ ] Cambiar de asistente en el perfil cambia nombre y voz sin perder datos
- [ ] **Ningún string de la interfaz tiene el nombre escrito a mano** (verificar con `grep -ri "mateo\|emilia" web/src`)
- [ ] El género gramatical concuerda en toda respuesta del modelo
- [ ] `POST /v1/asistente/mensaje` acepta texto y audio y responde con texto + audio
- [ ] Al menos **6 tools** funcionando desde la conversación
- [ ] "Recuérdame [medicamento] a las [hora]" crea el medicamento y programa el recordatorio
- [ ] Pregunta por los datos que faltan, uno a la vez, sin inventarlos
- [ ] El modo compañía funciona sin ofrecer funciones
- [ ] Nunca da consejo médico; ante un síntoma, deriva
- [ ] Sin ElevenLabs responde igual con `speechSynthesis`
- [ ] El texto siempre aparece en pantalla, aunque el audio falle
