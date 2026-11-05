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
