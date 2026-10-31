# Handoff: Circuitos (2026-10-30)

## Dónde quedamos
- **En producción en https://circuitos.io** (Vercel, desde el 2026-10-28; el usuario dejó Cloudflare porque le resultó complicado). Dominio en Namecheap con BasicDNS. `www.circuitos.io` redirige a `circuitos.io`, que es la dirección principal; no cambiarla, porque el progreso vive en el localStorage de esa dirección. Verificado en producción: CSP con `frame-ancestors`, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy` y `assets/` `immutable`.
- **Imagen para compartir:** `public/og.png` (1200×630), con las etiquetas `og:*` y `twitter:card` en `index.html`. Se hizo renderizando una plantilla HTML (logo, texto y recorte de `docs/img/nivel.webp`) con Playwright; si cambia el diseño del juego, se regenera.
- Verificado el 2026-10-30: `tsc` (app y e2e), 214 pruebas unitarias, lint sin avisos, build, 57 e2e en Chrome real (con CSP) y `npm audit` en 0.
- **Último commit:** `273e6f9` (guía al día). **Sin subir:** las miniaturas sin `pop`, la galería → vista previa sin parpadeo (en "Editar chips, galería y guía") y este HANDOFF.
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

## Compartir y galería (2026-10-28, en `56045b2`)
Verificado: `tsc`, 191 unitarias, lint sin avisos, build, 47 e2e (5 nuevas en `e2e/share.e2e.ts`) y `npm audit` en 0.
- **Link:** Modo libre → **Compartir**. El circuito y sus chips van comprimidos en el fragmento: `#c=1.<deflate-raw base64url>` (`src/share.ts`). El fragmento no llega al servidor y no hay backend.
  - Al leerlo, el hash se borra (`takeSharedTarget` en `App.tsx`) y también se atiende `hashchange`.
  - El diálogo muestra el porcentaje que usa del máximo. Si se pasa, dice cuántas piezas tiene y cuántas caben (más de 200, calculado, no escrito a mano) y manda a Exportar.
- **Límites** en `LIMITS` (`src/sim/schema.ts`):
  - `shareChars` 5000 (los datos del link).
  - `description` 200.
  - `issueUrl` 8000 (el máximo práctico de GitHub). Una prueba asegura que el peor caso cabe.
  - El mismo límite aplica a la galería.
- **Seguridad del link:**
  - Se revisa el largo antes de decodificar.
  - La descompresión se corta al pasar `LIMITS.bytes` (contra bombas de descompresión).
  - Después todo pasa por `parseProject`.
  - Errores nuevos: `shareTooLong` y `shareCorrupt`.
  - La CSP no cambió.
- **Vista previa** (`src/PreviewDialog.tsx`): es el único camino que reemplaza el sandbox, y ahora también la usa **Importar**.
  - Muestra las piezas y los chips: nuevo, ya lo tienes o choca.
  - Un chip que choca (mismo id con otro circuito) se sigue rechazando, pero se puede **renombrar** ahí mismo (`renameChip` en `project.ts`, decisión del usuario).
  - Abrir hace `backupSave` antes; si el respaldo falla, no hace nada.
  - Con un link en la URL, la bienvenida no se abre.
- **Guardar y restaurar mi Modo libre (2026-10-29):** si Modo libre tiene trabajo, la vista previa trae la casilla "Guardar mi Modo libre actual…", **marcada** por defecto (decisión del usuario).
  - Se guarda como `Project` (el circuito más los chips que usa) en la clave aparte `circuitos:modo-libre` (`SAVED_SANDBOX_KEY`, `loadSavedSandbox`/`writeSavedSandbox` en `storage.ts`). Es un solo lugar y avisa si reemplaza.
  - No está en `circuitos:v1` (no hubo migración) ni en Descargar mi progreso.
  - Se guarda **antes** de reemplazar; si falla, no se abre nada.
  - Al leerlo pasa por `parseProject`; si está dañado se borra.
  - El botón **Restaurar mi Modo libre** (junto a Guardar como chip) es un **deshacer de un uso** (decisión del usuario): usa la misma vista previa con `restore: true`, sin casilla, con el título "¿Restaurar tu Modo libre guardado?" y el botón "Sí, restaurar".
  - Al restaurar, `clearSavedSandbox` copia lo guardado a `circuitos:modo-libre:respaldo`, lo quita y el botón desaparece. Si la copia falla, no restaura.
  - **Borrar mi progreso también lo borra**, con la misma copia.
  - Un chip no se puede abrir para editarlo, y por eso existe esto.
  - Hay 200 unitarias y 50 e2e. La e2e "4-bit bus" falla a veces con la máquina cargada; sola pasa 5 de 5.
- **Galería:** botón debajo de Modo libre (`src/GalleryDialog.tsx`).
  - La lista está en `src/gallery/gallery.json` (validada con `parseGallery`) y cada circuito va en `src/gallery/circuits/<slug>.json`, cargado como su propio chunk (`?raw`) y validado como un link.
  - El link de una entrada es `#g=<slug>`.
  - Los textos de la comunidad se muestran como texto plano.
  - Semilla: "Mayoría de 3" (6 NAND, no es solución de ningún nivel; tiene su prueba).
- **Envío:** "Enviar a la galería" (con nombre y qué hace) abre un issue prellenado con `.github/ISSUE_TEMPLATE/galeria.yml` (los campos `nombre`, `descripcion` y `link`, la etiqueta `galeria` y la casilla de licencia MIT).
- **Aprobar un envío (usuario):**
  1. Revisar el issue.
  2. `npm run gallery:add -- "<link>" --name "..." --description "..." --author <usuario-github>`. Valida igual que el juego, prueba que el circuito arma y escribe los dos archivos.
  3. `npm run dev` para verlo.
  4. Commit y push.
  5. Cerrar el issue.
- **Pendiente del usuario:**
  - Crear la etiqueta `galeria` en GitHub (si no existe, el issue se crea sin etiqueta).
  - Revisar los textos `share.*` y `gallery.*`.
  - Probar en Safari después del deploy.
- **Guía:** comandos Compartir y Galería. `chipLabel` (`i18n.ts`) da el nombre de un chip de nivel en el idioma actual. `AUTHOR_URL`/`REPO_URL` viven en `src/links.ts`.
- **Riesgo conocido (ya existía):** un link puede traer un chip de nivel que el jugador no ha resuelto (por ejemplo `XOR`). Entra a su paleta del Modo libre con ese nombre sin verificarse contra la spec. Los niveles no lo usan hasta resolverlo (`levelLibrary` pide `solved`).

## Mejoras de Modo libre (2026-10-29, en `de9c2e1`)
Verificado: `tsc` (app y e2e), 208 unitarias, lint sin avisos, build, 57 e2e y `npm audit` en 0. El usuario lo probó a mano y lo aprobó. Sin dependencias nuevas, sin cambios de CSP ni del formato del guardado.
- **e2e intermitente:** "undo, redo, copy and paste" falló 2 veces por tiempo agotado en la suite completa con la máquina ocupada. Sola pasa 12 de 12 con 6 workers y la suite repetida pasa 57 de 57. No se encontró causa en la app; si vuelve a fallar con la máquina libre, investigarla.
- **Errores estandarizados:** `showError`/`showProblem` en `App.tsx` suenan `fail` y el `.notice.error` se sacude como un Probar fallido. `errorCount` entra en el `key` del aviso, así que el mismo error repetido se vuelve a sacudir. El error de guardado en segundo plano (`writeSave`) sigue callado para no repetirse.
- **Borrar chips desde Piezas:** la lista "Mis chips" del header ya no existe.
  - En la paleta, en la misma línea que "Tus chips" (`role="group"`), hay un botón **Editar / Listo**. Al editar, cada chip propio lleva una insignia × roja (`--bad`) en la esquina.
  - El primer clic hace que "¿Borrar?" entre deslizándose desde la derecha y ocupe el lugar del chip, que sale por la izquierda y queda `inert` (`slide-in-right`/`slide-out-left`, duran `--slide` 0.6 s con `--ease-soft`; rejilla de una celda en `.removable-piece`). Es el mismo botón, así no pierde el foco. El segundo clic borra.
  - La edición termina sola (decisión del usuario): con un clic fuera (`pointerdown`), al salir con Tab (`onBlur` del grupo), al agregar un chip, al cambiar de pantalla (remonta) o cuando ya no quedan chips.
  - La lógica sigue en `deleteChip` (`chipUsers` y la confirmación `confirmDelete`). El Editor recibe `customChips`, `confirmingChip`, `onRemoveChip` y `onCancelRemove`.
- **Icono de chip propio:** `CUSTOM_CHIP_SYMBOL` (un chip DIP con muesca) en `gates.ts`. Sale de `customChips` (los chips guardados que no son de nivel), no del prefijo `U_`.
- **Limpiar:** botón de la barra solo en Modo libre (`clearable`), con `ClearIcon`. Pide confirmación ("¿Seguro? Limpiar", y salir del botón la cancela) y usa `deleteElements`, así que se deshace con Ctrl+Z y tiene la animación de salida. Está en la Guía (`guide.commands.items.clear`).
- **Entrada y salida de piezas:** las compuertas y los relés (`.gate`) ahora hacen `pop` como los chips. Al borrar, `onBeforeDelete` marca los nodos y cables con `.leaving` (`pop-out`/`fade-out`, que duran `--fade`) y espera `afterAnimations`. Con reduced motion se borra al instante. **Borrar ya no es síncrono**: en las pruebas hay que esperar (`waitFor` o `toHaveCount`).
- **Arreglo de pines desacomodados:** con el `pop` de `.gate`, React Flow medía los pines al montar la pieza, todavía escalada, y los cables llegaban corridos, sobre todo al pin de arriba de las compuertas. Ahora `ChipNode` llama `updateNodeInternals(id)` en `onAnimationEnd` del propio nodo. Además, al pasar el mouse el pin crecía y se movía: el `scale` también agrandaba el `translate(-50%, -50%)` de React Flow. Con `transform-origin: 0 0` en `.react-flow__handle` crece desde su centro. Lo cubre la e2e "after a piece pops in, its wires still meet the middle of its pins".
- **Zoom:** + y − suenan `zoomIn`/`zoomOut` (recetas nuevas) y centrar suena `tick`, en todo el juego. Dar `onFitView` reemplaza el encuadre de React Flow, así que ahora encuadra con `fitOptions(besideTheory)`, igual que al plegar una columna.
- **Link compartido con el sandbox vacío:** la vista previa ya no dice "Reemplaza lo que tienes en Modo libre." (solo aparece si hay `keepCurrent`).
- **e2e:** `recordSounds`/`sounds` pasaron a `e2e/helpers.ts`. Los selectores de "Mis chips" ahora usan `getByRole('group', { name: 'Tus chips' })`. Capturas nuevas: `edit-chips.png` y `confirm-delete-chip.png`.
- **Pendiente del usuario:** revisar los textos nuevos en inglés (`editor.clear`, `confirmClear`, `editChips`, `doneEditing` y `guide.commands.items.clear`).

## Editar chips, galería y guía (2026-10-30, en `1e86cb5`, `6379edd` y `273e6f9`)
Verificado al final: `tsc` (app y e2e), 214 unitarias, lint sin avisos, build, 57 e2e y `npm audit` en 0. Sin dependencias nuevas, sin cambios de CSP ni del formato del guardado.
- **Parpadeo al editar chips, arreglado:** al entrar a Editar, o al darle Listo con "¿Borrar?" a la vista, los chips propios se remontaban y sus animaciones volvían a correr.
  - Ahora `chipButton` (`Editor.tsx`) siempre envuelve un chip borrable en `.removable-piece`, con las clases `editing` y `confirming`. El DOM no cambia y la × solo se pinta al editar.
  - El cambio a "¿Borrar?" usa **transiciones** (opacity/translate con `--slide` y `--ease-soft`), no animaciones, porque las transiciones no corren al montar.
  - Lo cubre una prueba en `Editor.test.tsx` que revisa que el chip no se remonte.
- **Al entrar a Editar:** los chips con × hacen `pulse-bad` dos veces (keyframe en `index.css`, con un halo `--bad`) y suena `edit` (receta nueva: dos golpes de triángulo en Mi5). Con reduced motion no hay pulso.
- **Galería (`GalleryDialog.tsx`):**
  - El botón suena `deal`, como los niveles y Modo libre.
  - Cerrar es una × arriba a la derecha (`.sheet-head`, `gallery.close`); ya no hay botón abajo.
  - Cada entrada trae una **miniatura estática** del circuito. `useThumbnails(open)` carga los circuitos la primera vez que se abre la galería (no al cargar la página), y se cancela si el diálogo se desmonta.
  - Segunda entrada: "Medio sumador" (`medio-sumador`, 5 NAND, salidas `suma`/`acarreo`), agregada con `npm run gallery:add` y con su prueba en `gallery.test.ts`.
- **`CircuitView` (`src/editor/CircuitView.tsx`, nuevo):** dibuja un circuito con las piezas del editor, sin mover, conectar ni borrar nada. El reloj se queda en 0.
  - Con `live` las entradas se pueden tocar (y suenan). Sin `live` es una imagen: `inert` y `aria-hidden`, sin paquetes en los cables.
  - Los nodos van en `useNodesState`: si son controlados sin `onNodesChange`, React Flow nunca los mide y no se puede encuadrar.
  - `FitOnResize` vuelve a encuadrar cuando cambia el tamaño, porque dentro de un `<dialog>` cerrado la vista se arma a 0×0.
  - `ariaLabelConfig` vacía las pistas de React Flow sobre mover y borrar, que aquí no aplican.
  - `toWires` (en `convert.ts`) y `nodeTypes`/`edgeTypes` (`flowTypes.ts`) ahora los comparten el Editor y la vista.
- **Vista previa (`PreviewDialog.tsx`):** tiene pestañas **Diagrama / Piezas / Tabla de verdad** (patrón de pestañas de WAI-ARIA: flechas, Home y End; cambiar de pestaña suena `tick`).
  - Solo se monta la pestaña abierta, así que el diagrama deja de simular al cambiar de pestaña. Al volver, las entradas regresan a 0.
  - Diagrama: el circuito vivo y "Toca las entradas para probarlo." Piezas: cada pieza con su icono y su cantidad (sin entradas ni salidas), más el total. Tabla: `TruthTable`.
  - Un diálogo cerrado no deja nada montado (usa el `shown` de `useDialog`).
  - Abierta desde la galería (`fromGallery`), Cancelar dice "Volver a la galería" y la reabre.
- **Galería → vista previa sin parpadeo (sin subir):** antes la galería se cerraba y la vista previa se abría, y el fondo oscuro se iba y volvía.
  - Ahora la vista previa se abre **encima** de la galería, que sigue abierta. La galería queda oculta (`.covered`, opacidad 0) y su fondo se queda; la vista previa no pinta su propio `::backdrop`.
  - **La tarjeta se transforma en la vista previa** (opción A del usuario, estilo tarjetas de la App Store). Antes probó un recorte desde la tarjeta y un zoom de cámara, y no le gustaron.
    - Usa View Transitions: `morph(update)` en `src/morph.ts` envuelve el cambio de estado en `document.startViewTransition` con `flushSync`, y pone `html.morphing` mientras corre. Sin la API, o con reduced motion, el cambio pasa sin animación.
    - Nombres compartidos en `app.css`: `entry-card` (la tarjeta `.morph-source` ↔ la hoja `.preview.from-gallery`), `entry-diagram` (la miniatura ↔ el diagrama vivo), `entry-title`, `entry-description`, `entry-author` y `entry-actions` (clases `entry-*` en los dos componentes). La tarjeta lleva los nombres solo mientras se ve (`chosen` en `GalleryDialog`, y sin `covered`), para que no se repitan.
    - Abrir (`openGalleryEntry`) y Volver (`onCancel` con `fromGallery`) pasan por `morph`. Durante la transición, la vista previa cierra sin su `sheet-out` (`.morphing .preview.closing`), así `useDialog` la cierra en el mismo paso.
    - Duración en el token `--morph` (0.5 s) con `--ease-soft`.
    - Capturas `gallery-morph-start.png`, `gallery-morph.png` y `gallery-morph-back.png`: la e2e pausa y adelanta las animaciones `::view-transition`.
  - Volver solo cierra la vista previa: la galería conserva su scroll y el foco regresa al botón Abrir. Abrir en Modo libre cierra las dos. Si la carga falla, se cierra la galería para que el error se vea.
  - Las piezas de las miniaturas y de la vista previa ya no hacen `pop` (`.circuit-view .chip, .circuit-view .gate`), así que los cables no se reacomodan.
  - **Primera apertura sin brincos:** las miniaturas cargan al abrir la galería por primera vez, y al llegar empujaban el texto de las tarjetas. Ahora:
    - Mientras cargan hay una caja vacía `.circuit-view` del mismo tamaño.
    - `CircuitView` se muestra (`.fitted`, con un fundido) solo después del primer `fitView`, así no se ve el encuadre.
    - La e2e de la galería retiene el chunk `mayoria-de-3-*.js` con `page.route` y revisa que la tarjeta no cambie de alto. Se comprobó que falla sin la caja.
- **Guía:** comando nuevo **Editar** (`editChips`, después de Guardar como chip). Galería y Compartir ahora dicen que se puede probar el circuito antes de abrirlo. En inglés, Guardar como chip decía "In the Sandbox" y ahora dice "In Free mode".
- **e2e:** `node` y `handle` (`e2e/helpers.ts`) buscan solo dentro de `.canvas`, porque las vistas previas también tienen nodos de React Flow. Hay capturas nuevas: `gallery.png`, `gallery-preview.png` y `gallery-preview-table.png`.
- **Detalles conocidos:**
  - En circuitos anchos los interruptores del diagrama vivo se ven chicos.
  - La miniatura muestra el crédito de React Flow.
  - El reloj no corre en las vistas previas.
- **Pendiente del usuario:** revisar los textos nuevos (`share.tryIt`, `tabs`, `diagram`, `parts`, `truthTable`, `backToGallery`, `gallery.close` y `guide.commands.items.editChips`), sobre todo en inglés.

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
- La tabla en vivo en niveles con memoria (Bit, Registro, Contador, RAM, Flip-flop D) muestra combinaciones partiendo de la memoria en cero, lo que dice poco en un circuito con reloj. Opción: en esos niveles mostrar una nota en lugar de la tabla, o una tabla de los ciclos del spec.
- Las traducciones al inglés las escribió Claude: el usuario no las ha revisado.

## Comandos
```
npm run dev        # http://localhost:5173
npx vitest run     # unitarias
npx playwright test  # e2e (build + preview en :4173, Chrome instalado); capturas en test-results/shots
```
