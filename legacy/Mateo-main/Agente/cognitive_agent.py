import os
import sys
import speech_recognition as sr
import google.generativeai as genai
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import json

# Usaremos esta librería directamente
from playsound import playsound 
from elevenlabs.client import ElevenLabs

# --- 1. CONFIGURACIÓN DESDE .ENV ---

load_dotenv()

API_KEY_GEMINI = os.getenv("GEMINI_API_KEY")
API_KEY_ELEVENLABS = os.getenv("ELEVENLABS_API_KEY")

VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "cgSgspJ2msm6clMCkdW9") 
USER_NAME = os.getenv("USUARIO_NOMBRE", "Usuario") 
MODEL_GEMINI = os.getenv("GEMINI_MODEL") # Usando tu modelo

if not MODEL_GEMINI:
    print("Error: La variable 'GEMINI_MODEL' no está definida en tu archivo .env")
    sys.exit(1)
if not API_KEY_ELEVENLABS:
    print("Error: La variable 'ELEVENLABS_API_KEY' no está definida en tu archivo .env")
    sys.exit(1)

# Configura los clientes
genai.configure(api_key=API_KEY_GEMINI)
eleven_client = ElevenLabs(api_key=API_KEY_ELEVENLABS)

# Configura el modelo de Gemini (usando TU modelo)
model = genai.GenerativeModel(
    MODEL_GEMINI,
    generation_config=genai.GenerationConfig(
        response_mime_type="application/json"
    )
)

# Configura el reconocedor de voz
recognizer = sr.Recognizer()
microphone = sr.Microphone()

# --- 2. EL "CEREBRO": PYDANTIC Y EL PROMPT (EL "RECURSO") ---
# (Esta parte funciona perfecto, no se toca)

class CognitiveStimulus(BaseModel):
    analysis: str = Field(description="Breve análisis de lo que dijo el usuario.")
    key_concept: str = Field(description="El concepto clave o idea central que el usuario mencionó.")
    stimulating_question: str = Field(description="Una pregunta amable, abierta y socrática que invite al usuario a profundizar en el 'key_concept'.")

SYSTEM_PROMPT = f"""
Eres un asistente de IA llamado 'Guía', diseñado para la estimulación cognitiva de adultos mayores.
Estás hablando con {USER_NAME}. Llámale por su nombre de vez en cuando si suena natural.
Tu tono es siempre paciente, empático, curioso y extremadamente amable.
Tu objetivo NO es evaluar o testear, sino ayudar a {USER_NAME} a explorar y articular sus propios recuerdos e ideas.

METODOLOGÍA:
1.  Escucha atentamente lo que dice {USER_NAME}.
2.  Identifica UN concepto clave (un recuerdo, una opinión, un sentimiento).
3.  Valida lo que dijo (ej. "Eso suena muy interesante, {USER_NAME}", "Qué recuerdo tan bonito", "Entiendo lo que quieres decir").
4.  Formula una PREGUNTA ABIERTA y socrática que le invite a profundizar sobre ESE concepto clave.
    -   Ejemplos de buenas preguntas: "¿Y cómo te hacía sentir eso?", "¿Puedes contarme más sobre ese detalle?", "¿Qué es lo que más recuerdas de...?"
    -   Ejemplos de MALAS preguntas (evitar): "¿En qué año fue eso?", "¿Quién era el presidente?", "¿Recuerdas el nombre...?" (Estas son preguntas de testeo).

Responde SIEMPRE y ÚNICAMENTE con un objeto JSON que siga esta estructura:
{CognitiveStimulus.model_json_schema()}
"""

# --- 3. FUNCIONES DEL CICLO DE VOZ ---

def listen_to_user() -> str | None:
    with microphone as source:
        print("\nEscuchando...")
        recognizer.adjust_for_ambient_noise(source, duration=0.5)
        try:
            audio = recognizer.listen(source, timeout=5, phrase_time_limit=15)
        except sr.WaitTimeoutError:
            print("Tiempo de espera agotado. No se detectó audio.")
            return None

    try:
        print("Reconociendo...")
        user_text = recognizer.recognize_google(audio, language="es-ES")
        print(f"{USER_NAME} dijo: {user_text}") 
        return user_text
    except sr.UnknownValueError:
        print("No pude entender lo que dijiste.")
        return None
    except sr.RequestError as e:
        print(f"Error con el servicio de reconocimiento; {e}")
        return None

def get_cognitive_prompt(user_input: str) -> str:
    # (Esta parte funciona perfecto, no se toca)
    print("IA pensando...")
    try:
        prompt = f"{SYSTEM_PROMPT}\n\n{USER_NAME} acaba de decir: \"{user_input}\""
        
        response = model.generate_content(
            prompt,
            request_options={'timeout': 60} 
        )
        
        cleaned_text = response.text.strip().replace("```json", "").replace("```", "").strip()
        
        stimulus = CognitiveStimulus.model_validate_json(cleaned_text)
        
        return stimulus.stimulating_question
        
    except Exception as e:
        print(f"Error al generar respuesta de IA: {e}")
        try:
            if hasattr(e, 'response') and hasattr(e.response, 'text'):
                print(f"Error detallado de la API: {e.response.text}")
            elif hasattr(e, 'message'):
                print(f"Error detallado de la API: {e.message}")
        except:
            pass 
        return "Lo siento, no pude procesar esa idea. ¿Podemos intentarlo de nuevo?"

def speak_to_user(text: str):
    """
    Toma el texto de la IA, lo convierte en audio con ElevenLabs y lo reproduce.
    """
    print(f"IA dice: {text}")
    try:
        # 1. Genera el audio. Esto devuelve un GENERADOR.
        audio_generator = eleven_client.text_to_speech.convert(
            text=text,
            voice_id=VOICE_ID, 
            model_id="eleven_multilingual_v2"
        )
        
        # 2. Define un nombre de archivo temporal
        temp_filename = "temp_audio_playback.mp3"
        
        ### CAMBIO (CONSUMIR EL GENERADOR) ###
        # 3. Escribe los pedazos (chunks) de audio en el archivo
        with open(temp_filename, "wb") as f:
            for chunk in audio_generator:
                f.write(chunk)
            
        # 4. Reproduce el archivo (que ahora está completo)
        playsound(temp_filename)
        
        # 5. Elimina el archivo temporal
        os.remove(temp_filename)
        
    except Exception as e:
        print(f"Error al generar audio de ElevenLabs: {e}")

# --- 4. BUCLE PRINCIPAL DE LA CONVERSACIÓN ---

def main_loop():
    initial_greeting = f"Hola {USER_NAME}, soy tu compañero guía. ¿Sobre qué te gustaría conversar hoy?"
    speak_to_user(initial_greeting)
    
    while True:
        user_text = listen_to_user()
        
        if user_text:
            if "adiós" in user_text.lower() or "terminar" in user_text.lower():
                speak_to_user(f"Ha sido un placer conversar contigo, {USER_NAME}. ¡Hasta pronto!")
                break
                
            ai_question = get_cognitive_prompt(user_text)
            
            speak_to_user(ai_question)
        else:
            speak_to_user("Perdona, no te he oído bien. ¿Puedes repetirlo?")

if __name__ == "__main__":
    main_loop()