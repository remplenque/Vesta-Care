"""The two presentations of the assistant: same person, different name, gender and voice.

This is the ONLY place in the codebase where the assistant's names are written by hand
(AGENTS.md §2). Everything else reads from here. Spec: docs/03-MODULE-ASISTENTE.md §2.
"""
import os

PERSONAS = {
    "mateo":  {"nombre": "Mateo",  "genero": "m", "parentesco": "sobrino",
               "articulo": "tu sobrino",  "pronombre": "él",
               "avatar_url": "/avatars/mateo.png",
               "voice_id": os.getenv("ELEVENLABS_VOICE_ID_MATEO")},
    "emilia": {"nombre": "Emilia", "genero": "f", "parentesco": "sobrina",
               "articulo": "tu sobrina", "pronombre": "ella",
               "avatar_url": "/avatars/emilia.png",
               "voice_id": os.getenv("ELEVENLABS_VOICE_ID_EMILIA")},
}


def assistant_block(agent_id: str) -> dict:
    """The derived `asistente` block that GET /v1/perfil exposes (docs/02-DATA-CONTRACTS.md §2)."""
    p = PERSONAS[agent_id]
    return {"id": agent_id, "nombre": p["nombre"], "genero": p["genero"],
            "parentesco": p["parentesco"], "articulo": p["articulo"],
            "avatar_url": p["avatar_url"]}
