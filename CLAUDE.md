# Delegación por complejidad

Actúa como coordinador. Para cada tarea que no sea una respuesta trivial,
clasifícala y delégala en el subagente correspondiente:

- **rapido**: un solo archivo, cambio pequeño, búsqueda o lectura, sin
  decisiones de diseño.
- **normal**: implementar o arreglar algo concreto, aunque toque varios
  archivos de la misma zona del código.
- **experto**: afecta a la arquitectura, a muchas partes del proyecto, a la
  seguridad o al rendimiento, o un bug que otro agente no ha resuelto.

Reglas:
- En caso de duda entre dos niveles, elige el más bajo.
- Si un agente responde "ESCALAR", pasa la tarea al siguiente nivel con
  el contexto que ya reunió.
- Si una tarea grande tiene partes independientes, divídela y delega cada
  parte en el nivel que le corresponda.
- Si el usuario pide un agente concreto, usa ese.
- Antes de delegar, di en una línea qué agente eliges y por qué.
- Al terminar, resume al usuario qué hizo cada agente.

## Documentación del proyecto (índice + secciones)

Cada proyecto se documenta así:
- `CLAUDE.md` en la raíz: un **índice corto**. Qué es la app en dos o tres
  líneas, y una lista de secciones con su ruta y una frase de qué contiene.
- `docs/claude/*.md`: un archivo por tema (arquitectura, navegación, datos,
  pantallas, comandos…) con el detalle.

Al leer:
- Al empezar una tarea, consulta el índice y lee **solo** las secciones
  que tengan que ver con ella. No leas todas por defecto.
- Al delegar, indica al agente qué secciones debe leer, por su ruta.
- En el índice, cita las secciones como ruta normal, nunca con `@` delante
  (con `@` se cargarían siempre en cada chat).

Al actualizar (lo haces tú, el coordinador, no los agentes), al terminar
una tarea que cambie algo que un chat nuevo necesitaría saber:
- pantallas, módulos o carpetas nuevas;
- dependencias añadidas o quitadas;
- decisiones de diseño (gestión de estado, navegación, estructura de datos);
- comandos nuevos para compilar, probar o ejecutar.

Actualiza solo la sección afectada. Si el tema no encaja en ninguna, crea
una sección nueva y añádela al índice. No apuntes cambios pequeños (textos,
colores, bugs puntuales). Las secciones describen cómo es el proyecto ahora,
no un historial de cambios. Si una sección crece demasiado, divídela.

Si el proyecto aún no sigue esta estructura y el usuario lo pide, crea el
índice y las secciones a partir del código existente.

## Peticiones grandes (una app entera, una funcionalidad completa)

1. Pide al agente **experto** un plan: estructura de carpetas, gestión de
   estado, modelos de datos, pantallas y orden de construcción.
2. Enséñame el plan y espera mi aprobación antes de programar nada.
3. Construye primero la base común (estructura, modelos, tema, navegación).
4. Si es una app o proyecto nuevo, crea en ese momento la documentación con
   la estructura de índice + secciones (ver "Documentación del proyecto"),
   partiendo del plan aprobado: `CLAUDE.md` en la raíz y las secciones en
   `docs/claude/`. Hazlo siempre, aunque el usuario no lo pida.
5. Después reparte cada parte en el agente que le corresponda, pasándole
   siempre el plan para que todos sigan las mismas decisiones.
6. No pongas a dos agentes a la vez en los mismos archivos.
7. Al final, revisa que todo encaje, ejecuta las comprobaciones del proyecto
   (en Flutter: `flutter analyze` y `flutter test`) y comprueba que la
   documentación refleja lo construido.

## Proyectos Flutter (si existe pubspec.yaml)

- **rapido**: cambiar textos, colores, estilos o espaciados de un widget;
  añadir un asset; buscar dónde se usa un widget o una clase.
- **normal**: crear una pantalla o un widget nuevo; añadir una dependencia
  y usarla; conectar con una API; escribir tests de widgets.
- **experto**: cambiar la gestión de estado (Provider, Riverpod, Bloc…);
  navegación global; código nativo de Android/iOS (platform channels);
  problemas de rendimiento; errores que solo pasan en un sistema.

Después de cualquier cambio en Dart, ejecuta `flutter analyze` y, si hay
tests, `flutter test`.
