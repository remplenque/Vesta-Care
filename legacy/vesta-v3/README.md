# legacy/vesta-v3/ — scaffold de la spec v3 (descartada)

Archivos creados para la variante Flask + SQLite, que el equipo descartó el 2026-10-01 en favor
del plan Supabase. Su especificación está en `docs/archive/v3/`. **Solo lectura:** si algo sirve,
se copia a la app, no se edita acá.

| Archivo | Reutilizable en el plan Supabase |
|---|---|
| `web/src/theme.ts` | **Sí.** Tokens de `docs/ACCESSIBILITY.md` (escalas de texto, colores AAA, mínimos táctiles). Es TypeScript sin dependencias |
| `server/agent/prompts/asistente.md` | **Como base.** La personalidad, el tono y los límites médicos (incluye derivar al 131) sirven para el prompt de Mateo. Sacar la parte de dos presentaciones y de las tools de la v3 |
| `scripts/tunnel.sh` | **Sí**, para probar en el teléfono con HTTPS sin desplegar (cloudflared o ngrok) |
| `server/agent/persona.py` | No. Mateo / Emilia no está en el acta |
| `scripts/dev.sh` | No. Levantaba Flask + Vite |
| `server/README.md`, `web/README.md`, `shared/seed/README.md` | Guías de carpeta de la v3. Útiles solo como checklist de ideas |
| `.env.example` | No. El vigente está en la raíz |
