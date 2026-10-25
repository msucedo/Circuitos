# Circuitos

Arma una computadora desde una compuerta NAND. Cada nivel resuelto se vuelve un chip que puedes usar en los siguientes.

```
npm install
npm run dev        # app en http://localhost:5173
npm test           # tests (motor, schema, editor, niveles, guardado)
npm run sim:demo   # tablas de verdad en la terminal
npm run sim:verify -- examples/xor.json XOR
```

- `src/sim/`: motor puro (sin DOM): `simulate`, `flatten` (chips anidados), `verify`, `schema` (validación de todo JSON externo).
- `src/editor/`: editor con React Flow.
- `src/levels/`: niveles y lo que prueba cada uno.
- `src/storage.ts`, `src/project.ts`: progreso en localStorage, exportar e importar.

## Editor

- Buses de 1 a 16 bits: elige "Bits" en la paleta antes de agregar Entrada, Salida, Separar o Juntar. Un cable solo conecta pines del mismo ancho.
- Ctrl/⌘ + Z deshacer, Ctrl/⌘ + Shift + Z (o Ctrl + Y) rehacer, Ctrl/⌘ + C / V copiar y pegar (también entre niveles).
- Doble clic en el nombre de una entrada o salida (modo libre) para renombrarla.
- "Tabla": tabla de verdad en vivo (hasta 6 bits de entrada); en los niveles marca las filas incorrectas.
- "Paso a paso": la señal avanza una compuerta por clic con "Avanzar".
- Cada cambio de valor manda un paquete por el cable (se desactiva con "reducir movimiento" del sistema).
