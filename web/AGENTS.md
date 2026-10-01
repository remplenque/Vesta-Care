# web/ — PWA (Vite + React + TypeScript)

Complementa el `AGENTS.md` raíz; no lo reemplaza. **Antes de cualquier componente:**
`docs/08-ACCESSIBILITY.md`. Es vinculante.

**Dueños** (`docs/09-BUILD-PLAN.md` §3):
- **Baptiste:** manifest, service worker, tema accesible, pantalla de elección de asistente, pastillero
- **Luis-Felipe:** `lib/alarma.ts` primero (**nada más hasta que suene**, hito 11:00), después
  `lib/push.ts` y Comunidad

## Archivos

| Archivo | Responsabilidad | Spec | Prioridad | Estado |
|---|---|---|---|---|
| `src/theme.ts` | Escalas de texto, colores, mínimos táctiles | `08` §2–4 | P0 | **Listo** |
| `src/lib/alarma.ts` | ★ Alarma en primer plano: revisa IndexedDB cada 30 s, toma la pantalla, suena, vibra | `06` §4.2 | **P0, primero** | Pendiente |
| `src/lib/types.ts` | Espejo exacto de `02-DATA-CONTRACTS.md` | `02` | P0 | Pendiente |
| `src/lib/api.ts` | **Único** lugar que habla con el servidor. Mismo origen, sin URL fija | `02` §11 | P0 | Pendiente |
| `src/lib/db.ts` | IndexedDB (`idb-keyval`): pastillero y agenda del día, recordatorios | `01` §7 | P0 | Pendiente |
| `src/routes/Asistente.tsx` | Pantalla de entrada: chat, micrófono, sugerencias, módulos visibles | `03` §1, §6–7 | P0 | Pendiente |
| `src/routes/Salud.tsx` | Pastillero del día, métricas, foto del aparato | `04` §2–4 | P0 | Pendiente |
| `src/routes/Agenda.tsx` | Vista de día unificada | `06` §2 | P1 | Pendiente |
| `src/routes/Comunidad.tsx` | Catálogo vertical, filtros, inscripción | `05` §3–4 | P1 | Pendiente |
| `src/lib/push.ts` | Permiso + suscripción Web Push | `06` §4.3–4.4 | P1 | Pendiente |
| `src/sw.ts` | App shell + `push` + `notificationclick` | `06` §4.3 · `01` §7 | P1 | Pendiente |
| `public/manifest.webmanifest` | `standalone`, `lang: "es-CL"`, íconos 192/512/maskable | `06` §4.5 | P0 | Pendiente |
| `vite.config.ts` | `vite-plugin-pwa` (`autoUpdate`) + proxy a Flask `:5000` | `01` §7, §9 | P0 | Pendiente |

Referencia de UI heredada: `legacy/Mateo-main/Frontend/mateo/funciones/templates/vistas/chat.html`
(líneas clave en `legacy/README.md`).

## Reglas de esta carpeta

- **Nombre del asistente:** siempre desde `GET /v1/perfil` → `asistente.nombre` /
  `asistente.articulo`. Preferir textos neutros ("Volver al chat"). Los únicos literales
  permitidos son `"mateo" | "emilia"` en `types.ts`.
- **El botón "Oír" de la elección de asistente desbloquea el audio** para la alarma. No se quita
  (`03` §6, `06` §4.2).
- **Respuesta del asistente** (`02` §10): ignorar tipos de `acciones` desconocidos sin romperse;
  `navegar_a` **ofrece** ir, no navega solo; máximo 3 sugerencias; el texto siempre en pantalla,
  aunque haya audio.
- **Recordatorios:** cada `programar_recordatorios` se guarda en IndexedDB para la alarma local.
  Al abrir, se recalculan los próximos 7 días sin duplicar (`06` §4.6).
- **Tipografía en `rem`**, ancla en `html`. Viewport sin `maximum-scale` ni `user-scalable=no`.
- **Toque:** `min-height`/`min-width` de 56 px, 16 px entre botones, `touch-action: manipulation`,
  ignorar el segundo toque dentro de 500 ms.
- **Estado = color + ícono + texto.** Nunca solo color; nada de `:hover` como única señal.
- **Botón de volver en la interfaz**: en modo `standalone` no hay barra del navegador.
- **Sin temporizadores que escondan cosas**, sin spinners (esqueleto de la pantalla real), sin la
  palabra "error". Lenguaje: `08` §5.
- **Permiso de notificaciones:** nunca al abrir; primero una pantalla que explique (`06` §4.4).
  Prompt de instalación después de la primera conversación exitosa (`06` §4.5).

## Revisiones de diseño con guías externas

Si se usa una guía genérica (por ejemplo el skill `apple-design`, basado en Apple HIG), **sus
mínimos son más bajos que los nuestros**: HIG pide 17 pt de texto y 44 × 44 pt de área táctil.
Acá rigen **20 pt y 56 × 56 pt**, contraste **7:1** y **fondo blanco, no gris**. Ante cualquier
diferencia gana `docs/08-ACCESSIBILITY.md`. La guía sirve para craft visual, no para bajar mínimos.

## Verificación rápida

```bash
grep -rni "mateo\|emilia" web/src --exclude=types.ts   # debe salir vacío
```

Checklist por pantalla: `08` §8, **probada instalada y con `tamano_texto: muy_grande`**.
Criterios de aceptación: `03` §9, `04` §7, `05` §6, `06` §6.
