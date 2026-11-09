# reparto

Reparto del trabajo de Claude Code pensado para gastar poco uso. Todo en un plugin:

- **Reglas** (`reglas.md`): se añaden a las instrucciones de cada chat, como si estuvieran en tu `~/.claude/CLAUDE.md`. La sesión principal (Sonnet) hace el trabajo y solo delega en dos agentes. Incluyen la entrevista breve antes de las peticiones grandes, la documentación de proyectos (índice + secciones), el registro de bugs resueltos y el reparto para Flutter. Para cambiarlas, edita `reglas.md` en el repositorio y actualiza el plugin.
- **Agentes** (`agents/`):
  - `reparto:rapido` (Haiku): búsquedas amplias y cambios mecánicos sin decisiones. Si hace falta criterio, responde "NO MECÁNICO".
  - `reparto:experto` (Opus): consultor. Diagnostica y planifica sin editar; programa solo tras dos fallos de Sonnet o en cambios muy delicados, y revisa los diffs críticos.
- **Sonnet por defecto**: si no has elegido modelo en ningún sitio, la sesión usa Sonnet. Si eliges otro con `/model`, se respeta.
- **Verificación de Flutter**: al terminar cada respuesta, si se ha editado algún `.dart`, ejecuta `flutter analyze` en su proyecto y devuelve a Claude solo los errores (como mucho 20 líneas) para que los corrija. Tras dos intentos, deja de insistir y avisa. Sin cambios en `.dart`, o sin Flutter instalado, no hace nada. No gasta uso del modelo.
