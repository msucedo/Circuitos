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
