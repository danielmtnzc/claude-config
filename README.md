# claude-config

Configuración global de Claude Code:

- **Agentes por complejidad** (`agents/`): `rapido` (Haiku), `normal` (Sonnet) y `experto` (Opus).
- **Reglas de reparto** (`CLAUDE.md`): la sesión principal actúa como coordinador y delega cada tarea según su dificultad. Incluye reglas para peticiones grandes, documentación de proyectos (índice + secciones) y proyectos Flutter.
- **Modelo por defecto**: Sonnet para la sesión principal, para cuidar el uso semanal.

## Instalar en un ordenador

1. Descarga el repositorio:
   ```
   git clone https://github.com/danielmtnzc/claude-config.git
   cd claude-config
   ```
2. Ejecuta el instalador:
   - **Windows (PowerShell):**
     ```
     powershell -ExecutionPolicy Bypass -File install.ps1
     ```
   - **Mac / Linux:**
     ```
     bash install.sh
     ```
3. Abre una sesión nueva de Claude Code.

## Qué hace el instalador

- Copia los agentes a `~/.claude/agents/`.
- Añade las reglas a `~/.claude/CLAUDE.md` entre dos marcadores (`claude-config:inicio` / `claude-config:fin`). Si ya tenías un `CLAUDE.md`, conserva tu contenido y guarda una copia en `CLAUDE.md.bak`.
- Pone `"model": "sonnet"` en `~/.claude/settings.json`, solo si no tenías ya un modelo elegido.

Se puede ejecutar todas las veces que quieras: actualiza lo suyo y no toca lo demás.

## Actualizar

Cuando cambies algo en un ordenador:

```
git add -A
git commit -m "Describe el cambio"
git push
```

En el otro ordenador:

```
git pull
powershell -ExecutionPolicy Bypass -File install.ps1
```

Edita siempre los archivos del repositorio, no los de `~/.claude`: el instalador sobrescribe los agentes y el bloque de reglas.
