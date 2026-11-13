# panel-agentes

Panel fijo a la derecha del chat de Claude Code que muestra, en directo, qué está haciendo cada subagente.

- **Cabecera:** una etiqueta con cuántos agentes están trabajando ahora.
- **Plan en curso:** cuando el coordinador divide una petición grande en tareas, un anillo con el porcentaje hecho y un segmento por parte (verde hecha, naranja en marcha, gris pendiente).
- **Casillas:** agentes trabajando, terminados y acciones totales.
- **Trabajando:** una tarjeta por agente, con el color de su modelo (verde Haiku, azul Sonnet, morado Opus), su tipo, el tiempo que lleva, la tarea y lo que está haciendo ahora.
- **Terminados:** una línea por agente con tiempo y acciones. Al pulsarla se despliega su línea de tiempo (cada acción con su minuto e icono) y el resultado final. "+ N acciones más" muestra la lista entera y "ver conversación" abre su conversación.
- **Pie:** una barra con cuántos agentes ha usado cada modelo en la sesión.

En escritorio, web y móvil el anillo y las barras son dibujos; en el terminal se ven como barras de texto.

El panel se abre solo al empezar cada sesión; si lo cierras, el comando `/agentes` lo vuelve a abrir.

## Límites y consumo

- Debajo del título, el porcentaje usado del **límite semanal** y del de **5 horas**, y el enlace **ver consumo**.
- **Esta sesión**: una tarjeta con el modelo principal (el que lleva el chat desde el principio), sus respuestas y el porcentaje del límite semanal que ha gastado.
- En cada agente terminado, el **porcentaje estimado del límite semanal** que ha gastado (≈2,5%). No se muestra dinero: el porcentaje sale de repartir el límite semanal actual según el coste estimado de cada agente.
- Al terminar cada respuesta de la sesión principal y cada subagente, el plugin añade una línea a `~/.claude/consumo/consumo-AAAA-MM.csv` (en Windows, `%USERPROFILE%\.claude\consumo\`): fecha, hora, equipo, proyecto, agente, modelo, tokens (entrada, salida, caché), coste estimado y porcentaje del límite semanal. Lo escribe el propio plugin: no pasa por el modelo ni gasta uso. Un archivo por mes y por ordenador, separado por `;` para abrirlo con Excel.
- `/consumo` (o **ver consumo**) abre un segundo panel con el porcentaje del límite semanal gastado por día (últimos 14 días) y por semana (últimas 8 semanas), repartido por agente, y la parte de Opus.

Los precios de `precios.json` solo sirven para repartir el porcentaje entre agentes y modelos; el CSV sigue guardando el coste estimado por si lo quieres en Excel.

## Al cambiar de chat

La lista de agentes, el plan y la tarjeta principal de cada chat se guardan al cerrarlo o al hacer `/clear`, y se recuperan al volver a abrir ese chat. Tras un `/clear` el panel empieza vacío para el chat nuevo.
