# Portabilidad — src/components/plano

Fuente de verdad: priusApp/src/components/plano. beachFlow tiene una copia
exacta — cualquier cambio se hace acá y se vuelve a copiar.

## Regla

Los archivos de esta carpeta solo importan `react`, `lucide-react` y otros
archivos de esta misma carpeta. Nada de DataProvider, router, permisos,
OverlayProvider, `lib/format` ni `lib/colors` de afuera. Si algo de eso
hiciera falta, se pasa por props, o se copia a esta carpeta (ver abajo).

## Lo que beachFlow necesita para que se vea idéntico

### CSS custom (fuera de Tailwind)

Una sola clase, usada por el cluster de botones de zoom de
`PlanoViewport.jsx`:

```css
.glass-card {
  background: rgba(23, 32, 48, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.15);
}
```

(Fuente: `priusApp/src/index.css`. Sin `backdrop-filter` a propósito — el
blur en tiempo real fuerza al compositor a re-rasterizar en cada
hover/scroll, ver el comentario original ahí.)

`PlanoGrid.jsx` y `CeldaPublica.jsx` no usan ninguna clase custom — solo
utilidades de Tailwind (incluidos valores arbitrarios como `bg-[#FDE047]`).

### tailwind.config.js

Nada que extender. Todos los colores de esta carpeta (`#FDE047`, `#F2CA50`,
los `sky-*`/`gray-*` de los rótulos fijos) se usan como valores arbitrarios
de Tailwind (`bg-[#FDE047]`) o clases de la paleta default — no dependen de
ningún token agregado en `extend`. Cualquier proyecto con Tailwind v3 + JIT
los resuelve sin tocar su config.

### Fuente

Ninguna clase de esta carpeta fija `font-family` — hereda la que use el
`body` de quien la use. El Montserrat del CRM no es un requisito de este
paquete.

## Archivos

- `planoLayout.js` — estructura visual pura: carpas por fila/pasillo (6
  hileras + 3 bloques dobles espalda-con-espalda + pasillos A/B/C) y
  sombrillas en 4 filas de dos columnas con hueco al medio. Indexada por
  `fila`/`orden`, igual que `unidades.fila`/`orden` en la base — verificado
  1:1 contra las 184 unidades reales (Fase 4A, Tarea 1).
- `PlanoGrid.jsx` — dibuja el plano completo (rótulos fijos + carpas +
  sombrillas) a partir de `planoLayout.js`. Recibe `unidades` (lista con
  al menos `{ id, numero, tipo, fila, orden }`) y `renderCelda(unidad)` —
  no sabe nada de reservas ni de estados, solo de dónde va cada unidad.
- `PlanoViewport.jsx` — contenedor con zoom: pinch táctil + botones en
  mobile, fit-to-container con pan por drag y Ctrl+rueda en desktop/tablet,
  elegido por la prop `isFitMode`. Completamente controlado por props, sin
  estado propio — así el zoom/pan no se resetea si el árbol que lo monta se
  desmonta y remonta (caso real: el modal de pantalla completa del CRM).
- `CeldaPublica.jsx` — celda de la landing: `libre` (seleccionable) /
  `bloqueada` (candado, no seleccionable) / `seleccionada` (acento dorado
  `#F2CA50`) / `sugerida` (mismo acento, más suave). Sin colores por
  tipo_alquiler — la landing no sabe qué tipo de alquiler ocupa cada
  unidad, solo si está disponible.

`Cell.jsx` (la celda del CRM, con colores por `tipo_alquiler`, estado de
pago, preconfirmada web, tooltip, etc.) sigue viviendo en
`src/components/dashboard/` — es específica del CRM y no es portable; se le
sigue pasando a `PlanoGrid` como `renderCelda` desde `Dashboard.jsx`.

## Desvío conocido

`Cell.jsx` dibuja cada celda en `w-6 h-4.5 md:w-7 md:h-5` (24×18 / 28×20px)
para que las ~184 entren en pantalla sin scroll excesivo — por debajo del
mínimo táctil de 44×44 que pide el resto del CRM (ver CLAUDE.md
"Mobile-first"). `CeldaPublica.jsx` usa ese mismo tamaño a propósito, para
verse idéntica — no se infló el tamaño para cumplir el mínimo, tal como ya
no lo cumple hoy el Plano del CRM.
