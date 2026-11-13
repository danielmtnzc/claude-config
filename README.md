# claude-config

Configuración de Claude Code pensada para gastar poco uso, en dos plugins:

- **`reparto`** (`plugins/reparto`): cómo se reparte el trabajo.
  - **Reglas** (`reglas.md`): la sesión principal (Sonnet) hace el trabajo y solo delega en dos agentes. Incluyen la entrevista breve antes de las peticiones grandes, la documentación de proyectos (índice + secciones), el registro de bugs resueltos en `docs/claude/soluciones.md`, el recordatorio de `/clear` al cambiar de tarea y el reparto para Flutter.
  - **Agentes**: `rapido` (Haiku) para búsquedas amplias y cambios mecánicos; `experto` (Opus) como consultor que diagnostica y planifica sin editar, programa solo tras dos fallos de Sonnet o en cambios muy delicados, y revisa los diffs críticos.
  - **Sonnet por defecto** si no has elegido otro modelo.
  - **Verificación de Flutter**: al terminar cada respuesta, si se ha editado algún `.dart`, ejecuta `flutter analyze` y devuelve a Claude solo los errores.
- **`panel-agentes`** (`plugins/panel-agentes`): panel a la derecha del chat con lo que hace cada subagente, el uso de tus límites y el **registro de consumo** (`/consumo`).

Ni la verificación de Flutter ni el registro de consumo pasan por el modelo: no gastan uso.

## Instalar

En la app de escritorio de Claude: pulsa **+** junto al cuadro de mensaje → **Plugins** → **Add marketplace**, escribe `danielmtnzc/claude-config` y después **Add plugin** en `reparto` y en `panel-agentes`.

O desde una terminal:

```
claude plugin install reparto --marketplace danielmtnzc/claude-config
claude plugin install panel-agentes --marketplace danielmtnzc/claude-config
```

O con el instalador del repositorio, que además **quita lo que dejaban las versiones anteriores** en `~/.claude` (los agentes `rapido`, `normal` y `experto`, y el bloque de reglas entre `claude-config:inicio` y `claude-config:fin` de `CLAUDE.md`, guardando una copia en `CLAUDE.md.bak`):

- **Windows:** doble clic en `install.cmd`.
- **Mac / Linux:** `bash install.sh`.

En un ordenador que tenía instalada la versión anterior, ejecuta el instalador una vez para que no queden las reglas duplicadas.

El repositorio es público: no hace falta tener git conectado a ninguna cuenta para instalar los plugins. Se descargan de la rama `main` en GitHub, así que un cambio llega a los ordenadores después de hacer `git push`.

## Actualizar

Cuando cambies algo (por ejemplo `plugins/reparto/reglas.md`):

1. Sube el número de `version` en el `plugin.json` del plugin que hayas cambiado.
2. Súbelo:
   ```
   git add -A
   git commit -m "Describe el cambio"
   git push
   ```
3. En cada ordenador: `claude plugin update reparto@claude-config` (o `panel-agentes@claude-config`), o desde el menú de Plugins, o doble clic en `install.cmd`. Después, abre una sesión nueva.

## Ver el consumo

- `/consumo` en cualquier chat, o el botón **ver consumo** del panel de agentes: coste estimado de los últimos 14 días y las últimas 8 semanas, repartido por agente, la parte de Opus y el límite semanal más alto de cada semana.
- Los datos completos están en `~/.claude/consumo/` (en Windows, `C:\Users\<usuario>\.claude\consumo\`), un CSV por mes que se abre con Excel. Cada ordenador guarda los suyos.
- El coste se calcula con los precios de la API de `plugins/panel-agentes/precios.json`: sirve para comparar, no es lo que pagas con la suscripción.
