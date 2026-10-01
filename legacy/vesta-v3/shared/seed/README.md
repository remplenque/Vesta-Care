# shared/seed/ — datos de demo

`server/seed.py` carga estos JSON en `vesta.db` con un solo comando. **Una pantalla vacía en un
demo se ve como un producto que no funciona** (`docs/04-MODULE-HEALTH.md` §5).

Todos los datos son ficticios y siguen `docs/02-DATA-CONTRACTS.md` al pie de la letra: IDs con
prefijo, timestamps UTC con `Z`, horas del día (`"08:00"`) en hora de Chile.

| Archivo | Contenido mínimo | Spec |
|---|---|---|
| `user.json` | `usr_01`, Juanito, 78, Ñuñoa, `tratamiento: "usted"`, contacto de emergencia | `02` §2 |
| `medications.json` | 3 medicamentos con horarios repartidos (Losartán, Metformina…), **uno con stock bajo** para mostrar la alerta, y tomas de días anteriores para que los gráficos no estén vacíos | `04` §5 · `02` §3–4 |
| `metrics.json` | 7 días de presión y glucosa, 30 de peso. Datos de reloj con `fuente: "simulado"` | `04` §3 · `02` §5 |
| `activities.json` | 15 actividades en la próxima semana, comunas reales de Santiago, categorías variadas. Al menos una gratis, una con cupos casi llenos y **una el mismo día del demo** | `05` §5 · `02` §6 |
| `events.json` | Eventos `hora_medica`, `personal` y `recado` para que la agenda del día tenga contenido | `06` §2 · `02` §8 |

Perfil clínico del paciente demo: hipertensión + diabetes tipo 2 (`docs/10-OPEN-ISSUES.md` §1).

> ⚠️ **Fechas:** convertir siempre la hora de Chile a UTC al escribir `inicio`. En octubre de 2026
> Chile está en UTC−3: las 15:00 locales son `18:00:00Z`. El 4 de octubre de 2026 es **domingo**
> (`docs/10-OPEN-ISSUES.md` #6).
