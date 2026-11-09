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
- En cada agente terminado, su **coste estimado**.
- Al terminar cada respuesta de la sesión principal y cada subagente, el plugin añade una línea a `~/.claude/consumo/consumo-AAAA-MM.csv` (en Windows, `%USERPROFILE%\.claude\consumo\`): fecha, hora, equipo, proyecto, agente, modelo, tokens (entrada, salida, caché), coste estimado y porcentaje del límite semanal. Lo escribe el propio plugin: no pasa por el modelo ni gasta uso. Un archivo por mes y por ordenador, separado por `;` para abrirlo con Excel.
- `/consumo` (o **ver consumo**) abre un segundo panel con el coste por día (últimos 14 días) y por semana (últimas 8 semanas), repartido por agente, la parte de Opus y el límite semanal más alto de cada semana.

El coste se estima con los precios de la API de `precios.json`: sirve para comparar semanas y repartos, no es lo que pagas con la suscripción.
