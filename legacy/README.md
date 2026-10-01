# legacy/ — código heredado

**Solo lectura.** Se copia desde acá, no se edita acá. Lo vigente está en `AGENTS.md`.

| Carpeta | Qué es |
|---|---|
| `Mateo-main/` | Proyecto original del equipo (hackathon de Agentes IA, octubre 2025), descomprimido tal cual desde `Mateo-main.zip` (el zip sigue en la raíz) |
| `vesta-v3/` | Scaffold de la spec v3 (Flask + SQLite), descartada. Ver `vesta-v3/README.md` |

## Mateo-main → Vesta Care (plan Supabase)

El stack cambia: Mateo-main es Python (Flask + Pydantic AI) y Vesta es TypeScript (Next.js +
Vercel AI SDK). **No se copia código: se copian ideas, prompts y patrones.**

Rutas relativas a `Mateo-main/`.

| Legacy | Qué es | Uso en Vesta |
|---|---|---|
| `Backend/app.py:35` `MASTER_PROMPT` | Personalidad del sobrino de 15 años: respetuoso, curioso, preguntas de seguimiento, re-encarrilar, despedida corta | **Base del prompt de Mateo** (P3). Agregarle su nuevo rol: explicar alertas, sugerir, nunca diagnosticar, derivar al 131. Versión ya adaptada: `legacy/vesta-v3/server/agent/prompts/asistente.md` |
| `Backend/agent_model.py` | `AgentResponse`: salida estructurada con Pydantic | Mismo patrón con `generateObject` + Zod en el AI SDK. Útil para extraer la ficha PDF a JSON (acta §6, flujo 1) |
| `Backend/app.py:132` `ConversationReport` | Reporte de la conversación: resumen, ánimo, observaciones, temas | **Base del resumen diario** (acta §6, flujo 4). Quitar las "observaciones cognitivas" con tono clínico: Vesta no diagnostica |
| `Backend/app.py:170` `chat_history` | Historial en una variable global | En Vesta va a `chat_messages`, con RLS |
| `Backend/app.py:255` `call_elevenlabs()` | TTS con ElevenLabs y corta-fuegos de 1000 caracteres | **No se usa:** el acta eligió Web Speech API. Mejora opcional si la voz del navegador suena mal |
| `Backend/app.py:203` `get_news_headline()` | Titular de GNews para iniciar conversación | Sin destino. Idea P2 para que Mateo converse, no solo informe |
| `Backend/app.py:358` `send_simple_email()` | SendGrid con correos fijos | **Descartado.** Los avisos van por `outbound_messages` (WhatsApp simulado) |
| `Agente/instruccion.txt` | Primera versión de la persona | Referencia; `MASTER_PROMPT` es más nuevo |
| `Agente/cognitive_agent.py` | Bucle de voz por consola | **Descartado.** La voz es del navegador |
| `Agente/TOOLS.md` | Cómo registrar tools en Pydantic AI | Referencia conceptual para las tools del acta (`get_readings`, `explain_alert`…) |
| `Frontend/.../vistas/chat.html` | Chat de voz completo en una página | **Referencia de UI** para el chat de Mateo (P2/P3). Ver abajo |
| `Frontend/.../vistas/index.html` | Elección de perfil (Juanito / María) | Referencia para el onboarding |
| `Frontend/mateo/` (Django) | Servidor de plantillas | **Descartado** |

### Qué mirar en `chat.html`

| Línea | Qué hay | En Vesta |
|---|---|---|
| 984 | `webkitSpeechRecognition` | **Es exactamente la Web Speech API del acta.** Reutilizar la lógica de captura |
| 847 | Reproducción del audio con `new Audio()` | Con TTS del navegador pasa a ser `speechSynthesis` |
| 823 | `AGENTE_URL = 'http://127.0.0.1:5000'` fijo | Rutas relativas de Next.js |
| 1316, 1444 | `fetch` a `/respond` y `/start` | Route handler del chat con streaming |

## Bugs conocidos — no copiar los patrones

| Dónde | Bug | Lección |
|---|---|---|
| `Backend/app.py:482` y `:491` | `/respond` llama **dos veces** a ElevenLabs por turno | Una sola llamada por respuesta: doble latencia y doble costo |
| `Backend/app.py:267` | `voice_id` fijo dentro de la función | Configuración por `.env` |
| `Backend/app.py:437`, `:551` | Si falla la voz o el agente, responde HTTP 500 | La voz es opcional: responder igual con texto y un mensaje amable |
| `Backend/app.py:565` | `app.run(debug=True)` | El reloader duplica procesos en segundo plano |
| `Backend/app.py:247` | `print(... {e})` con `e` sin definir | Inofensivo, pero confunde al depurar |
| `Backend/app.py:415` | Lee `request.json` antes de verificar `is_json` | Validar el body primero (Zod en Vesta) |

## Ruido

- `Agente/temp_audio_playback.mp3`: archivo temporal del bucle de consola.
- `Frontend/mateo/funciones/texto.txt`: transcripción de PowerShell instalando Django.
- `Frontend/mateo/mateo/settings.py:23`: `SECRET_KEY` de desarrollo de Django (`django-insecure-…`).
  No se usa. No reutilizarlo.
