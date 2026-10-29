# Handoff: Circuitos (2026-10-27)

## Dónde quedamos
- El código está listo para producción en **Vercel** (el 2026-10-28 el usuario dejó Cloudflare porque le resultó complicado). Falta publicarlo y conectar el dominio `circuitos.io` (Namecheap); ver "Publicar en producción". El cambio a Vercel está sin commit.
- Verificado: `tsc`, 174 pruebas unitarias, lint sin avisos, build, 42 e2e en Chrome real (con CSP) y `npm audit` en 0.
- 21 niveles (20 principales y el 0 opcional de relés): compuertas → sumadores → latches y flip-flop → bloque 3 combinacional (MUX, DMUX, NOT4, MUX4, DECODER, INC4, ALU4) → bloque 3 memoria (BIT, REGISTER4, COUNTER4, RAM4).

## Mejoras de UX (2026-10-26, subidas por el usuario)
Verificado al final: `tsc`, 146 unitarias, lint sin avisos, build, 31 e2e y `npm audit` en 0.
- **Arrastre:** mientras se mueve una pieza los paquetes de los cables se ocultan (`dragging` en `Editor.tsx`) y vuelven al soltar.
- **Paso a paso:** los cables que cambió el último evento (un Avanzar o un cambio de entrada o de reloj) se pintan rojo sólido, con su paquete también en rojo (`.wire.just-changed`, `.packet.changed`). `Harness.remember(event, compare)` guarda las señales antes de cada evento y `changedSinceEvent(node, pin)` compara. Un circuito nuevo, o un cambio hecho fuera de paso a paso, no marca nada.
- **Textos con marcas:** `RichText` (sobre `Trans`) admite solo `<pin>`, `<v>`, `<b>`, `<i>` (`src/richTags.ts`). Las pruebas exigen etiquetas válidas, los mismos pines en es/en y que cada `<pin>` de un nivel exista en su spec o en sus piezas.
- **Teoría por nivel:** `levels.ID.story` en los dos idiomas; panel a la derecha del lienzo (botón Teoría). Se abre solo la 1a vez; cerrarlo se recuerda por nivel. El primer encuadre deja lugar al panel.
- **Guía:** diálogo `src/Guide.tsx` con índice (cómo resolver, conceptos, piezas, comandos, atajos); textos en `guide.*`. Se abre desde el botón Guía de la columna de niveles y desde el botón Guía de la bienvenida. El índice marca con `aria-current` la sección que se está leyendo. Los atajos viven en `src/Shortcuts.tsx` (una sola lista). `src/useDialog.ts` abre y cierra los dos diálogos, con salida animada (`.closing`), también con Esc.
- **Columnas plegables:** niveles y piezas, cada una con su flecha; solo en pantallas anchas. El contenido conserva su ancho y aparece con un fundido cuando la columna termina de abrir. Tokens en `index.css`: `--ease-soft`, `--fold`, `--levels-width`, `--palette-width`, `--rail`. Las flechas y el botón "?" (`HelpIcon`) son el mismo botón cuadrado `.icon-button`. Preferencias en `circuitos:ui` (`loadPrefs`/`writePrefs` en `src/storage.ts`, validadas), aparte del progreso.
- **Ronda 3:** al plegar o abrir una columna la vista sigue al lienzo y termina encuadrada (`refitKey` en `Editor.tsx`, dura `--fold`); al cambiar el tamaño de la ventana no se reencuadra. Modo libre va debajo de Guía, arriba de los niveles. La columna de niveles mide 212px para que la fila del título respete su margen. Los títulos de la Guía dejan 16px arriba al saltar (`scroll-margin-top`).
- **Reiniciar** pide confirmación ("¿Seguro? Reiniciar", se cancela al salir del botón) solo si el nivel tiene piezas o cables tuyos (`hasWork` en `App.tsx`). **Guardar como chip** en Modo libre abre un formulario (Enter guarda, Esc cancela). Botones y campos comparten `--control-font`. 31 e2e.
- **e2e:** `start(page)` abre los niveles con la teoría cerrada para no tapar piezas; `start(page, { theory: true })` prueba la primera visita real.
- **Pendiente del usuario:** revisar los textos de teoría y guía (los escribió Claude, en es y en). Las historias evitan decir la solución del nivel.

## Iconos, animaciones y sonidos (2026-10-26, subidos)
Verificado: `tsc`, 158 unitarias, lint sin avisos, build, 36 e2e (5 nuevas en `e2e/effects.e2e.ts`) y `npm audit` en 0.
- **Iconos en la paleta:** `src/editor/PieceIcon.tsx`. Las compuertas y los relés usan el mismo dibujo que el lienzo (`src/editor/symbols.tsx`, que sale de `ChipNode`); las demás piezas básicas usan `BASIC_SYMBOLS` en `gates.ts`. `gateShape(kind, pins)` es la regla compartida: un chip que solo comparte el nombre no toma el símbolo. Los chips como sumadores o MUX no llevan icono.
- **Animaciones:**
  - La pista abre y cierra solo con CSS (`::details-content` + `interpolate-size`). Si el navegador no las tiene, abre como antes.
  - `src/usePresence.ts` (`usePresence(value, ref)`) deja montado lo que se cierra, con `.closing` e `inert`, hasta que termina su animación. Lo usan Tabla, Teoría, avisos, resultado y el formulario de chip. `afterAnimations` lo comparte con `useDialog`.
  - El resultado ahora es `src/ResultPanel.tsx`.
  - Token nuevo: `--fade`. Keyframes nuevos en `index.css`.
- **Sonidos:**
  - `src/sound.ts` con Web Audio, sin archivos; la CSP no cambia. `play(name)` toma uno de estos nombres: poof, reset, win, fail, unlock, drop, connect, toggleOn/Off, tick, undo, redo. Las recetas son datos.
  - El reloj automático no suena.
  - Silencio: `Prefs.muted` en `circuitos:ui`, con un botón solo en la bienvenida.

### Ajustes de la ronda 5 (2026-10-26, subidos)
Verificado: `tsc`, 161 unitarias, lint sin avisos, build, 39 e2e y `npm audit` en 0.
- **Iconos de chips:** `CHIP_SYMBOLS` en `gates.ts`. Los sumadores son una caja con "+"; MUX y MUX4 un trapecio, DMUX el trapecio al revés. Los buses llevan la rayita diagonal. Los chips de Modo libre tienen id `U_…`, así que nunca toman el símbolo de un nivel. En la paleta, las palabras largas se dividen con guion.
- **Guía con iconos:** las piezas usan `PieceIcon`; los comandos Tabla, Teoría, Paso a paso y Plegar usan su icono de la barra (como dato en `COMMANDS`); y los conceptos NAND y Reloj usan el de su pieza.
- **Pista:** el triángulo se dibuja con CSS (`clip-path`) a `0.6em`.
- **Tabla y Teoría:** cada una va en una `.panel-slot` que crece o se encoge con `grid-template-rows`, así la otra se recorre suave. El espacio entre ellas es el token `--panel-gap`.
- **Poof:** ahora es ruido pasa-banda con ataque lento más un golpe grave, y suena más bajo. Cada capa acepta su propio `attack`.

## Listo para producción y progreso a salvo (2026-10-27, en commits)
Verificado al final: `tsc`, 172 unitarias, lint sin avisos, build, 42 e2e y `npm audit` en 0.
- **Hosting:** Vercel (antes Cloudflare Pages; lo cambió el usuario el 2026-10-28). Sin CI y sin telemetría (decisiones del usuario).
- **Headers:** viven solo en `vercel.json`: CSP con `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` y caché de un año para `/assets/(.*)`. Vercel pone HSTS solo.
  - `vite.config.ts` lee la CSP de ahí y la mete en un `<meta>` sin `frame-ancestors` (en un `<meta>` se ignora y avisa). Así `vite preview` y las e2e también corren con CSP.
  - `src/vercel.test.ts` revisa que el JSON no pierda nada.
  - `package.json` fija `engines.node` en `22.x`.
- **Error de render:** `src/ErrorBoundary.tsx` envuelve `<App />` en `main.tsx`; muestra `crash.*` y un botón Recargar. El progreso no se toca.
- **LICENSE** MIT (`Copyright (c) 2026 msucedo`). `package.json` en `1.0.0`. `index.html` con description, Open Graph (sin `og:image`), theme-color y `<noscript>`.
- **Versión:** `__APP_VERSION__` sale de `package.json` vía `define` en `vite.config.ts` (tipo en `src/vite-env.d.ts`). Para cambiarla basta `package.json`.
- **Crédito (`Credit` en `Welcome.tsx`):** "Hecho por msucedo", "Reportar un problema" (→ `REPO_URL/issues`) y la versión.
  - En la bienvenida van en una línea, con la versión a la derecha.
  - En la columna de niveles, el autor va centrado y debajo el link y la versión, en una rejilla con `gap: 20px 8px`.
- **Progreso en un archivo:** en la bienvenida, "Tu progreso" tiene Descargar mi progreso, Cargar progreso y Borrar mi progreso.
  - El archivo usa el mismo formato que `circuitos:v1` (`serializeSave`/`parseSaveFile`) y se llama `circuitos-progreso-AAAA-MM-DD.json`.
  - Cargar reemplaza (no mezcla) después de `backupSave`; si el respaldo falla, no hace nada.
  - `parseSaveFile` descarta los niveles que no existen. `readJsonFile` (en `project.ts`) revisa el tamaño antes de leer, y lo usan también Importar y Cargar.
- **Persistencia:** `requestPersistence()` pide `navigator.storage.persist()` al resolver el **primer** nivel, no al cargar la página (Firefox puede pedir permiso). Es una ayuda: Safari puede no respetarla.
- **Borrar mi progreso:** pide confirmación ("¿Seguro? Borrar todo"), y un clic fuera o Tab la cancela (`onBlur`), igual que Reiniciar. En Safari un clic no le da foco a un botón, así que ahí la confirmación no se cancela sola.
- **Bug arreglado:** cancelar el selector de archivos cerraba la bienvenida, porque el `cancel` del `<input type="file">` burbujea hasta el `<dialog>`. Ahora `useDialog` solo atiende el `cancel` del diálogo mismo (`event.target === el`), con su prueba en `src/useDialog.test.tsx`.
- **Sonidos:**
  - `deal` es un crédito de tragamonedas minimalista: Re4 → La4, triángulo, gain 0.7. Suena en `open()` de `App.tsx` al cambiar de nivel o de Modo libre, no al reabrir el mismo ni al cargar o borrar progreso.
  - `fold`/`unfold` subieron a gain 0.9 y llegan a 2400 Hz. Los usan Tabla, Teoría y plegar columnas.
- **e2e intermitentes:** "the theory slides…" medía la mitad de la animación esperando 100 ms. Ahora `freezeHalfway(page, selector)` y `resumeAnimations(page)` (en `e2e/helpers.ts`) congelan la animación justo a la mitad con la Web Animations API.
  - Sin `eval` ni `new Function`, porque la CSP los bloquea dentro de la página.
  - Los tiempos agotados a 30 s no se reprodujeron en más de 300 pruebas, ni con 8 workers. Coincidieron con la máquina ocupada. No se cambiaron `workers`, timeouts ni `retries`.

## Publicar en producción (pasos del usuario)
1. **Deshacer Cloudflare:**
   - En Namecheap → Domain List → Manage `circuitos.io` → Nameservers → volver a **Namecheap BasicDNS** y guardar.
   - En Cloudflare, borrar el sitio `circuitos.io` (en su Overview, abajo: Remove site) y el proyecto de Pages si se creó.
2. **Vercel:** vercel.com → registrarse con GitHub → **Add New → Project** → importar `msucedo/Circuitos`. El preset **Vite** sale solo; no cambiar nada → **Deploy**. Al terminar da una URL `*.vercel.app` para probar.
3. **Dominio:** en el proyecto → **Settings → Domains** → agregar `circuitos.io`. Elegir la opción recomendada: `www.circuitos.io` redirige a `circuitos.io`. Así hay una sola dirección y el progreso no se reparte entre dos.
4. **DNS en Namecheap** → Manage → **Advanced DNS**:
   - Borrar los registros que trae por defecto (el CNAME `www` → parkingpage y el URL Redirect de `@`).
   - Agregar **exactamente** los valores que muestra Vercel en Domains: normalmente un registro **A** con Host `@` y la IP que indique, y un **CNAME** con Host `www` y el valor que indique.
5. **Esperar** de minutos a unas horas. Vercel marca el dominio como válido y pone el certificado SSL solo; no se compra SSL.
6. **Revisar headers:** `curl -I https://circuitos.io` debe mostrar `content-security-policy` (con `frame-ancestors 'none'`), `strict-transport-security`, `x-content-type-options`, `referrer-policy` y `permissions-policy`. Después, securityheaders.com.
7. **Probar a mano en el sitio publicado:**
   - Resolver NOT.
   - Descargar el progreso, borrarlo y cargarlo.
   - Abrir Cargar progreso y cancelar: la bienvenida debe seguir abierta.
   - Revisar la consola sin errores de CSP.
   - Probarlo también en Safari.
8. **Correo falso (opcional):** en Advanced DNS, tres registros TXT:
   - `@` → `v=spf1 -all`
   - `_dmarc` → `v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s;`
   - `*._domainkey` → `v=DKIM1; p=`
9. **Después:** pedirle a Claude `og:image` con `https://circuitos.io`.
10. **Cada push a `main` publica solo.** Antes, la lista de "Reglas del usuario".

## Lo siguiente: la mini CPU
Es el último nivel del bloque 3. **Antes de escribir código hay que decidir con el usuario** (con plan y preguntas):
1. **Conjunto de instrucciones.** Con lo que ya hay (palabras de 4 bits, RAM de 4 palabras, ALU con ADD/SUB/AND/OR, contador con `load`), una opción es un acumulador: `LOAD addr`, `STORE addr`, `ADD/SUB addr`, `JMP addr`, `JZ addr` (usa la bandera `zero` de ALU4).
2. **Cómo llega el programa.** ¿Una ROM como entrada del nivel (bus de instrucción), o memoria compartida? Lo más simple para probar es que la instrucción entre por un pin y que el PC salga por otro.
3. **Uno o varios niveles.** Por ejemplo, primero el "decodificador de instrucciones" o el "camino de datos" y después la CPU completa.
4. **Cómo se prueba.** Con `sequentialSpec` y un modelo de la CPU (`next`/`read`) que ejecuta un programa corto. Lo esperado se calcula, no se escribe a mano.
5. **Guardado.** Si la CPU guarda algo nuevo (por ejemplo el programa), primero la migración del guardado (ver Reglas del usuario).

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
- **Formato del guardado:** `parseSave` en `src/sim/schema.ts` rechaza todo lo que no sea `version: 1` (`loadSave` deja la copia en `circuitos:v1:corrupto` y el jugador empieza de cero). Antes de cambiar la forma de lo guardado (el programa de la mini CPU, RAM más grande, renombrar niveles), primero hay que escribir la migración `v1 → v2`, con pruebas, y dejar un respaldo del guardado viejo. Agregar un nivel nuevo no cambia el formato.
- Antes de dar algo por terminado: `npx tsc -b`, `npx vitest run`, `npm run lint`, `npm run build`, `npx playwright test`, `npm audit --audit-level=high`.

## Pendiente menor
- `og:image` en `index.html` cuando haya dominio final.
- La tabla en vivo en niveles con memoria (Bit, Registro, Contador, RAM, Flip-flop D) muestra combinaciones partiendo de la memoria en cero, lo que dice poco en un circuito con reloj. Opción: en esos niveles mostrar una nota en lugar de la tabla, o una tabla de los ciclos del spec.
- Las traducciones al inglés las escribió Claude: el usuario no las ha revisado.

## Comandos
```
npm run dev        # http://localhost:5173
npx vitest run     # unitarias
npx playwright test  # e2e (build + preview en :4173, Chrome instalado); capturas en test-results/shots
```
