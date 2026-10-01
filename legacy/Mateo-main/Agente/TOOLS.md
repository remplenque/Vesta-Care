Herramientas (tools) del agente

Dónde están:
- Las "tools" del agente (funciones que el agente puede llamar) están definidas en `agente_cognitivo_libre.py` con el decorador `@agente_cognitivo.tool`.

Cómo añadir una nueva tool:
1. Abre `Agente/agente_cognitivo_libre.py`.
2. Crea una función que reciba `ctx: RunContext[GestorSesiones]` y los parámetros que necesites.
3. Añade `@agente_cognitivo.tool` justo encima de la función.

Ejemplo (resumen):

@agente_cognitivo.tool
def mi_tool(ctx: RunContext[GestorSesiones], param: str) -> dict:
    """Descripción breve"""
    # Implementa la lógica
    return {"resultado": True}

Notas:
- No es necesario un archivo separado llamado "tools" a menos que prefieras mantener funciones en otro módulo; si lo haces, importa el objeto `agente_cognitivo` y registra las funciones con el decorador o enlázalas desde el módulo principal.
- Mantén las tools simples y determinísticas; el agente las invocará cuando tenga sentido durante la conversación.
