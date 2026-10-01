# 05 · Módulo: Comunidad (actividades)

**Archivo:** `server/modules/community.py` · **Pantalla:** `web/src/routes/Comunidad.tsx`
**Responsabilidad única:** que el usuario encuentre algo que hacer, se inscriba, y vaya.

## 1. Por qué este módulo existe

La soledad no acompañada tiene efecto medible sobre la salud física y cognitiva. El pastillero
cuida el cuerpo; este módulo cuida lo otro, que a largo plazo pesa igual o más.

**Inspiración declarada:** la charla de **Michelle, CEO de BondUp**, sobre generar comunidad en
torno a la persona mayor para mantenerla activa y conectada, y así retrasar o evitar la
institucionalización.

> ⚠️ **Honestidad obligatoria.** No tenemos acuerdo, convenio ni integración con BondUp. En el
> pitch y en la interfaz se dice **"inspirado en"**, nunca "junto a" ni "en alianza con". Si
> aparece el logo de BondUp en una slide sin permiso, el equipo queda mal parado.
>
> **Acción recomendada antes del evento:** escribirle a Michelle contándole la idea. Un correo
> suyo diciendo que le parece interesante convierte una suposición en validación real.

## 2. El flujo completo

```
Emilia: "Oiga tío, el sábado hay un taller de memoria cerca de su casa. ¿Le tinca?"
   │
   ├─► el usuario dice que sí
   ▼
inscribir_actividad()
   ├─► crea la inscripción
   ├─► crea el evento en la agenda
   └─► devuelve los recordatorios (un día antes, una hora antes)
   ▼
se programan por los dos caminos: APScheduler en el servidor,
IndexedDB en el teléfono (ver 06-MODULE-AGENDA.md §4)
   ▼
El sábado a las 17:00: "En una hora es su taller en el Centro Cultural"
```

Una frase del usuario, cuatro cosas que pasan. **Eso es lo que ninguna app suelta hace.**

## 3. Catálogo

### Vista de descubrimiento
Tarjetas grandes, una encima de otra, scroll vertical. **Nada de grillas ni carruseles
horizontales** — son difíciles de operar con poca motricidad fina y en la web el scroll
horizontal se confunde con el gesto de volver atrás del navegador.

```
┌─────────────────────────────────┐
│  Para usted, esta semana        │
│                                 │
│  ┌───────────────────────────┐  │
│  │  [imagen]                 │  │
│  │  Taller de memoria        │  │
│  │  Sábado 4, 15:00          │  │
│  │  Centro Cultural Ñuñoa    │  │
│  │  🚶 A 6 cuadras · Gratis  │  │
│  │  🪜 Sin escaleras         │  │
│  │                           │  │
│  │  [  ME INTERESA  ]        │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

Cada tarjeta responde sin entrar: **qué es, cuándo, dónde, cuánto cuesta y si puedo llegar**.
Los íconos de accesibilidad no son decoración: para alguien que usa bastón, "sin escaleras"
decide si va o no.

**Las imágenes se cargan con `loading="lazy"` y tienen un placeholder de color sólido.** En una
PWA sobre datos móviles, 15 fotos pesadas arruinan la primera impresión.

### Filtros
Cuatro, grandes, en una fila: **Moverme · Pensar · Juntarme · Crear**. No `categoria=fisica` en
un dropdown. El usuario no piensa en categorías, piensa en qué quiere hacer.

### Recomendación
Para el MVP: ordenar por cercanía a la comuna del usuario y por fecha próxima. Nada de un motor
de recomendación. Si sobra tiempo, el asistente puede priorizar según lo que el usuario haya
comentado antes — eso sí es un diferencial, pero es P2.

## 4. Inscripción

- Un solo toque desde la tarjeta
- Confirmación clara y corta, sin modales encadenados
- **Siempre crea el evento en la agenda.** Una inscripción que no queda en el calendario es una
  inscripción que se olvida
- Cancelar está siempre disponible y no pide explicaciones
- Si no quedan cupos, se dice antes de tocar el botón, no después
- Sin red, la inscripción se encola en IndexedDB y se envía al reconectar

## 5. Datos

`shared/seed/activities.json`: 15 actividades repartidas en la próxima semana, en comunas reales
de Santiago, con categorías variadas y accesibilidad completa. Hay al menos una gratis, una con
cupos casi llenos y una el mismo día del demo.

**Deuda declarada:** no hay backend de organizadores. En producción, BondUp o los municipios
cargarían sus actividades por una API o un panel. Decirlo en el pitch como el siguiente paso
natural, no esconderlo.

## 6. Criterios de aceptación

- [ ] El catálogo carga desde el seed y filtra por categoría y comuna
- [ ] Las tarjetas muestran fecha, lugar, precio y accesibilidad sin entrar al detalle
- [ ] Inscribirse crea la inscripción, el evento y los recordatorios en una sola acción
- [ ] El asistente puede buscar e inscribir hablando
- [ ] Cancelar funciona y elimina el evento de la agenda
- [ ] Las imágenes no bloquean el primer renderizado
- [ ] En ninguna parte se afirma una alianza con BondUp
