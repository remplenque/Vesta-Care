from django.urls import path, include

from . import views

urlpatterns = [
    # AI Conversation endpoints
    path('chat/', views.conversation_view, name='chat'),
    path('process/', views.process_conversation, name='process_conversation'),
    path('', views.profile_selection_view, name='seleccion_perfil'),

]

'''
    path('inicio', views.index , name='index'),
   
    path('suma', views.suma , name='suma'),
    path('sumar', views.sumar , name='sumar'),
   
   
   
   
    path('login', views.login , name='login'),
    path('validar',views.validar, name='validar'),

    """ path('index',views.index, name='index'),
    path('index2',views.index2, name='index2'),
    path('suma', views.suma , name='suma'),
    path('sumar', views.sumar , name='sumar'),
    path('calculadora', views.calculadora , name='calculadora'),
    path('calcular', views.calcular , name='calcular'),
    path('menu', views.menu , name='menu'),
    path('crud', views.crud , name='crud'),
    path('cerrar', views.cerrar , name='cerrar'),

     path('persona_del/<str:pk>', views.personas_del , name='personas_del'),
    path('persona_edit/<str:pk>', views.personas_edit , name='personas_edit'),
    path('persona_add', views.personas_add, name='persona_add'),
    path('persona_agregar', views.personas_agregar , name='personas_agregar'),
    path('persona_actualizar', views.personas_actualizar , name='personas_actualizar'),
    path('login', views.login, name='login'),
    path('validar', views.validar, name='validar'),

    path('crud_productos', views.crud_productos, name='crud_productos'),
    path('productos_add', views.productos_add, name='productos_add'),
    path('productos_agregar', views.productos_agregar, name='productos_agregar'),
    path('productos_edit/<str:pk>', views.productos_edit, name='productos_edit'),
    path('productos_actualizar', views.productos_actualizar, name='productos_actualizar'),
    path('productos_del/<str:pk>', views.productos_del, name='productos_del'),

    path('grafico', views.personas_graficar, name='grafico'), """
    '''