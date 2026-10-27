# Handoff: Circuitos (2026-10-26)

## Dónde quedamos
- Todo está subido: `main` = `origin/main` en `ad69d25` ("new memory lvls + fixes audit").
- Verificado en ese estado: `tsc`, 130 pruebas unitarias, lint, build sin aviso de tamaño, 24 e2e en Chrome real (con CSP) y `npm audit` en 0.
- 21 niveles (20 principales y el 0 opcional de relés): compuertas → sumadores → latches y flip-flop → bloque 3 combinacional (MUX, DMUX, NOT4, MUX4, DECODER, INC4, ALU4) → bloque 3 memoria (BIT, REGISTER4, COUNTER4, RAM4).

## Mejoras de UX (2026-10-26, sin commit: las sube el usuario)
Verificado (tras la ronda 2 de ajustes): `tsc`, 146 unitarias, lint sin avisos, build, 29 e2e y `npm audit` en 0.
- **Arrastre:** mientras se mueve una pieza los paquetes de los cables se ocultan (`dragging` en `Editor.tsx`) y vuelven al soltar.
- **Paso a paso:** los cables que cambió el último evento (un Avanzar o un cambio de entrada o de reloj) se pintan rojo sólido, con su paquete también en rojo (`.wire.just-changed`, `.packet.changed`). `Harness.remember(event, compare)` guarda las señales antes de cada evento y `changedSinceEvent(node, pin)` compara. Un circuito nuevo, o un cambio hecho fuera de paso a paso, no marca nada.
- **Textos con marcas:** `RichText` (sobre `Trans`) admite solo `<pin>`, `<v>`, `<b>`, `<i>` (`src/richTags.ts`). Las pruebas exigen etiquetas válidas, los mismos pines en es/en y que cada `<pin>` de un nivel exista en su spec o en sus piezas.
- **Teoría por nivel:** `levels.ID.story` en los dos idiomas; panel a la derecha del lienzo (botón Teoría). Se abre solo la 1a vez; cerrarlo se recuerda por nivel. El primer encuadre deja lugar al panel.
- **Guía:** diálogo `src/Guide.tsx` con índice (cómo resolver, conceptos, piezas, comandos, atajos); textos en `guide.*`. Se abre desde el botón Guía de la columna de niveles y desde el botón Guía de la bienvenida. El índice marca con `aria-current` la sección que se está leyendo. Los atajos viven en `src/Shortcuts.tsx` (una sola lista). `src/useDialog.ts` abre y cierra los dos diálogos, con salida animada (`.closing`), también con Esc.
- **Columnas plegables:** niveles y piezas, cada una con su flecha; solo en pantallas anchas. El contenido conserva su ancho y aparece con un fundido cuando la columna termina de abrir. Tokens en `index.css`: `--ease-soft`, `--fold`, `--levels-width`, `--palette-width`, `--rail`. Las flechas y el botón "?" (`HelpIcon`) son el mismo botón cuadrado `.icon-button`. Preferencias en `circuitos:ui` (`loadPrefs`/`writePrefs` en `src/storage.ts`, validadas), aparte del progreso.
- **Ronda 3:** al plegar o abrir una columna la vista sigue al lienzo y termina encuadrada (`refitKey` en `Editor.tsx`, dura `--fold`); al cambiar el tamaño de la ventana no se reencuadra. Modo libre va debajo de Guía, arriba de los niveles. La columna de niveles mide 212px para que la fila del título respete su margen. Los títulos de la Guía dejan 16px arriba al saltar (`scroll-margin-top`).
- **e2e:** `start(page)` abre los niveles con la teoría cerrada para no tapar piezas; `start(page, { theory: true })` prueba la primera visita real.
- **Pendiente del usuario:** revisar los textos de teoría y guía (los escribió Claude, en es y en). Las historias evitan decir la solución del nivel.

## Lo siguiente: la mini CPU
Es el último nivel del bloque 3. **Antes de escribir código hay que decidir con el usuario** (con plan y preguntas):
1. **Conjunto de instrucciones.** Con lo que ya hay (palabras de 4 bits, RAM de 4 palabras, ALU con ADD/SUB/AND/OR, contador con `load`), una opción es un acumulador: `LOAD addr`, `STORE addr`, `ADD/SUB addr`, `JMP addr`, `JZ addr` (usa la bandera `zero` de ALU4).
2. **Cómo llega el programa.** ¿Una ROM como entrada del nivel (bus de instrucción), o memoria compartida? Lo más simple para probar es que la instrucción entre por un pin y que el PC salga por otro.
3. **Uno o varios niveles.** Por ejemplo, primero el "decodificador de instrucciones" o el "camino de datos" y después la CPU completa.
4. **Cómo se prueba.** Con `sequentialSpec` y un modelo de la CPU (`next`/`read`) que ejecuta un programa corto. Lo esperado se calcula, no se escribe a mano.

Puede hacer falta que la RAM tenga más de 4 palabras o que la palabra sea más ancha. `WORD` y `SELECTOR` están en `src/sim/types.ts`, pero ADDER4 tiene sus pines fijos a 4 bits.

## Cómo se agrega un nivel (patrón ya probado)
1. Spec en `src/levels/specs.ts`: `tableSpec` (1 bit, todas las combinaciones), `vectorSpec` (casos escogidos, `WORD_PAIRS`) o `sequentialSpec` (con reloj y modelo). Los tres están en `src/sim/verify.ts`.
2. Solución de referencia en `src/sim/examples.ts`, usando solo chips de niveles anteriores. Hay que agregarla a `LIBRARY` si otros niveles la usan como chip.
3. `level('ID', { parts })` en `src/levels/levels.ts`. Los niveles con buses usan `BUS_PARTS`.
4. Textos `levels.ID.name|goal|hint` en `src/locales/es.json` y `en.json` (las pruebas exigen los dos).
5. Pruebas en `src/levels/levels.test.ts`: que lo esperado sea correcto y que un circuito con un error típico **no** pase.
6. Las e2e calculan el total de niveles (`MAIN_LEVELS.length`); para abrir un nivel avanzado se usa `seedSolved(page, levelsBefore('ID'))`.

## Reglas del usuario (seguirlas siempre)
- Planear antes de implementar (modo plan) y preguntar las decisiones de diseño.
- Best practices de desarrollo **y** seguridad: pruebas primero, una sola fuente de verdad, sin números mágicos, nada hecho a mano si hay una librería estándar, dependencias fijadas y con más de 2 semanas de publicadas, CSP intacta y costo de cómputo acotado.
- Nada hardcodeado en el diseño (layout adaptable), y respetar `prefers-reduced-motion`.
- Nada de emojis en la UI.
- **No hacer commits ni push**: los hace el usuario.
- Antes de dar algo por terminado: `npx tsc -b`, `npx vitest run`, `npm run lint`, `npm run build`, `npx playwright test`, `npm audit --audit-level=high`.

## Pendiente menor
- La tabla en vivo en niveles con memoria (Bit, Registro, Contador, RAM, Flip-flop D) muestra combinaciones partiendo de la memoria en cero, lo que dice poco en un circuito con reloj. Opción: en esos niveles mostrar una nota en lugar de la tabla, o una tabla de los ciclos del spec.
- Las traducciones al inglés las escribió Claude: el usuario no las ha revisado.

## Comandos
```
npm run dev        # http://localhost:5173
npx vitest run     # unitarias
npx playwright test  # e2e (build + preview en :4173, Chrome instalado); capturas en test-results/shots
```
