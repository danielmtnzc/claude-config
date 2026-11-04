# panel-agentes

Panel fijo a la derecha del chat de Claude Code que muestra, en directo, qué está haciendo cada subagente:

- **Trabajando:** tipo de agente (rapido, normal, experto…), modelo con el que corre (haiku, sonnet, opus), tiempo que lleva, la tarea que recibió y su última acción (por ejemplo "Leyendo main.dart" o "Ejecutando: flutter analyze").
- **Terminados:** cuánto tardó cada uno, cuántas acciones hizo y si acabó bien o con error.
- **Total:** cuántas tareas ha recibido cada tipo de agente en la sesión.

Pulsa un agente para ver su conversación completa. El panel se abre solo al empezar cada sesión; si lo cierras, el comando `/agentes` lo vuelve a abrir.
