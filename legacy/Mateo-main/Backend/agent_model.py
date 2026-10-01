# agent_model.py
from pydantic import BaseModel, Field
from enum import Enum

class QuestionType(str, Enum):
    """
    Define los tipos de preguntas que 'Mateo' puede hacer 
    para forzar el razonamiento del usuario.
    """
    DEFINE_TERM = "DEFINE_TERM"       # "Qué es [X]?"
    CLARIFY_CAUSE = "CLARIFY_CAUSE"   # "Por qué [A] causa [B]?"
    REQUEST_JUSTIFICATION = "REQUEST_JUSTIFICATION" # "¿Por qué crees que es 'malo'?"
    REQUEST_SUMMARY = "REQUEST_SUMMARY"     # "Entonces, en resumen..."
    GENERIC_CURIOSITY = "GENERIC_CURIOSITY" # "No entiendo, cuéntame más."
    FINAL_GOODBYE = "FINAL_GOODBYE"       # "Gracias por todo, hasta luego."

class AgentResponse(BaseModel):
    """
    La respuesta estructurada del agente 'Mateo'.
    El LLM debe rellenar este objeto.
    """
    
    internal_thought: str = Field(
        description="Mi pensamiento interno sobre lo que Juanito acaba de decir y por qué hago esta pregunta."
    )
    
    question_type: QuestionType = Field(
        description="El tipo de pregunta que he decidido hacer para forzar la cognición."
    )
    
    spoken_question: str = Field(
        description="La pregunta exacta que diré en voz alta. Debe sonar ingenua, respetuosa y como un joven de 15 años."
    )