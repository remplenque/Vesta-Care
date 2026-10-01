# legacy/ — código heredado

`Mateo-main/` es el proyecto original del equipo (hackathon de Agentes IA, octubre 2025),
descomprimido tal cual desde `Mateo-main.zip` (el zip original sigue en la raíz del repo). **Solo lectura:** se copia desde acá, no se edita acá
(`AGENTS.md` §3).

Plan de migración en orden: `docs/07-MODULE-BACKEND.md` §1.

## Mapa: qué va a dónde

Rutas relativas a `Mateo-main/`.

| Legacy | Qué es | Destino en Vesta | Notas |
|---|---|---|---|
| `Backend/app.py:35` `MASTER_PROMPT` | Personalidad del sobrino: "estirar el chicle", seguimiento, re-encarrilar, despedida | `server/agent/prompts/asistente.md`, sección modo compañía | Ya incorporado. El resto del prompt legacy (tipos `CHECKPOINT`, `NEW_TOPIC`…) era para conversar sobre noticias |
| `Backend/app.py:123` `ai_agent` | `Agent(GoogleModel('gemini-2.5-flash'), output_type=AgentResponse)` | `server/agent/asistente.py` | Gana `deps` y tools. El `output_type` pasa a `{texto, sugerencias, navegar_a}` (`02` §10) |
| `Backend/app.py:170` `chat_history` | Historial global | `server/agent/asistente.py` | **Se deja global** (`07` §1) |
| `Backend/app.py:255` `call_elevenlabs()` | TTS con corta-fuegos de 1000 caracteres | `server/voice.py` | Recibe `voice_id` desde `persona.py`. Conservar el corta-fuegos |
| `Backend/app.py:132` `ConversationReport` | Reporte de la conversación con `gemini-pro-latest` | Resumen semanal (P2) | Sin destino en el MVP |
| `Backend/app.py` `/health`, `/start`, `/respond` | Endpoints | `server/app.py` → `/v1/asistente/iniciar`, `/v1/asistente/mensaje` | Mantener los viejos como alias. Cambian las claves: `user_text` → `texto`, `text` → `texto` |
| `Backend/app.py:203` `get_news_headline()` | Titular de GNews según perfil | Sin destino | v3 no lo menciona y `GNEWS_API_KEY` no está en `.env.example`. Candidato P2 para abrir el modo compañía |
| `Backend/app.py:358` `send_simple_email()` | SendGrid con correos fijos | **Descartado** | `AGENTS.md` §3 |
| `Backend/agent_model.py` | `AgentResponse` y `QuestionType` | Referencia para `server/models.py` | Patrón de salida estructurada; el esquema cambia |
| `Agente/instruccion.txt` | Primera versión de la persona | Referencia para el prompt | Versión más vieja que `MASTER_PROMPT` |
| `Agente/cognitive_agent.py` | Bucle de voz por consola (`speech_recognition` + `playsound`) | **Descartado** | El micrófono ahora es del navegador. Usa otro SDK (`google.generativeai`) |
| `Agente/TOOLS.md` | Cómo registrar tools con `@agent.tool` | Referencia para `server/agent/tools.py` | Nombra `agente_cognitivo_libre.py`, que no está en el zip |
| `Frontend/.../vistas/chat.html` | Chat de voz completo | Referencia de UI para `web/src/routes/Asistente.tsx` | Ver detalle abajo |
| `Frontend/.../vistas/index.html` | Elección de perfil (Juanito / María) | Referencia para la pantalla de elección de asistente | |
| `Frontend/mateo/` (Django) | Servidor de plantillas | **Descartado** | Flask sirve la PWA |
| `requirements.txt` | Dependencias | `server/requirements.txt` | Quitar `django` y `sendgrid`; agregar `apscheduler` y `pywebpush` |

### Qué mirar en `chat.html`

| Línea | Qué hay | En Vesta |
|---|---|---|
| 823 | `AGENTE_URL = 'http://127.0.0.1:5000'` fijo | Todo pasa por `web/src/lib/api.ts`, mismo origen |
| 847 | Reproducción del audio base64 con `new Audio()` | Salida de voz (`03` §6) |
| 984 | `webkitSpeechRecognition` | Camino B de entrada de voz (`03` §6) |
| 1316, 1444 | `fetch` a `/respond` y `/start` | `/v1/asistente/mensaje` y `/v1/asistente/iniciar` |

## Bugs conocidos — no copiarlos

| Dónde | Bug | Al migrar |
|---|---|---|
| `Backend/app.py:482` y `:491` | `/respond` llama **dos veces** a ElevenLabs por turno: el doble de latencia y de créditos | Una sola llamada |
| `Backend/app.py:267` | `voice_id` fijo dentro de la función | Viene de `persona.py` |
| `Backend/app.py:437` | Si ElevenLabs falla, `/start` responde 500 | Responder con `audio_base64: null` (`07` §8) |
| `Backend/app.py:551` | El mensaje de error del agente sale con HTTP 500 | Responder 200 con texto amable (`03` §8) |
| `Backend/app.py:565` | `app.run(debug=True)`: el reloader duplica el scheduler | `use_reloader=False` (`07` §5) |
| `Backend/app.py:247` | `print(... {e})` con `e` sin definir en la rama `else` | Inofensivo (cae al `except`), pero confunde |
| `Backend/app.py:415` | Lee `request.json` antes de verificar `is_json` | Validar el body primero |
| `Backend/app.py` + `README.md` | Usa `GOOGLE_API_KEY` implícita; Vesta define `GEMINI_API_KEY` | Pasar la clave explícita al provider (`docs/10-OPEN-ISSUES.md` #12) |

## Ruido

- `Agente/temp_audio_playback.mp3`: archivo temporal del bucle de consola.
- `Frontend/mateo/funciones/texto.txt`: transcripción de PowerShell instalando Django.
- `Frontend/mateo/mateo/settings.py:23`: `SECRET_KEY` de desarrollo de Django (`django-insecure-…`).
  Vesta no lo usa. No reutilizarlo.
