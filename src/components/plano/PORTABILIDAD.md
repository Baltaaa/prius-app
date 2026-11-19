# Portabilidad — src/components/plano

Fuente de verdad: priusApp/src/components/plano. beachFlow tiene una copia
exacta de TODA la carpeta: cualquier cambio se hace acá y se vuelve a copiar,
siempre desde un commit concreto de priusApp.

## Regla

Los archivos de esta carpeta solo importan `react`, `lucide-react` y otros
archivos de esta misma carpeta. Nada de DataProvider, router, permisos,
OverlayProvider, `lib/format` ni `lib/colors` de afuera. Si algo de eso
hiciera falta, se pasa por props.

## Vista clientes (Fase 6A, nov 2026): lo que usa la landing

La landing usa la misma interfaz que el modal "vista clientes" (pantalla
completa) del Plano del CRM. El modal del CRM consume exactamente estos tres
componentes, así que lo que se ve en el CRM es lo que se ve en la web
(`e2e/plano-clientes-visual.spec.ts` lo compara píxel a píxel a 360, 390 y
1440, en claro y oscuro).

- `MarcoPlanoClaro.jsx` — el marco. Sin datos: todo por props y el cuerpo por
  children.
  - `variante="amplia"` (≥768px): header con `logo` (slot), `selectorFecha`
    (slot), chips Todo / Carpas / Sombrillas y la X (`onCerrar`, opcional); el
    mapa en `PlanoViewport` y a la derecha la columna +, −, Encuadrar, Rotar.
    El zoom lo maneja `usePlanoEncuadre()` y se pasa como `encuadre`.
  - `variante="compacta"` (<768px): fila con `selectorFecha` + chips (scroll
    horizontal con snap), el mapa en `ZoomPanPinch` y una pill flotante con
    +, −, Encuadrar, Rotar y cerrar (`onCerrar`).
  - Props: `tipo` (null | 'carpas' | 'sombrillas') + `onTipo`, `emojiCarpa` /
    `emojiSombrilla` (en el CRM salen de `lib/unidadIcono.js`: 🏠 y 🏖️),
    `rotado` + `onRotar`, `cargando`, `resetKey` (compacta: re-encuadra al
    cambiar), `slideRef` + `onAnimationEnd` (animación al cambiar de fecha).
- `PlanoClaro.jsx` — el cuerpo: Recreación / Acceso / Pileta, las 6 hileras de
  carpas con sus pasillos, el sector sombrillas y el océano animado. Es
  `PlanoRotable` + `PlanoGrid` (la geometría sigue en un solo lugar,
  `planoLayout.js`). Props: `unidades`, `renderCelda`, `rotado`, `mar`.
- `CeldaClara.jsx` — la casilla.
  - `estado`: `libre` (blanca, seleccionable), `ocupada` (negra, no
    seleccionable), `elegida` (dorado #F2CA50 sólido), `sugerida` (blanca con
    borde dorado).
  - `deshabilitada`: el tipo quedó afuera por los chips (atenuada, sin click).
  - `resaltada`: el tipo coincide con el chip elegido (aro dorado). El CRM
    hace las dos cosas a la vez al filtrar: atenúa lo que no corresponde y
    marca lo que sí.
  - `tamano`: `compacta` (24×18 / 28×20, número afuera del lado `numberSide`;
    para `amplia`) o `tactil` (44×36, número adentro; para `compacta`).
  - `onClick(numero)` solo se llama en una casilla seleccionable. `etiqueta`
    va como `aria-label` (ej. "Carpa 74, libre"). Los `data-*` pasan al botón.

Ejemplo (landing, desktop):

```jsx
const encuadre = usePlanoEncuadre({ isMobile: false, remedir: cargando })
<MarcoPlanoClaro
  variante="amplia"
  logo={<img src="/images/prius-icon.png" alt="Prius" className="w-11 h-11 object-contain shrink-0" />}
  selectorFecha={<MiSelectorDeFecha />}
  tipo={tipo} onTipo={setTipo} emojiCarpa="🏠" emojiSombrilla="🏖️"
  rotado={rotado} onRotar={() => setRotado((v) => !v)}
  cargando={cargando} encuadre={encuadre}
>
  <PlanoClaro
    unidades={unidades}
    rotado={rotado}
    renderCelda={(slot) => (
      <CeldaClara
        key={`${slot.tipo}-${slot.numero}`}
        numero={slot.numero}
        numberSide={slot.numberSide}
        tamano="compacta"
        estado={estadoDe(slot)}            // de disponibilidad_publica + la selección
        deshabilitada={tipo && !coincide(slot, tipo)}
        resaltada={tipo && coincide(slot, tipo)}
        onClick={elegir}
      />
    )}
  />
</MarcoPlanoClaro>
```

El selector de fecha es un slot porque el del CRM (`PlanoNavegadorFecha`, con
`DateInput` y react-day-picker) no es portable. Para verse igual: una pill de
40px de alto, fondo negro 6% (`bg-black/[0.06]`), ‹ fecha › con botones de
32px.

Ocupado / libre en la landing: `disponibilidad_publica(desde, hasta)` →
`bloqueada` = `ocupada`. Tiempo real: canal Broadcast `disponibilidad`, evento
`cambio` → volver a consultar (debounce ~500ms). El CRM calcula lo mismo con
sus propios datos (`lib/planoUnits.js`): todo lo que no está libre (incluida
la pendiente de confirmación) es `ocupada`.

## Lo que beachFlow necesita para que se vea idéntico

### CSS custom (fuera de Tailwind)

Copiar tal cual de `priusApp/src/index.css`:

```css
/* Rotar 180° (PlanoRotable) y rótulos que contra-giran */
.plano-rotable { transform: rotate(var(--plano-giro, 0deg)); transform-origin: 50% 50%; transition: transform 600ms cubic-bezier(.4, 0, .2, 1); }
.plano-contra { display: inline-block; transform: rotate(var(--plano-contra, 0deg)); transition: transform 600ms cubic-bezier(.4, 0, .2, 1); }
@media (prefers-reduced-motion: reduce) {
  .plano-rotable, .plano-contra { transition-duration: 1ms; }
}
/* Olas del océano (MarCliente en PlanoGrid) */
@keyframes plano-ola { to { transform: translateX(calc(var(--ola-p) * -1)); } }
.plano-ola { animation: plano-ola 18s linear infinite; }
@media (prefers-reduced-motion: reduce) { .plano-ola { animation: none; } }
/* Opcional: deslizamiento del mapa al cambiar de fecha (slideRef) */
@keyframes plano-slide-in-left { from { transform: translateX(24px); opacity: 0.4; } to { transform: translateX(0); opacity: 1; } }
@keyframes plano-slide-in-right { from { transform: translateX(-24px); opacity: 0.4; } to { transform: translateX(0); opacity: 1; } }
.plano-slide-left { animation: plano-slide-in-left 200ms ease-out; }
.plano-slide-right { animation: plano-slide-in-right 200ms ease-out; }
```

Sin `.plano-contra`/`.plano-rotable` el botón Rotar gira, pero los números
quedan cabeza abajo: son obligatorias si se muestra Rotar.

El marco también lleva las clases `plano-hoja`, `plano-mobile-root`,
`plano-mobile-controles` y `scroll-x-snap`: en el CRM tienen reglas propias,
pero el marco ya trae sus equivalentes en Tailwind, así que en beachFlow no
hace falta definirlas.

`.glass-card` solo la usa la barra de zoom flotante propia de
`PlanoViewport.jsx`, que el marco oculta: no hace falta para la vista
clientes.

### tailwind.config.js

Nada que extender. Todos los colores son valores arbitrarios (`bg-[#F2CA50]`,
`bg-[#F2F1EC]`, `text-[#6B6B6B]`, `rounded-[24px]`) o de la paleta default.
Hacen falta Tailwind v3.3+ (variantes arbitrarias como
`[&>div:first-child]:hidden` y `[&::-webkit-scrollbar]:hidden`) y el JIT
escaneando esta carpeta.

**Modo oscuro:** los componentes llevan variantes `dark:` que leen variables
del CRM (`rgb(var(--card))`, etc.). beachFlow no tiene modo oscuro: su
`tailwind.config.js` tiene que declarar `darkMode: 'class'` (o el mismo
`['class', '[data-theme="dark"]']` del CRM) y nunca ponerla, para que NO se
activen por el tema del sistema operativo del visitante (el default `media`
las prendería).

### Botones y tamaños táctiles

El CRM tiene una regla global `button { min-height: 44px }` en mobile. Las
pills y chips del marco ya fijan su alto (`h-11 md:h-8 min-h-0`, `min-h-0` en
la pill de zoom), así que se ven igual con o sin esa regla.

### Fuente

Ninguna clase fija `font-family`: hereda la del `body` (Manrope en el CRM).

### Assets

- Logo: lo pasa quien usa el marco (`logo`). El CRM usa
  `/images/prius-icon.png` (44px); beachFlow usa su propia copia.
- Océano: SVG inline dentro de `PlanoGrid.jsx` (`MarCliente`), sin imágenes.

## Archivos

- `planoLayout.js` — estructura visual pura (6 hileras + 3 pasillos de
  carpas, sombrillas en 4 filas de dos columnas), indexada por `fila`/`orden`
  igual que `unidades.fila`/`orden` (verificado 1:1 contra las 184 unidades).
- `PlanoGrid.jsx` — dibuja el plano completo a partir de `planoLayout.js`.
  Recibe `unidades` (al menos `{ id, numero, tipo, fila, orden }`),
  `renderCelda(slot)` y `mar`.
- `PlanoViewport.jsx` — contenedor con zoom (fit-to-container, pan por drag,
  Ctrl+rueda, pinch), 100% controlado por props.
- `usePlanoEncuadre.js` — el estado de ese zoom (desktop/tablet).
- `ZoomPanPinch.jsx` — mapa táctil mobile con gestos propios (arrastre con
  umbral, pinch anclado, doble tap, rebote) y API imperativa
  (`acercar`/`alejar`/`encuadrar`).
- `PlanoRotable.jsx` — capa que gira 180°.
- `ControlesZoomPlano.jsx` — `BarraZoomPlano` (columna desktop) y
  `PillZoomPlano` (pill mobile).
- `MarcoPlanoClaro.jsx`, `PlanoClaro.jsx`, `CeldaClara.jsx` — la vista
  clientes (arriba).
- `CeldaPublica.jsx` — **deprecada** (Glass Dark de la Fase 4A). La landing
  pasa a `CeldaClara`; no se borra todavía.

`Cell.jsx` / `CellMobile.jsx` (las celdas de la vista normal del CRM, con
colores por tipo de alquiler y estado de pago) viven en
`src/components/dashboard/` y no son portables.

## Desvío conocido

La casilla `compacta` mide 24×18 / 28×20px para que las 184 entren en
pantalla: por debajo del mínimo táctil de 44×44. En mobile se usa `tactil`
(44×36).
