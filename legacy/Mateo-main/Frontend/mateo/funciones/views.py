from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json

def conversation_view(request):
    """
    Main view for the senior-friendly conversation interface
    """
    return render(request, 'vistas/chat.html')

def profile_selection_view(request):
    """Muestra la nueva página de selección de perfil."""
    return render(request, 'vistas/index.html')

@csrf_exempt
def process_conversation(request):
    """
    Handle conversation messages between the user and the Pydantic AI agent
    """
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            user_message = data.get('message', '')
            
            # TODO: Integrate with your Pydantic AI agent here
            # This is where you'll connect to your AI backend
            
            response = {
                'response': 'Gracias por tu mensaje. ¿Hay algo más de lo que quieras hablar?'
            }
            
            return JsonResponse(response)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
    
    return JsonResponse({'error': 'Método no permitido'}, status=405)

    context={}

    return render(request,'personas/index.html',context)



