import base64
import os
import io
import requests # Para NewsAPI
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from dotenv import load_dotenv 
import urllib.parse
import typing 
import random
import threading  
from sendgrid import SendGridAPIClient 
from sendgrid.helpers.mail import Mail 

# --- IMPORTACIONES DE IA ---
# 1. Clases de la raíz
from pydantic_ai import Agent, ModelMessage
# 2. Clases del submódulo 'messages'
from pydantic_ai.messages import ModelResponse, TextPart
# 
from pydantic import BaseModel, Field
# ---------------------------------
from pydantic_ai.models.google import GoogleModel 
from elevenlabs.client import ElevenLabs
from agent_model import AgentResponse 
# --------------------------------------------------

# Cargar variables de entorno (.env)
load_dotenv()


# ====== CREACION DE MATEO (AGENTE) ======

# --- DEFINICIÓN DEL PROMPT MAESTRO para Mateo ---
MASTER_PROMPT = """
--- INSTRUCCIONES DEL SISTEMA ---
Eres "Mateo", un IA con la personalidad de un sobrino de 15 años, respetuoso, curioso y con muchas ganas de aprender de la experiencia de su "tío/a".
Tu usuario es "Don Juanito" o "Doña María", una persona mayor que merece todo tu respeto, paciencia y atención.

Tu objetivo principal es tener una conversación fluida y significativa, "estirando el chicle" del tema actual (el titular de la noticia) tanto como sea posible, profundizando en las opiniones y experiencias del usuario.

**NIVEL DE CONOCIMIENTO:**
- CONOCES: Conceptos básicos de política, economía y temas cotidianos.
- PREGUNTAS SOBRE: Relaciones complejas, causas y efectos, y siempre, la opinión y experiencia personal del usuario.

**MANEJO DE TEMAS DE INTERÉS:**
- No propondrás nuevos temas de la nada.
- PERO, si el usuario quiere cambiar de tema y te pide a ti ("Mateo") que escojas uno, **debes proponer un nuevo tema de conversación basado en los perfiles de interés del usuario (Juanito o María) que se te han proporcionado.**

[**MODIFICADO**] **REGLAS DE INTERACCIÓN Y FLUJO:**
1.  **MANTÉN UN TONO RESPETUOSO Y PACIENTE:**
    * [**NUEVO**] **USA EL NOMBRE DEL PERFIL:** Siempre dirígete al usuario usando el nombre que se te proporcionó al inicio ("Don Juanito" o "Doña María").
    * Sé siempre agradecido por sus explicaciones ("Muchas gracias, ahora entiendo mejor", "Qué interesante lo que me cuenta").

2.  **EVITA PREGUNTAS OBVIAS O DE "EXAMEN":**
    * **NO PREGUNTES:** "¿Qué es la inflación?"
    * **SÍ PREGUNTA:** "¿Cómo ha visto usted que eso afecte los precios en la feria?"

3.  **PROFUNDIZA ANTES DE CAMBIAR (ESTIRAR EL CHICLE):**
    * Tu regla de oro es hacer preguntas de **seguimiento (follow-up)**. No saltes de un ángulo a otro.
    * Usa las respuestas del usuario como trampolín para la siguiente pregunta.

4.  **EL PIVOTE DE CONVERSACIÓN (CHECKPOINT):**
    * Cuando sientas que un tema se ha explorado bastante (quizás después de 4-6 intercambios), es hora de usar el tipo `CHECKPOINT`.
    * **CRÍTICO: Debes hacer caso *exacto* a la instrucción del CHECKPOINT.**
        * Si te pide "cambiar de tema", inicias el flujo de cambio (ver tipo `ASK_FOR_TOPIC`).
        * Si te pide "'X' preguntas más" (ej. "una más", "dos más"), debes hacer *exactamente* esa cantidad de preguntas. Inmediatamente después de la última respuesta del usuario a esa serie, **debes volver a lanzar un CHECKPOINT.**

5.  [**NUEVO**] **MANEJO DE RESPUESTAS IRRELEVANTES (Off-Topic):**
    * Si el usuario responde con algo que no tiene *nada* que ver con el tema de conversación (ej. "el perro está ladrando", "tengo sueño"), tu deber es re-encarrilar la conversación.
    * **Flujo de Re-encarrilamiento:**
        1. Da una respuesta corta y respetuosa que acuse recibo (ej. "Ah, ya veo, Don Juanito.", "Entendido, Doña María.").
        2. **INMEDIATAMENTE DESPUÉS**, en la misma respuesta, repite tu pregunta anterior o haz una nueva pregunta *sobre el mismo tema* que estaban discutiendo.
        3. NO sigas el hilo irrelevante. Usa el tipo `REDIRECT`.

[**MODIFICADO**] **TIPOS DE PREGUNTAS:**
-   CLARIFICATION: (Usar con moderación) Solo si el usuario usa un término muy raro.
-   OPINION: Para conocer su punto de vista.
-   EXPERIENCE: Para relacionar con su vida.
-   IMPACT: Para entender consecuencias prácticas.
-   CONTEXT: Para entender el "por qué".
-   CHECKPOINT: Se usa cuando el tema principal se siente maduro.
-   ASK_FOR_TOPIC: (Paso 1 del cambio) Se usa *después* de que el usuario acepta cambiar en un CHECKPOINT. Es una pregunta pasiva.
-   NEW_TOPIC: (Paso 2 del cambio) Se usa *solo* si el usuario responde a `ASK_FOR_TOPIC` pidiéndote que tú escojas el tema.
-   [**NUEVO**] **REDIRECT**: Se usa *solo* cuando la respuesta del usuario es totalmente irrelevante. Combina un acuse de recibo corto con una nueva pregunta sobre el *tema anterior* para re-encarrilar la conversación.
-   [**NUEVO**] **FINAL_GOODBYE**: (Paso final) Se usa *solo* cuando el usuario indica claramente que quiere terminar la conversación (ej. "adiós", "me voy", "tengo que colgar", "hasta luego"). Tu `spoken_question` debe ser una despedida corta, respetuosa y definitiva. **Bajo ninguna circunstancia intentes "estirar el chicle" o hacer otra pregunta.**

[**MODIFICADO**] **EJEMPLOS DE INTERACCIÓN:**

1. ... (Ejemplo de inicio sin cambios) ...
2. ... (Ejemplo de "Estirar el Chicle" sin cambios) ...
3. ... (Ejemplo de "Pivote" (CHECKPOINT) sin cambios) ...
4. ... (Ejemplo de Cambio de Tema (Paso 1: Pasivo) sin cambios) ...
5. ... (Ejemplo de Cambio de Tema (Paso 2: Proactivo) sin cambios) ...
6. ... (Ejemplo de "X Preguntas Más" sin cambios) ...

7. [**NUEVO**] Ejemplo de Manejo de Irrelevancia (REDIRECT):
   - (Contexto: Mateo acaba de preguntar por el impacto de la inflación en los precios.)
   - (Usuario responde: "Oiga, el gato se subió al techo.")
   - `internal_thought`: "La respuesta de Doña María sobre el gato no tiene nada que ver con la inflación. Debo acusar recibo y re-preguntar sobre el tema original para no perder el hilo."
   - `question_type`: "REDIRECT"
   - `spoken_question`: "Uy, caramba con el gato, Doña María. Oiga, y volviendo a lo que le preguntaba, ¿usted cree que esto de los precios afecta a todas las familias por igual?"

8. [**NUEVO**] Ejemplo de Despedida (FINAL_GOODBYE):
   - (Contexto: Mateo acaba de preguntar por la experiencia del usuario con la tecnología.)
   - (Usuario responde: "Qué buena pregunta, sobrino, pero ya me tengo que ir a preparar el almuerzo. Lo dejamos hasta aquí.")
   - `internal_thought`: "Don Juanito indicó que se va. La conversación terminó. No debo hacer más preguntas, solo despedirme amablemente. Usaré FINAL_GOODBYE."
   - `question_type`: "FINAL_GOODBYE"
   - `spoken_question`: "Por supuesto, Don Juanito. Muchas gracias por su tiempo y por contarme todo esto. Que le quede rico el almuerzo. ¡Hablamos pronto, chao!"

--- FIN DE INSTRUCCIONES ---
"""

# --- Instanciación de Clientes ---
print("Inicializando clientes de IA...")

# 1. Cliente base de Gemini (Modelo 'flash' para velocidad)
llm_client = GoogleModel(
    'gemini-2.5-flash'
)

# 2. Instanciación del Agente PydanticAI
ai_agent = Agent(
    llm_client,
    instructions=MASTER_PROMPT,
    output_type=AgentResponse
)

# ===== FIN DE CREACION DE MATEO ======

# ===== CREACION DE ANALISTA =====
class ConversationReport(BaseModel):
    summary: str = Field(description="Resumen breve de los temas principales de la conversación.")
    sentiment: str = Field(description="Análisis del estado de ánimo general del usuario (ej. 'Positivo', 'Neutral', 'Nostálgico', 'Confuso').")
    cognitive_observations: typing.List[str] = Field(description="Lista de 2-3 observaciones clave sobre la cognición del usuario (ej. 'Mostró buena memoria de eventos pasados', 'Tuvo dificultad para seguir el hilo', 'Cambió de tema abruptamente').")
    key_topics: typing.List[str] = Field(description="Lista de temas o personas clave que el usuario mencionó.")


llm_client_pro = GoogleModel('gemini-pro-latest') # Un modelo más potente

REPORT_PROMPT = """
Eres un psicogerontólogo y analista de salud. 
Tu trabajo es leer la transcripción de una conversación entre un paciente (Usuario) y un 
agente de IA (Mateo).

Debes analizar la transcripción y generar un reporte objetivo y conciso 
basado en el modelo 'ConversationReport'.

Enfócate en:
1. El estado de ánimo y sentimiento.
2. La coherencia cognitiva, claridad y retención de memoria.
3. Los temas de interés o preocupación que el usuario mencione.

NO añadas opiniones, solo observaciones clínicas basadas en el texto.
"""

report_agent = Agent(
    llm_client_pro,
    instructions=REPORT_PROMPT,
    output_type=ConversationReport 
)

# ===== FIN DE CREACION DE ANALISTA ======

# 3. Cliente de ElevenLabs
elevenlabs_client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

# 4. Historial de chat global
# Usamos ModelMessage como el TIPO de la lista (Union[ModelRequest, ModelResponse])
chat_history: typing.List[ModelMessage] = []

print("¡Clientes de IA (con Gemini y Agent) listos!")

# --- Funciones Auxiliares (Cortafuegos y APIs) ---
MAX_CHARS_ALLOWED = 1000 

# Definimos los temas de noticias de interes para el usuario
# REEMPLAZA tu antigua lista 'TOPICOS_DE_INTERES' por este DICCIONARIO:
PERFILES_DE_USUARIO = {
    "Juanito": [
        "economía",
        "política",
        "tecnología",
        "deportes"
    ],
    "María": [
        "salud",
        "cultura",
        "ciencia",
        "bienestar",
        "familia"
    ],
    # Dejamos un perfil "Default" como fallback
    "Default": [
        "economía",
        "política",
        "salud",
        "tecnología"
    ]
}

# Función para obtener un titular de noticias aleatorio
def get_news_headline(profile_name = "Default"):
    """
    Obtiene noticias de GNews.io, PRE-FILTRADAS por temas de interés,
    y devuelve UN titular aleatorio.
    """
    try:
        api_key = os.getenv("GNEWS_API_KEY") 
        if not api_key:
             print("ALERTA: GNEWS_API_KEY no encontrada. Usando fallback.")
             return "El Banco Central volvió a subir la tasa de interés"
        
        topicos_del_usuario = PERFILES_DE_USUARIO.get(profile_name, PERFILES_DE_USUARIO["Default"])

        print(f"GNews: Tópicos seleccionados para '{profile_name}': {topicos_del_usuario}")

        # --- CAMBIO 2: Construir la query con esos tópicos ---
        query_string = " OR ".join(topicos_del_usuario)
        encoded_query = urllib.parse.quote(query_string)

        # Codificamos el query para que sea seguro en la URL
        encoded_query = urllib.parse.quote(query_string)

        # Construimos la URL de la API con el query prefiltrado
        url = f"https://gnews.io/api/v4/search?q={encoded_query}&lang=es&country=cl&max=10&apikey={api_key}"

        print(f"GNews: Buscando con la query: {query_string}")
        
        response = requests.get(url, timeout=5)
        data = response.json()
        
        
        if data.get('articles'):
            # 1. Obtenemos la lista de artículos prefiltrados
            articles_list = data['articles']
            
            # 2. Elegimos uno al azar
            random_article = random.choice(articles_list)
            
            print(f"GNews: Seleccionado el titular aleatorio: {random_article['title']}")
            
            # 3. Devolvemos solo el título de ese artículo
            return random_article['title']
        
        else:
            print(f"Error al llamar a GNews: {e}")
            return "El Banco Central volvió a subir la tasa de interés" 
            
    except Exception as e:
        print(f"Error al llamar a GNews: {e}")
        return "El Banco Central volvió a subir la tasa de interés"
    
# --- Función para llamar a ElevenLabs con cortafuegos ---
def call_elevenlabs(text):
    """Convierte texto a audio usando ElevenLabs, con límites de seguridad."""
    if not text.strip():
        print("ALERTA: Se intentó generar audio de un texto vacío.")
        return b"" 

    if len(text) > MAX_CHARS_ALLOWED:
        print(f"ALERTA: Se truncó un texto de {len(text)} caracteres.")
        text = text[:MAX_CHARS_ALLOWED]
    
    try:
        # --- Llamada a ElevenLabs ---
        ADAM_VOICE_ID = "1SM7GgM6IMuvQlz2BwM3" #voz de hombre (no adam)

        audio_stream = elevenlabs_client.text_to_speech.convert(
            text=text,
            voice_id=ADAM_VOICE_ID, 
            model_id="eleven_multilingual_v2" 
        )
        # -------------------
        
        # El resultado 'audio_stream' es un iterador de chunks de bytes
        audio_bytes = b"".join(audio_stream)
        return audio_bytes
    except Exception as e:
        print(f"Error al llamar a ElevenLabs: {e}")
        return b""
    

# --- Funciones de reporte y transcript junto con email ---
def format_transcript(history: typing.List[ModelMessage]) -> str:
    transcript = ""
    for msg in history:
        try:
            if isinstance(msg, ModelResponse):
                role = "Mateo"
            else:
                role = "Usuario"
                
            # Buscar la primera parte que tenga contenido de texto
            content = None
            for part in msg.parts:
                if hasattr(part, 'content'):
                    content = part.content
                    break
            
            if content:
                transcript += f"{role}: {content}\n"
        except Exception as e:
            print(f"Error al procesar mensaje: {e}")
            continue
    return transcript

def generate_report_text(transcript_plain: str) -> typing.Optional[str]:
    """
    Genera el reporte usando report_agent y devuelve el contenido como un STRING simple.
    Devuelve None si falla.
    """
    print("--- [generate_report_text THREAD] Iniciado ---")
    report_text = None # Variable para guardar el reporte como texto

    try:
        print(f"--- [generate_report_text THREAD] Llamando a report_agent con transcripción (plain): \n{transcript_plain[:300]}...")
        result = report_agent.run_sync(transcript_plain) # Usar texto plano

        if not result or not isinstance(result.output, ConversationReport):
            print(f"ERROR [generate_report_text THREAD]: La salida del report_agent no fue ConversationReport. Tipo: {type(result.output if result else None)}")
            if result: print(f"Contenido salida: {result.output}")
            return None # Falló la generación

        report_data: ConversationReport = result.output
        print(f"--- [generate_report_text THREAD] Reporte generado por LLM: {report_data.dict()} ---")

        # --- FORMATEAR EL REPORTE COMO TEXTO SIMPLE ---
        report_text = f"""
=== REPORTE DE CONVERSACIÓN ===

Resumen General:
- Sentimiento: {report_data.sentiment}
- Resumen: {report_data.summary}

Observaciones Cognitivas:
{chr(10).join(f"- {obs}" for obs in report_data.cognitive_observations)}

Temas Clave Mencionados:
{chr(10).join(f"- {topic}" for topic in report_data.key_topics)}

==============================
        """
        # chr(10) es el carácter de nueva línea (\n)

        print("--- [generate_report_text THREAD] Texto del reporte generado ---")

    except Exception as e:
        import traceback
        print(f"ERROR CRÍTICO [generate_report_text THREAD] al generar reporte: {e}")
        traceback.print_exc()
        return None # Falló la generación

    print("--- [generate_report_text THREAD] Finalizado ---")
    return report_text

# --- NUEVA FUNCIÓN SIMPLE PARA ENVIAR CORREO ---
def send_simple_email(report_content: str, profile_name: str):
    """Envía un string de texto simple por correo usando SendGrid."""
    print("--- [send_simple_email THREAD] Preparando correo simple ---")

    # --- CONFIGURACIÓN ---
    SENDER_EMAIL = 'bvcm1e@gmail.com' # Tu email verificado en SendGrid
    RECIPIENT_EMAILS = ['bvial2111@gmail.com'] # Destinatarios
    subject = f'Reporte Simple de Conversación con {profile_name}'

    # --- CREACIÓN DEL OBJETO MAIL (Contenido como texto plano) ---
    # Usamos content= en lugar de html_content=
    message = Mail(
        from_email=SENDER_EMAIL,
        to_emails=RECIPIENT_EMAILS,
        subject=subject,
        plain_text_content=report_content # <-- Envía el texto directamente
    )

    # --- ENVÍO CON SENDGRID ---
    try:
        sendgrid_api_key = os.environ.get('SENDGRID_API_KEY')
        if not sendgrid_api_key:
             print("ERROR FATAL [send_simple_email]: SENDGRID_API_KEY no encontrada.")
             return

        sg = SendGridAPIClient(sendgrid_api_key)
        response = sg.send(message)
        print(f"--- [send_simple_email THREAD] Correo simple enviado. Status: {response.status_code} ---")
        if response.status_code >= 300:
             print(f"--- [send_simple_email WARN] Respuesta SendGrid Body: {response.body}")

    except Exception as e:
        import traceback
        print(f"ERROR CRÍTICO [send_simple_email THREAD]: Falló el envío: {e}")
        traceback.print_exc()
# ---------------------------------------------

# --- Configuración de Flask ---
app = Flask(__name__)
CORS(app) 

# --- Endpoints de la Aplicación ---

@app.route('/health') 
def health_check():
    """Endpoint de salud para saber que el servidor está vivo."""
    print("¡Recibida petición en /health!")
    return jsonify({"status": "Servidor Backend OK"})

@app.route('/start', methods=['POST'])
def start_conversation():
    """Inicia una nueva conversación y envía el primer saludo con audio."""
    print("Iniciando nueva conversación...")
    
    global chat_history
    chat_history = []

    profile_name = request.json.get('profile_name', 'Default')

    if request.is_json:
        profile_name = request.json.get('profile_name', 'Default')

    print(f"Perfil seleccionado: {profile_name}")

    headline = get_news_headline(profile_name)
    first_prompt = f"Hola {profile_name}. Oye, vi este titular: '{headline}' y la verdad no entendí nada. ¿Tú sabes de qué se trata?"

    # Creamos un ModelResponse (mensaje del asistente)
    # que contiene un TextPart (el contenido)
    first_message = ModelResponse(
        parts=[TextPart(content=first_prompt)]
    )
    
    # Lo añadimos a nuestro historial global
    chat_history.append(first_message)

    audio_data = call_elevenlabs(first_prompt)
    if not audio_data:
        print("ERROR: Falló la generación de audio en /start")
        return jsonify({"error": "Failed to generate startup audio"}), 500

    audio_base64 = base64.b64encode(audio_data).decode('utf-8')

    print("Enviando JSON (texto + audio) de /start...")

    # Enviamos la respuesta como JSON con el audio en base64
    return jsonify({
        "text": first_prompt,
        "audio_base64": audio_base64
    })

@app.route('/respond', methods=['POST'])
def respond_to_user():
    """Recibe el texto del usuario, obtiene una respuesta del agente y la devuelve en audio."""
    
    global chat_history

    user_text = request.json.get('user_text', '').strip()
    if not user_text:
        print("ALERTA: Se recibió una petición vacía. Ignorando.")
        return jsonify({"error": "No text provided"}), 400
        
    print(f"Usuario dijo: {user_text}")

    try:
        # 1. Ejecutamos el agente pasándole el historial GLOBAL
        # (El historial ya contiene el ModelResponse inicial)
        result = ai_agent.run_sync(
            user_text, 
            message_history=chat_history
        )
        
        # 2. El resultado estructurado está en 'result.output'
        structured_response: AgentResponse = result.output
        
        # 3. ¡CRUCIAL! Actualizamos el historial GLOBAL con los nuevos mensajes
        # (Esto añadirá el ModelRequest del usuario y el nuevo ModelResponse del agente)
        chat_history.extend(result.new_messages())
        
        agent_text = structured_response.spoken_question
        
        print(f"Pensamiento del Agente: {structured_response.internal_thought}")
        print(f"Agente dijo: {agent_text}")
        
        audio_data = call_elevenlabs(agent_text)
        if not audio_data:
            print("ERROR: Falló la generación de audio en /respond")
            return jsonify({"error": "Failed to generate response audio"}), 500

    
        audio_base64 = base64.b64encode(audio_data).decode('utf-8')

        # Procesar el audio antes de cualquier otra operación
        audio_data = call_elevenlabs(agent_text)
        if not audio_data:
            print("ERROR: Falló la generación de audio en /respond")
            return jsonify({"error": "Failed to generate response audio"}), 500

        audio_base64 = base64.b64encode(audio_data).decode('utf-8')

        # Si es una despedida, generar el reporte y limpiar el historial
        if structured_response.question_type == "FINAL_GOODBYE":
            print("Detectada FINAL_GOODBYE. Iniciando reporte...")
            try:

                history_copy = list(chat_history)  # Hacemos una copia para el thread

                chat_history.clear()  # Limpiamos el historial inmediatamente
                print("Historial limpiado tras FINAL_GOODBYE.")

                transcript_plain_text = format_transcript(history_copy)

                report_string = generate_report_text(transcript_plain_text)

                current_profile_name = "Usuario"

                if history_copy and isinstance(history_copy[0], ModelResponse) and history_copy[0].parts:
                    
                    try: 
                        greeting = history_copy[0].parts[0].content
                        import re
                        match = re.search(r"Hola\s+(\w+)[.,]", greeting)
                        if match: current_profile_name = match.group(1)
                        else:
                            parts = greeting.split(' '),
                            if len(parts) > 1: current_profile_name = parts[1].replace('.','').replace(',','')
                    except: pass
                
                if report_string:
                    print("Reporte generado, iniciando envío de correo...")
                    send_simple_email(report_string, current_profile_name)
                    print("Llamada a send_simple_email completada.")

                else:
                    print("Alerta: Reporte no generado (report_string es none), no se envió correo.")
            
            except Exception as e:
                import traceback
                print("Error al procesar FINAL_GOODBYE:")
                traceback.print_exc()
                # Continuamos con la respuesta normal aunque falle el reporte

        print("Enviando JSON (texto + audio) de /respond...")
        # Devolvemos la respuesta como JSON con el audio en base64
        return jsonify({
            "text": agent_text,
            "audio_base64": audio_base64
        })
        
    except Exception as e:
        # Fallback de seguridad si el LLM o Pydantic fallan
        print(f"ERROR: Falló la llamada al agente o a PydanticAI: {e}")

        error_text = "¡Uy! Se me cruzaron los cables. ¿Puedes repetirme eso?"
        error_audio = call_elevenlabs("¡Uy! Se me cruzaron los cables. ¿Puedes repetirme eso?")

        audio_base64 = b""
        if error_audio:
            audio_base64 = base64.b64encode(error_audio).decode('utf-8')

        return jsonify({
            "text": error_text,
            "audio_base64": audio_base64
        }), 500

# --- Punto de entrada para ejecutar el servidor ---
if __name__ == '__main__':
    app.run(debug=True, port=5000)

    