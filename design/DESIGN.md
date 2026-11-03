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

## Tipografía

Manrope (self-hosted con @fontsource-variable/manrope), en toda la app.

Saludo del Dashboard 36-40px peso 400, tracking -0.02em. Título de página 28px peso 400, tracking -0.02em. Título de card 20-22px peso 500. KPI grande 56-64px peso 400, tracking -0.03em. Body 14-15px peso 500. Labels y metadatos 13px peso 500 en #6B6B6B.

Todas las cifras con tabular-nums. Formato es-AR de moneda.

## Forma

Cards radius 24px, sin borde, sin sombra (o como máximo 0 1px 2px rgba(0,0,0,.03)), separadas del fondo por contraste. Elementos internos radius 16px. Items de nav radius 14px. Botones, badges y segmented controls en pill (radius full). Íconos de lista en cuadrado radius 12px. Swatches de leyenda radius 6px.

Padding de card 28-32px desktop, 20px mobile. Gap de grilla 16-20px.

## Componentes

Botón primario = pill negra h-11, texto blanco, ícono a la izquierda. Botón secundario = ghost con ícono (estilo "+ Deposit"). Botones de ícono = ghost circulares.

Segmented control = opciones en texto, la activa en pill negra con texto blanco. Badge de variación = pill negra con flecha y valor (ej: ↑ 78,5%). Badge contador = círculo negro 22px con número blanco (ej: Leads).

Íconos lucide stroke 1.5, 20px; en accesos rápidos dentro de un círculo de 44px #F2F1EC con label debajo.

Inputs h-12, radius 16px, fondo #F2F1EC, sin borde visible, focus ring 2px dorado. Sobre el fondo de página (búsqueda del topbar) el campo va en pill blanca.

Tablas dentro de card: sin líneas verticales, filas de 56px separadas por 1px #F0EFEA, hover #FAF9F5, header en 13px #6B6B6B.

Modales: radius 24px, fondo blanco, padding 32px, overlay negro 30% + backdrop-blur-sm, título 24px peso 500, footer con pill negra primaria + ghost cancelar. En mobile los modales pasan a bottom sheet con radius 24px arriba.

Toasts, dropdowns, popovers, date pickers y tooltips: mismo lenguaje (radius 16px, blanco, tooltip negro con texto blanco). Los flotantes blancos llevan borde #E5E5E5 para separarse de lo que tienen atrás.

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

Topbar: a la izquierda el título de página (en Dashboard "Hola, Baltasar" con la fecha chica debajo y el punto de "Operativo"). A la derecha: búsqueda en pill, pill negra "+ Nueva reserva", campana, avatar.

Dashboard, fila 1: card hero "Cobranzas temporada" + card de accesos rápidos 3x2 (Reservar, Cobrar, Check-in, Buscar cliente, Plano, Leads). Fila 2: card "Condiciones marítimas" (datos de clima existentes, solo horario de playa 9 a 20 h) + card "Capacidad diaria" con barra segmentada. Debajo, "Últimos movimientos". En desktop la caja vive solo en la tarjeta del sidebar; en mobile y tablet aparece como card en el Dashboard.

Mobile: el sidebar pasa a bottom nav blanco de 5 items con el activo en pill negra; topbar compacto; cards a ancho completo; accesos rápidos 3x2; sensación de app nativa. El único botón de alta es el + de la bottom nav.
