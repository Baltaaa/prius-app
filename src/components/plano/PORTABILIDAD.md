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
    El zoom lo maneja `usePlanoEncuadre()`: se pasa como `encuadre` o, si no
    se pasa, el marco usa uno propio.
  - `variante="compacta"` (<768px): fila con `selectorFecha` + chips (scroll
    horizontal con snap), el mapa en `ZoomPanPinch` y una pill flotante con
    +, −, Encuadrar, Rotar y cerrar (`onCerrar`).
  - Props: `tipo` (null | 'carpas' | 'sombrillas') + `onTipo`, `emojiCarpa` /
    `emojiSombrilla` (en el CRM salen de `lib/unidadIcono.js`: 🏠 y 🏖️),
    `rotado` + `onRotar`, `cargando`, `resetKey` (compacta: re-encuadra al
    cambiar), `slideRef` + `onAnimationEnd` (animación al cambiar de fecha).
  - Flujo de reserva (Fase 6A.1): ver "El marco en los 6 pasos" abajo.
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
  - `onClick(numero, evento)` solo se llama en una casilla seleccionable; el
    evento trae `clientX`/`clientY` del toque. `etiqueta`
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

## El marco en los 6 pasos (Fase 6A.1, nov 2026)

`MarcoPlanoClaro` es el marco de TODO el flujo de reserva de la landing, no
solo del Paso 3: reemplaza a `MarcoReserva` (provisorio de beachFlow, Fase
6B), que se borra. Todas estas props son opcionales; sin ellas el marco
dibuja exactamente lo de la 6A (el modal del CRM no usa ninguna).

Header:
- `selectorPersonas`: slot después de `selectorFecha` (la pill de personas).
- `chipsDeshabilitados`: chips visibles pero sin click y al 50% (pasos sin
  mapa).
- `onRefrescar` + `refrescando` + `tituloRefrescar` (default "Actualizar
  disponibilidad"): botón ↻ redondo de 44px; con `refrescando` el ícono gira
  y el botón queda deshabilitado. En amplia va a la derecha, antes de la X;
  en compacta, al final de la fila.
- `onCerrar` / `tituloCerrar`: en amplia es la X del header; en compacta es
  el botón de cerrar de la pill del mapa. Si en mobile la X va en la barra
  del paso, no pasar `onCerrar` en compacta.

Entre el header y el cuerpo:
- `barra`: slot libre ("Paso X de 6 · nombre" + progreso). Lo dibuja quien
  lo usa; el marco no sabe de pasos.

Cuerpo:
- `cuerpo="mapa"` (default): children = `<PlanoClaro/>`, con zoom, rótulo
  de pasillos y controles, como siempre.
- `cuerpo="libre"`: children = cualquier contenido. Card `flex-1` con scroll
  interno (`overflow-y-auto`, `overscroll-contain`); la página y el header no
  se mueven. El ancho del contenido (ej. 640px centrado) lo pone quien lo usa.
- `claseCuerpo`: clases extra para la card del cuerpo en los dos modos (ej.
  `border border-[#EDEDED]` si la hoja es blanca: la card es blanca también).
- `aviso`: slot dentro de la card del cuerpo (`relative`), en los dos modos;
  lo posiciona quien lo pasa (ej. `absolute top-3 left-1/2 -translate-x-1/2`).

Pie:
- `pie`: contenido del footer fijo (64px, borde superior), debajo del cuerpo.
- `pieRef`: ref o callback ref del nodo del footer, para que cada paso dibuje
  sus botones ahí por portal (el `PiePaso` de beachFlow). Con `pie` o
  `pieRef` el footer existe; sin ninguno de los dos, no.

Zoom desde afuera (para "el primer toque acerca", que vive en la landing):
- `mapaRef`: `{ acercar(), alejar(), encuadrar(), acercarEn(clientX,
  clientY, factor = 1.8), estado() }`, igual en las dos variantes.
  `estado()` = `{ escala, escalaEncuadre, escalaMax, x, y }`.
- `onCambioZoom(estado)`: mismo objeto, cuando el zoom se asienta (amplia:
  en cada cambio; compacta: 120ms después del último frame, nunca por frame).

Ejemplo del primer toque (en la landing, NO en esta carpeta). Alto de la
casilla a escala 1: `compacta` 20px (md) y `tactil` 36px:

```jsx
const mapa = useRef(null)
const tocar = (slot, evento) => {
  const { escala } = mapa.current.estado()
  if ((amplia ? 20 : 36) * escala < 44 && evento) {
    mapa.current.acercarEn(evento.clientX, evento.clientY)
    return // mostrar "Tocá de nuevo para elegir" con `aviso`
  }
  elegir(slot)
}
<MarcoPlanoClaro mapaRef={mapa} cuerpo={paso === 3 ? "mapa" : "libre"} barra={<BarraPaso/>} pieRef={setNodoPie} ...>
  {paso === 3 ? <PlanoClaro renderCelda={(slot) => <CeldaClara onClick={(_, ev) => tocar(slot, ev)} .../>} /> : <Paso4 />}
</MarcoPlanoClaro>
```

Probado con clicks reales en el CRM: `/app/dev/marco-reserva` (solo
superadmin) y `e2e/plano-marco-reserva.spec.ts` (1440 y 390 táctil).

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
- `usePlanoEncuadre.js` — el estado de ese zoom (desktop/tablet), con
  `acercarEn` y `fitScale`.
- `ZoomPanPinch.jsx` — mapa táctil mobile con gestos propios (arrastre con
  umbral, pinch anclado, doble tap, rebote) y API imperativa
  (`acercar`/`alejar`/`encuadrar`/`acercarEn`/`estado`) y `onCambio`.
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
