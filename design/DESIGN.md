# Prius App — Sistema de diseño

Fuente de verdad del diseño. Referencia visual: design/reference/. Ante una duda, primero este archivo, después la referencia.

Excepciones que no siguen este sistema: el mapa del plano en desktop/tablet (idéntico, salvo la tipografía), las vistas de impresión A4 (plano para carperos, caja, comprobantes) y los colores de estado del plano.

## Paleta

Blanco #FFFFFF (sidebar, cards), negro #000000 (texto principal, botones primarios, badges), gris #E5E5E5 (bordes de tablas, estados inactivos), dorado de marca #F2CA50 (acento protagonista).

Escala dorada: 50 #FEFBF3, 100 #FDF5E0, 200 #FAEBBC, 300 #F7DF96, 400 #F5D573, 500 #F2CA50.

Fondo del área principal #F8F7F2. Superficie sutil (círculos de íconos, item activo del nav, fondo de segmented controls, inputs) #F2F1EC. Texto secundario #6B6B6B.

Donde la referencia usa lima → dorado. Donde usa lavanda → escala de negros/grises (#000, #3D3D3D, #8A8A8A, #E5E5E5). Donde usa menta → dorado 100.

Verde solo para éxito/positivo en montos y alertas (↑, cobrado), rojo solo para error/deuda.

Contraste: #6B6B6B cumple AA sobre blanco, #F8F7F2, #F2F1EC y dorado 50/100, pero no sobre dorado 200-500. En esos fondos (card hero) el texto va siempre en negro. El dorado sobre blanco da 1,57:1: nunca se usa como color de texto sobre fondo claro, solo sobre negro.

## Estados

Un mismo estado tiene el mismo color en toda la app. Única fuente: COLOR_ESTADO en src/lib/colors.ts, con los colores de la leyenda del plano.

Pagado: negro con texto blanco. Pago parcial y Sin pago: dorado #F2CA50 con texto negro (se distinguen por texto). Sin confirmar: blanco con borde y reloj de arena. Preconfirmada: blanco con borde y reloj. Bonificada y Vencida: neutras.

Tipos de alquiler (Temporada, Período, Día): COLOR_TIPO_ALQUILER en el mismo archivo.

Leyenda del Plano: los nombres salen de `COLOR_ESTADO`: negro = Pagada (ocupada, pagada al 100%), dorado = Con saldo (ocupada, saldo pendiente). Nunca dos ítems con el mismo nombre.

## Tipografía

Manrope (self-hosted con @fontsource-variable/manrope), en toda la app.

Saludo del Dashboard 28px peso 400 en desktop (24px en mobile), tracking -0.02em. Título de página del topbar 24px peso 400 en desktop y 20px en mobile (`text-topbar`), tracking -0.02em. Título de card 20-22px peso 500. KPI grande 56-64px peso 400, tracking -0.03em. Body 14-15px peso 500. Labels y metadatos 13px peso 500 en #6B6B6B.

Todas las cifras con tabular-nums. Formato es-AR de moneda.

Monto protagonista de una card compacta (Caja diaria del sidebar): `text-amount`, 24px peso 500. Excepción: el código de reserva se escribe y se lee carácter por carácter, así que en Recepción va en monoespaciada (`font-mono`, solo dentro de `components/recepcion/`; el audit lo permite ahí y en ningún otro lado).

## Forma

Cards radius 24px, sin borde, sin sombra (o como máximo 0 1px 2px rgba(0,0,0,.03)), separadas del fondo por contraste. Elementos internos radius 16px. Items de nav radius 14px. Botones, badges y segmented controls en pill (radius full). Íconos de lista en cuadrado radius 12px. Swatches de leyenda radius 6px.

Padding de card, gap de grilla y padding de página: ver "Espaciado".

## Espaciado

Escala de 4px. Los valores salen de tokens (`tailwind.config.js` + variables en `src/index.css`), no de números sueltos: `p-page`, `gap-grid`, `p-card`, `p-hero`, `p-inner`, `mt-section`.

Padding de página (`px-page`): 16px mobile (<768), 24px tablet (768-1023), 32px desktop (≥1024). Desde 1920px el contenido queda en `max-w-page` (1680px) centrado: topbar y main usan la clase `px-page-max`, así alinean.

Gap entre cards (`gap-grid`, `space-y-grid`): 12px mobile, 16px tablet, 20px desktop.

Padding de card (`card-pad`): 16px mobile, 20px tablet, 24px desktop. Hero (`card-pad-hero`): 20px mobile, 28px desde tablet. Estados vacíos suman `py-10`.

Card dentro de card (`card-inner`): 16px y fondo `surface`, nunca otra card blanca ni doble padding grande. Las listas dentro de una ficha son `card-inner`; las filas dentro de un `card-inner` van en blanco.

Etiqueta de sección (`section-label`): 13px `ink-2`, 8px sobre su contenido, alineada en x con el contenido de la card; 24px (`mt-section`, `gap-section`) entre secciones.

Prohibido: valores arbitrarios de espacio (`p-[13px]`, `mt-[22px]`), medios pasos fuera de escala (`p-2.5`, `gap-1.5`) y padding propio en una `card-surface`. Excepción: `max(…, env(safe-area-inset-*))`. Lo vigila `pnpm audit:design`. Excepción documentada: la franja de controles del Plano y su chrome denso (`data-card-compacta`, PlanoStatsBar, PlanoLeyenda) conservan su padding y medios pasos para no achicar el mapa, cuyo tamaño fijan los snapshots de `test:visual`.

Listas y filas: 64-72px de alto, avatar 40px, nombre 15px/500 (`text-row`), divisores `divider` dentro de UNA card; la fila seleccionada va en `gold-50` con indicador dorado a la izquierda. Tablas de pagos: filas de 44px, montos a la derecha con cifras tabulares. Listas con scroll propio: `scroll-fino` (scrollbar fina con su lugar reservado) para que la barra no quede entre la lista y el panel.

## Componentes

Botón primario = pill negra h-11, texto blanco, ícono a la izquierda. Botón secundario (`btn-secondary`) = pill blanca con borde `line`. Botones de ícono = ghost circulares de 44px.

Un solo botón primario negro visible por vista. En desktop ya lo ocupa "+ Nueva reserva" del topbar, así que toda acción de página (Nuevo Cliente, Registrar pago, Imprimir, Guardar, Abrir caja, Check-in) es secundaria. El primario solo se repite dentro de un modal o sheet, porque ese overlay es la vista (confirmar, guardar), y en pantallas sin topbar (Login, Cambiar contraseña).

Segmented control = opciones en texto, la activa en pill negra con texto blanco. Badge de variación = pill negra con flecha y valor (ej: ↑ 78,5%). Badge contador = círculo negro 22px con número blanco (ej: Leads).

Íconos lucide stroke 1.5, 20px; en accesos rápidos dentro de un círculo de 44px #F2F1EC con label debajo.

Inputs h-12, radius 16px, fondo #F2F1EC, sin borde visible, focus ring 2px dorado. Sobre el fondo de página (búsqueda del topbar) el campo va en pill blanca.

Tablas dentro de card: sin líneas verticales, filas de 56px separadas por 1px #F0EFEA, hover #FAF9F5, header en 13px #6B6B6B.

Modales: radius 24px, fondo blanco, padding 32px, overlay negro 30% + backdrop-blur-sm, título 24px peso 500, footer con pill negra primaria + ghost cancelar. En mobile los modales pasan a bottom sheet con radius 24px arriba.

Toasts, dropdowns, popovers, date pickers y tooltips: mismo lenguaje (radius 16px, blanco, tooltip negro con texto blanco). Los flotantes blancos llevan borde #E5E5E5 para separarse de lo que tienen atrás.

Emojis de unidad: carpa 🏠 y sombrilla 🏖️, una sola constante en `src/lib/unidadIcono.js`; cabina y locker no llevan. El emoji mide 1em (el tamaño del texto que lo acompaña) y va con `UnidadLabel` o `unidadConEmoji`. No se usan íconos lineales de lucide para unidades; en el comprobante el emoji va en escala de grises y ocupa el mismo recuadro de 13px que el ícono que reemplaza, para no mover el resto del documento.

Difuminado de scroll (`ScrollFade`, componente único): todo contenedor con scroll interno se desvanece en el borde donde queda contenido oculto (`mask-image` con gradiente de 24px) y una capa de `backdrop-blur` suave (3px) lo acompaña. Solo existe en la dirección con contenido oculto y desaparece al llegar al final. Se aplica a fichas, listas de Clientes y Reservas, Historial, sheets, modales y popovers; las tablas con encabezado sticky solo lo llevan abajo. Cada capa mide 24px y se monta solo mientras hace falta (el blur se había sacado de la app por rendimiento: no usar `backdrop-filter` en otro lado).

Tiles de filtro (Plano): `bg-surface`, radius 16px, dos líneas (etiqueta 13px gris, valor 14px). Activo: `gold-50` con aro `gold` e indicador dorado de 4px a la izquierda, igual que la fila seleccionada de las listas.


## Superficie grafito

Una sola superficie de énfasis, solo para el botón "+ Nueva reserva" del topbar y la card de Caja diaria (sidebar en desktop, card del Dashboard en mobile y tablet), espejadas con el mismo estilo. Token en `tailwind.config.js` (`bg-grafito`, `shadow-grafito`) y clase `.superficie-grafito` / `.btn-grafito` en `index.css`; no se usa en ningún otro lado. El resto de los primarios sigue en negro plano y el "+" dorado de la bottom nav no cambia.

Fondo `linear-gradient(135deg, #2A2A28 0%, #3A3936 55%, #55524C 100%)`; highlight interior de 1px arriba `rgba(255,255,255,.08)`; sombra `0 10px 24px -12px rgba(0,0,0,.35)`. Texto blanco, secundarios en `on-ink/60` (el peor punto, el borde claro del degradé, da 4,8:1; AA). Hover: una capa blanca al 6% se funde en 200ms (un degradé no se anima); active: `scale(.98)`; sin transiciones con `prefers-reduced-motion`.

Botón: pill del alto de siempre (h-11), ícono + y texto blancos. Card: radio 24px, sin patrón de olas, monto blanco del tamaño actual, "Abierta · total del día" en secundario, ojito y "Abrir" dorado como estaban. El modo privacidad sigue mandando: el monto sale `$ ••••••` sobre el grafito.

## Gráficos

Línea negra 1.75px con relleno degradé dorado 300 → transparente, tooltip en pill negra, guía vertical punteada, punto negro con anillo blanco.

Barras segmentadas horizontales con segmentos redondeados de 8px, 4px de gap, alto 36px, con leyenda de swatches + nombre + valor + porcentaje grande a la derecha.

## Card hero

La "My Portfolio" de la referencia: degradé 135° de #FEFBF3 a #FAEBBC a #F5D573, más un patrón SVG de olas al 5% de opacidad abajo a la derecha.

## Identidad Prius

Componentes SVG inline livianos en src/components/brand/ (olas de líneas finas, rayas diagonales tipo sombrilla, curvas topográficas), opacidad 3-8%, usados con criterio en hero, card de clima, card de capacidad y tarjeta del sidebar.

No copiar logo, ilustraciones 3D ni assets de la referencia; usar el logo real de Prius.

## Animaciones

Todo en CSS. Motion se midió y quedó afuera: suma 30,3 KB gzip con domAnimation y 45,4 KB con domMax, y el tope acordado era +25 KB.

Entrada de cards fade + subida 8px en escalonado de 40ms, 300ms, ease [0.22,1,0.36,1]. KPIs con count-up de 800ms. Barras y segmentos que crecen desde 0. Trazo del gráfico que se dibuja. Modales scale .96→1 + fade 200ms. Indicador del item activo del nav que se desliza. Hover de cards clicables: translateY(-2px).

Solo transform/opacity. Respetar prefers-reduced-motion.

## Layout

Sidebar blanco: logo Prius arriba, grupos "Gestión operativa" y "Módulos adicionales" con label chico gris, items con ícono outline, el activo con fondo #F2F1EC. Badge de Leads en círculo negro. Abajo, tarjeta negra radius 24px con patrón de olas dorado al 8% que muestra el estado real de la Caja diaria (sin iniciar → botón pill dorado "Abrir"; abierta → total del día). Debajo, avatar + nombre + rol + cerrar sesión.

Tarjeta de Caja diaria (sidebar y card de mobile/tablet): monto de 24px y, a su derecha, un ojito de 44px (Eye/EyeOff) que oculta el monto ("$ ••••••") como una billetera virtual; la preferencia se recuerda por usuario. Con la caja sin iniciar no hay monto ni ojito.

Footer global: pegado al borde inferior del viewport salvo que el contenido lo empuje (columna `h-dvh`, contenido `flex-1`, footer `mt-auto`), en todos los anchos; en mobile queda sobre la bottom nav. Reservas y Clientes desde 1024px lo ocultan porque sus cajas llenan el viewport.

Desglose por medio de pago (Caja): una fila por medio, ícono a la izquierda, etiqueta corta arriba ("Crédito", "Débito"; el nombre completo queda en `title` y en la tabla) y el monto completo abajo, sin partir el "$" del número.

Plano: franja de controles en una card compacta (12px de padding, excepción documentada del chrome denso del Plano). Fila 1: navegador de fecha, segmented Todo/Carpas/Sombrillas, botón "Referencias" (popover con la leyenda) e Imprimir A4 secundario. Fila 2: cuatro tiles que son los filtros de estado (Todas, Ocupadas con %, Libres con %, Pendientes del día con monto). Entre 768 y 1023px: fecha a ancho completo, tiles 2x2, segmented a ancho completo y Referencias/Imprimir en el encabezado de la card del mapa. En mobile (<768px): fecha corta que siempre entra ("Jue 06/11", con chip "Hoy" cuando corresponde, nunca truncada), los cuatro tiles compactos en una sola fila (la etiqueta pasa a "Pendientes"), segmented de tipo a ancho completo; en celular apaisado, los controles pasan a una columna a la izquierda. Card del mapa: inset de 12px en todos los lados; "Pasillo A · B · C" a la izquierda y la pill de unidades sincronizadas a la derecha; controles de zoom en columna debajo, alineados al mismo borde derecho que la pill, con 12px de separación. Ficha de unidad: padding de card en todos los lados, el scroll lleva `scrollbar-gutter: stable` y llega al borde inferior respetando el radio.

Toolbars sticky de desktop: viven en la zona sticky, junto a la topbar. Máximo 2 filas, alto total de 104 a 112px incluido el padding (40px de controles + 12px de gap + 40px, más 16px abajo), todos los controles de 40px (`toolbar-40`), gap de 12px y alineados a la grilla de la página. Los rangos de fechas son UN chip ("28/10 – 04/11", `RangoFechasChip`) que abre un popover con los dos selectores. Historial: fila 1 = buscador (flexible, máx. 360px; entre 768 y 1279px un ícono de 40px que se expande al click) · segmented Hoy / 7 días / Mes / Personalizado · chip de rango · usuarios; fila 2 = tabs de tipo en un segmented de una sola línea (`SegmentedScroll`: si no entran, scroll horizontal con snap y fade en los bordes, nunca dos líneas). Reservas, Clientes, Caja, Reportes, Leads y Comprobantes siguen el mismo criterio.

Listas con grupos (Historial): el encabezado de cada día ("Hoy · 13 eventos") es estático, en el flujo normal, arriba de su grupo y con 24px de margen superior entre grupos; nunca sticky ni con fondo blur. Los grupos se arman por día calendario de Buenos Aires (el instante `ts`, no `fecha_ref`). Panel de detalle del movimiento (desktop): sticky arriba a la derecha a zona + 16px del borde superior, alineado al tope de la lista, alto máximo = viewport − zona − 32px, scroll interno con difuminado y estado vacío centrado; en mobile es un bottom sheet.

Comprobantes: la página no scrollea nunca (vertical ni horizontal). La preview del comprobante oficial es una hoja (radio de 6px, sombra mínima de 1px sobre el canvas) escalada con `transform: scale` = min(ancho disponible / ancho del documento, alto disponible / alto del documento), medida con ResizeObserver; entra completa, con su proporción real, centrada. Desktop: preview a la izquierda, panel de 360px a la derecha ("Pagos registrados — recibo individual" con scroll interno difuminado, e Imprimir como botón secundario). Mobile: barra inferior con "Pagos (N)" (bottom sheet) e Imprimir en pill negra de 44px o más; tocar la preview abre un visor a pantalla completa con pinch zoom y arrastre (el zoom mínimo encuadra y centra). Marca de agua obligatoria en todo comprobante emitido: el logo real de Prius centrado, ~58% del ancho de la hoja, en grises (`brightness(.6)`) al 9% de opacidad, detrás del contenido, con `print-color-adjust: exact`, una por copia.

Plano mobile (<768px): la pantalla no scrollea; el mapa ocupa todo el alto disponible (100dvh menos topbar, controles y bottom nav), así el scroll de la página nunca compite con los gestos. Se monta `ZoomPanPinch` (components/ui) (el desktop y la tablet siguen con `PlanoViewport`, sin cambios): un dedo arrastra (el arrastre arranca a los 8px; por debajo es un tap y abre la ficha), pinch con zoom anclado al punto medio entre los dedos, doble tap acerca (la ficha de una unidad espera 260ms por si viene el segundo tap). Zoom mínimo = "encuadrar" (el mapa completo entra, centrado; nunca se achica más); máximo ~3x del encuadre (al menos 1,25). El arrastre está limitado para que el mapa no salga de la vista, con rebote suave en los bordes. Arranca encuadrado y centrado al abrir, al rotar y al cambiar un filtro. Todo con `translate3d`/`scale` en un solo wrapper, por refs y `requestAnimationFrame`, sin re-render por frame. Controles de zoom: una sola pill vertical (`PlanoZoomPill`) con botones de 40px y área táctil de 44px, ícono de 18px, a la derecha dentro del padding de la card. El footer global no se muestra en esta pantalla en mobile.

Reportes: la zona sticky trae los controles compactos. Segmented Diario / Semanal / Mensual / Anual a ancho completo (hasta lg); el rango de fechas es UN chip ("04/11/25 – 04/11/26") que abre un bottom sheet con los dos selectores (popover desde 768px); Pesos/Dólares como toggle chico (ARS | USD); WhatsApp, Descargar y Imprimir agrupados en un botón "Compartir" con menú, y como tres íconos desde 1024px. Arriba de todo, cuatro tiles de KPI (Ingresos, Egresos, Neto con margen, Ticket promedio con "Promedio diario / semanal / mensual / anual"): 2x2 en mobile y una fila de 4 desde 768px, con el monto compacto ($142,4M) hasta 1280px y completo desde ahí (el `title` siempre trae el completo). Debajo, proyección, evolución y medios de pago.

Recepción: columna izquierda con el hero "Escanear QR" (degradé dorado de marca con el patrón de olas, segmented Cámara/Lector), la card "Código de reserva" (prefijo PRIUS- fijo, botón de búsqueda circular negro), las stats Llegan hoy / Ingresados / Pendientes con barra segmentada y "Último escaneo"; columna derecha con la reserva cargada y la lista "Llegan hoy" (filtros Todos / Pendientes / Con saldo). Mobile: la cámara es la acción principal, en una sola columna.

Topbar: a la izquierda el título de página (en Dashboard "Hola, Baltasar" con la fecha chica debajo y el punto de "Operativo"). A la derecha: búsqueda en pill, pill negra "+ Nueva reserva", campana, avatar.

Zona sticky superior (`ProgressiveBlurHeader`, componente único): la topbar y la toolbar de la sección (filtros de Historial, tabs de Leads, controles de Reportes, buscador y filtros de Clientes y Reservas, fecha de Caja, selector de Comprobantes) forman UNA pieza que flota sobre el contenido; la página scrollea por debajo y nunca se ve contenido entre la topbar y la toolbar. Fondo: degradé de arriba hacia abajo desde `canvas` al 80% de opacidad hasta transparente (80% hasta el 30% del alto, después se apaga) más blur progresivo, fuerte arriba y cero en el borde inferior: cuatro capas de `backdrop-filter` (1,5 / 3 / 6 / 12px, con prefijo `-webkit-`), cada una con `mask-image` en degradé; en mobile tres (sin la de 1,5px). El fondo baja 20px más allá de la zona para que el blur se apague sin borde. Sin soporte de `backdrop-filter`, o con "reducir transparencia" del sistema, queda solo el degradé. Las toolbars entran por `<ToolbarSticky>` (un portal al slot de la zona); el alto real de la zona se mide en `AppLayout` y se publica como `--zona-h`, que usa el padding superior de la página (`pt-zona`), el `scroll-padding-top` y cualquier `sticky` interno (`top-[var(--zona-h)]`). Nunca `sticky top-0` propio en una página. Home: el saludo grande se compacta al título de 20px al scrollear (solo `transform` y `opacity`; el alto de la topbar no cambia).

Topbar en mobile: 56px más la safe area (8px de aire arriba, 44px de área táctil, 4px abajo), título de 20px, íconos de 22px, avatar de 36px. En desktop, 64px con el título de 24px.

Dashboard, fila 1: card hero "Cobranzas temporada" + card de accesos rápidos 3x2 (Reservar, Cobrar, Check-in, Buscar cliente, Plano, Leads). Fila 2: card "Condiciones marítimas" (datos de clima existentes, solo horario de playa 9 a 20 h) + card "Capacidad diaria" con barra segmentada. Debajo, "Últimos movimientos". En desktop la caja vive solo en la tarjeta del sidebar; en mobile y tablet aparece como card en el Dashboard.

Mobile: el sidebar pasa a bottom nav blanco de 5 items con el activo en pill negra; topbar compacto; cards a ancho completo; accesos rápidos 3x2; sensación de app nativa. El único botón de alta es el + de la bottom nav.

## Paneles y responsive

Un panel de detalle (ficha de Clientes, Reservas) decide su layout por SU ancho, no por el del viewport: contenedor `@container` y variantes `@[880px]:` (plugin `@tailwindcss/container-queries`). Historial al lado del detalle solo si el panel mide 880px o más; si mide menos, va debajo y todo scrollea junto. Los breakpoints de viewport (`md:`, `lg:`) quedan para el shell y la grilla de página. Cada columna con scroll propio sale de la cadena flex/grid con `min-h-0`, nunca de alturas calculadas a mano.

Mobile (<768px) como app nativa: topbar de 56px (más safe area) con título de 20px, dentro de la zona sticky flotante; bottom nav con `safe-area-inset-bottom` y contenido con padding inferior para que nunca lo tape; listas full-bleed (`-mx-page`) sin card dentro de card; tablas pasan a lista de cards; modales como bottom sheet de `max-h-[90dvh]` con scroll interno, footer sticky con safe-area y el campo enfocado siempre sobre el teclado (`useKeyboardInset`); `dvh`, nunca `vh`; touch targets de 44px o más; inputs de 16px; feedback de toque (`scale .98`), nada que dependa solo de hover.

### Checklist responsive

Se corre con `e2e/rebrand-responsive.spec.ts` (y `e2e/rebrand-overlays.spec.ts` para modales y sheets) en 360x640, 390x844, 430x932, 768x1024, 834x1194, 1024x768, 1180x820, 1280x800, 1366x768, 1440x900 y 1920x1080:

1. `document.scrollingElement.scrollWidth <= innerWidth`: cero scroll horizontal.
2. Ningún elemento visible desborda su card o modal.
3. Ningún monto ni nombre truncado sin `title` (los montos nunca se cortan).
4. La bottom nav no tapa contenido al final del scroll.
5. Mobile: touch targets ≥ 44px e inputs ≥ 16px.
6. Capturas en `design/rebrand-shots/` revisadas a ojo.
