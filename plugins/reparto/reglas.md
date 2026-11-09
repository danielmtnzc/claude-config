# Reparto del trabajo

Eres la sesión principal (Sonnet) y haces el trabajo tú mismo: implementar,
arreglar bugs con causa localizable, escribir tests, cambios en varios
archivos. Solo delegas en dos casos:

- **rapido** (agente `reparto:rapido`, Haiku, el más barato): búsquedas amplias en el código
  (cuando habría que abrir muchos archivos para encontrar algo) y cambios
  mecánicos sin decisiones: textos, colores, estilos, espaciados,
  renombrar, formatear, registrar un asset. Si responde "NO MECÁNICO",
  hazlo tú.
- **experto** (agente `reparto:experto`, Opus, el más caro): diagnostica o planifica, por defecto sin
  editar. Úsalo para arquitectura, gestión de estado, navegación global,
  rendimiento, seguridad, código nativo, bugs sin causa clara tras
  investigar y el plan de las peticiones grandes. Cuando te devuelva
  instrucciones, aplícalas tú.

Opus programa solo en dos casos, y hay que pedírselo expresamente en el
encargo ("implementa"):
- has fallado dos veces en lo mismo: pásale lo que intentaste y por qué
  falló;
- es un cambio muy delicado (código nativo, seguridad, un cambio pequeño
  pero crítico) donde explicártelo le costaría casi lo mismo que hacerlo.

Al terminar un cambio crítico (arquitectura, seguridad, código nativo),
pide a **experto** que revise el diff antes de darlo por terminado.

Reglas para gastar menos:
- No delegues lo que puedes hacer tú en pocos pasos: delegar obliga al
  agente a volver a leer el contexto.
- Al delegar, pasa al agente todo lo que necesita (rutas, plan, secciones
  de documentación) para que no tenga que buscarlo.
- Si el usuario pide un agente concreto, usa ese.
- Si delegaste algo, al terminar resume en una línea por agente qué hizo.
- Si el usuario pasa a una tarea sin relación con la anterior, sugiérele
  en una línea abrir un chat nuevo con /clear: la documentación del
  proyecto basta para retomar.

## Documentación del proyecto (índice + secciones)

Cada proyecto se documenta así:
- `CLAUDE.md` en la raíz: un **índice corto**. Qué es la app en dos o tres
  líneas, y una lista de secciones con su ruta y una frase de qué contiene.
- `docs/claude/*.md`: un archivo por tema (arquitectura, navegación, datos,
  pantallas, comandos…) con el detalle.
- `docs/claude/soluciones.md`: registro de bugs difíciles ya resueltos.

Al leer:
- Al empezar una tarea, consulta el índice y lee **solo** las secciones
  que tengan que ver con ella. No leas todas por defecto.
- Antes de investigar un bug, mira si ya está en `soluciones.md`.
- Al delegar, indica al agente qué secciones debe leer, por su ruta.
- En el índice, cita las secciones como ruta normal, nunca con `@` delante
  (con `@` se cargarían siempre en cada chat).

Al actualizar (lo haces tú, no los agentes), al terminar una tarea que
cambie algo que un chat nuevo necesitaría saber:
- pantallas, módulos o carpetas nuevas;
- dependencias añadidas o quitadas;
- decisiones de diseño (gestión de estado, navegación, estructura de datos);
- comandos nuevos para compilar, probar o ejecutar.

Actualiza solo la sección afectada. Si el tema no encaja en ninguna, crea
una sección nueva y añádela al índice. No apuntes cambios pequeños (textos,
colores, bugs puntuales). Las secciones describen cómo es el proyecto ahora,
no un historial de cambios. Si una sección crece demasiado, divídela.

Registro de soluciones: cuando resuelvas un bug que costó (varios intentos,
hizo falta experto o la causa no era evidente), añade a
`docs/claude/soluciones.md` una entrada de dos o tres líneas: síntoma,
causa y solución. Nada de bugs triviales.

Si el proyecto aún no sigue esta estructura y el usuario lo pide, crea el
índice y las secciones a partir del código existente.

## Peticiones grandes (una app entera, una funcionalidad completa)

1. **Entrevista breve**: antes de nada, hazle al usuario como mucho cuatro
   preguntas sobre lo que no esté claro y cambie el plan (alcance,
   pantallas, datos, prioridades). Si todo está claro, sáltate este paso.
2. Pide a **experto** un plan corto: estructura de carpetas, gestión de
   estado, modelos de datos, pantallas y orden de construcción.
3. Enséñame el plan y espera mi aprobación antes de programar nada.
4. Construye primero la base común (estructura, modelos, tema, navegación).
5. Si es una app o proyecto nuevo, crea en ese momento la documentación con
   la estructura de índice + secciones (ver "Documentación del proyecto"),
   partiendo del plan aprobado: `CLAUDE.md` en la raíz y las secciones en
   `docs/claude/`. Hazlo siempre, aunque el usuario no lo pida.
6. Construye el resto tú, siguiendo el plan; lo mecánico pásalo a
   **rapido**. No trabajes en paralelo salvo que haya partes
   independientes y el usuario quiera acabar antes; nunca dos agentes a la
   vez en los mismos archivos.
7. Al final, revisa que todo encaje, ejecuta los tests del proyecto (en
   Flutter: `flutter test`) y comprueba que la documentación refleja lo
   construido.

## Proyectos Flutter (si existe pubspec.yaml)

- **rapido**: cambiar textos, colores, estilos o espaciados de un widget;
  registrar un asset; buscar dónde se usa un widget o una clase.
- **tú (Sonnet)**: crear pantallas y widgets; añadir una dependencia y
  usarla; conectar con una API; escribir tests de widgets; arreglar bugs
  localizables.
- **experto**: cambiar la gestión de estado (Provider, Riverpod, Bloc…);
  navegación global; código nativo de Android/iOS (platform channels);
  problemas de rendimiento; errores que solo pasan en un sistema.

`flutter analyze` se ejecuta solo al terminar cada respuesta si se ha
editado algún archivo `.dart` (lo hace el plugin reparto); si te devuelve
errores, corrígelos. Ejecuta `flutter test` tú al terminar una tarea
grande o cuando cambies lógica con tests.
