# Auditoría mobile — Fase 0 (oct 2026)

## Fase 1 (oct 2026) — arreglos transversales, ya resueltos

Arreglos solo visuales/de interacción en el shell y componentes compartidos (sin tocar lógica de negocio, queries, hooks de datos ni routing). Los bloqueantes propios de cada pantalla (Clientes, Notificaciones, Leads, Historial, Comprobantes, Plano/Ocupación) siguen pendientes, quedan para la fase de pantallas (Fase 4).

Antes/después de correr `e2e/auditoria-mobile.spec.ts` en mobile-360 y mobile-390 (suma de las 20 pantallas/estados × 2 tamaños = 40 filas):
- Objetivos táctiles bajo 44×44px: 1712 → 1132.
- Texto bajo 12px: 3170 → 2285.
- Inputs con riesgo de zoom iOS (font-size <16px o sin `inputMode` esperado): 53 → 4 (los 4 restantes son falsos positivos del propio chequeo: el buscador global de Clientes/RegistrarPago menciona "DNI"/"CUIT" en el placeholder y mi heurística los confunde con un input numérico — el campo ya está en 16px y con `inputMode="search"`, correcto para un buscador de texto libre).
- Chunk `Recepcion-*.js`: 352 KB / 105 KB gzip → 15.8 KB / 5 KB gzip (el peso de `html5-qrcode`, 101 KB gzip, pasó a su propio chunk `EscanearQR-*.js`, cargado recién al abrir la cámara).

Resuelto:
1. **Inputs a 16px en mobile** (`text-base md:text-sm`) en los 6 componentes nombrados (`MoneyInput`, `DateInput`, `DniInput`, `CuitInput`, `IntegerInput`, `PhoneInput`) + `SearchInput`, `TextInput`, `BrandSelect`, y los `inputClass` locales de `RegistrarPago`, `DetallePago`, `DetalleGasto`, `Clientes`, `Caja`, `Recepcion.jsx`, `ConfirmDeleteModal`, `ClienteSelector`.
2. **Título del TopBar truncado**: cada sección suma un `shortName` para <768px (`SECTION_TITLES` en `TopBar.jsx`), el bloque del título pasa a `flex-1 min-w-0` sin el `shrink-0` que generaba el truncado agresivo. "Directo…"/"Notifica…"/"Plano d…" ya no pasan.
3. **`ScrollToTopButton` solo desktop** (`hidden md:flex`) — en mobile, tocar en el BottomNav la pestaña ya activa scrollea suave al principio de `#app-main-scroll` (patrón nativo iOS/Android), sin un botón flotante que tape contenido.
4. **`h-dvh` en vez de `h-screen`** en `AppLayout.jsx` y `Sidebar.jsx`, con fallback a `100vh` vía `@supports not (height: 100dvh)` en `index.css` (Tailwind v3 no trae la unidad nativa). Cambió el alto real disponible en la emulación mobile de Playwright, por lo que se actualizaron las capturas de referencia de `test:visual` (ver diffs revisados antes de actualizar — el único cambio real fue el alto, no el contenido).
5. **Sensación nativa**: `-webkit-tap-highlight-color: transparent`, `overscroll-behavior-y: none` en html/body (los contenedores internos con scroll propio siguen rebotando normal), `touch-action: manipulation` en botones/links (sin tocar el `touch-action: none` propio de `PlanoViewport.jsx`), `-webkit-text-size-adjust: 100%`.
6. **Objetivos táctiles de navegación a 44×44 mínimo**: botones de notificaciones/perfil del TopBar, botón de calendario + navegación de mes de `DateInput.tsx` (react-day-picker) y `ReservaCalendar.jsx`, paginadores "Día anterior/siguiente" del Plano y "Anterior/Siguiente" de Ocupación, botón de limpiar de `SearchInput`.
7. **`html5-qrcode` lazy**: `EscanearQR` pasa a `React.lazy()` + `Suspense` en `Recepcion.jsx`, montado solo cuando se abre el escáner (fallback "Abriendo cámara…"). El ingreso manual del código no espera nada de esto.
8. **Tipografía de 8-10px a mínimo 11px**, acotado a componentes compartidos: `KpiCard`, `StatusBadge`, `BottomNav` (labels de pestañas y badges — estos últimos, pills circulares de 14-16px, quedaron en 10px por el espacio físico disponible, no llegan a 11px completo), `TopBar` (labels de resultados de búsqueda/notificaciones/perfil), y las labels de los 8 componentes de `src/components/inputs/`. Las páginas (Reservas.jsx, Clientes.jsx, UnidadPreviewModal.jsx, Ocupacion.jsx — los archivos con más ocurrencias) quedan para la Fase 4, como estaba previsto.

Pendiente / observado durante la verificación de Fase 1, sin tocar en esta fase:
- `e2e/plano-publico-visual.spec.ts` ("mapa con candados reales") quedó flaky en mobile-360/390 tras actualizar snapshots — el diff muestra el texto "Cargando disponibilidad…" en vez del mapa cargado, una carrera preexistente entre el RPC `disponibilidad_publica` y el `waitForTimeout(400)` fijo del spec, sin relación con `h-dvh` ni con esta fase (no se tocó ese spec ni `PlanoPublicoPreview.jsx`).
- Un único falso positivo de "tapado por BottomNav" apareció en `Notificaciones` (mobile-390) en la corrida posterior a Fase 1, ausente en la corrida base y no reproducible en el resto de las pantallas — la captura de esa corrida muestra el feed todavía con el fade-in escalonado en curso (37 notificaciones urgentes), consistente con una medición tomada a mitad de esa animación más que con un solapamiento real.

## Fase 0 (oct 2026) — auditoría original

Barrido automatizado con Playwright (`e2e/auditoria-mobile.spec.ts`) sobre las 14 rutas de `/app` y 7 estados de overlay (menú "Más", búsqueda mobile, UnidadPreviewModal, ficha de cliente expandida, modal "Nueva reserva", RegistrarPago con el date picker abierto, CerrarCajaStepper), en los dos tamaños de referencia 360×780 y 390×844. No se tocó ningún dato real: todo se abrió y se cerró sin guardar. Las capturas full-page quedaron en `test-results/auditoria-mobile/` (no se commitean). El estándar contra el que se mide es el de CLAUDE.md "Mobile-first": tiene que sentirse app nativa, no web achicada.

Antes de leer los hallazgos por pantalla, dos aclaraciones sobre el método:

- El chequeo de "tapado por el BottomNav" terminó usando un hit-test real (`document.elementFromPoint` en el centro de cada botón, después de scrollear todo contenedor con scroll propio hasta el fondo) en vez de solo comparar coordenadas. La primera versión, más ingenua, marcaba como "tapados" los footers sticky de los modales (Cancelar/Crear reserva, Confirmar Pago) y el botón Cerrar Sesión del menú "Más" — pero esos elementos están, a propósito, en una capa con z-index por encima del BottomNav (son bottom sheets de altura completa, ver CLAUDE.md "Modales → bottom sheet"), así que tocarlos funciona bien aunque sus rectángulos se solapen en el DOM. Con el hit-test real, la lista de tapados de verdad quedó en cero en las 20 pantallas/estados auditados en ambos tamaños — **no hay ningún elemento real tapado por el BottomNav hoy**.
- El click automatizado sobre la primera celda del Plano (para abrir `UnidadPreviewModal`) dio un resultado ambiguo: el screenshot resultante es distinto al de la ruta `/app/plano` sola, pero visualmente no se distingue un modal abierto. Puede ser que el modal sí haya abierto pero con el bottom sheet recortado fuera del área capturada, o que el click haya caído en el borde de la celda sin disparar el `onClick`. Ese estado puntual queda **sin verificar con certeza** — conviene repetirlo a mano en un dispositivo real antes de planificar arreglos sobre `UnidadPreviewModal.jsx`.
- Los números de "objetivos táctiles chicos" de Plano y Ocupación en la primera carga de la ruta (6 y 153 respectivamente) no son comparables entre sí: Plano se midió apenas 400ms después de que desaparece el GlobalLoader, mientras las ~184 celdas todavía estaban terminando de pintar tras el fetch inicial de unidades/reservas. En los estados de overlay, donde se esperó más antes de medir, Plano también sube a 194 — ese es el número real. Para repetir esta auditoría conviene esperar más tiempo (o esperar una señal de "datos cargados") antes de medir en rutas con grillas grandes.
- `Caja — CerrarCajaStepper` no se pudo probar: no había una caja abierta en la cuenta de prueba al momento del barrido, y abrir una caja real no entra dentro de "abrir y cerrar sin guardar". Queda pendiente de una corrida dedicada.
- La búsqueda mobile del TopBar se midió vacía (sin escribir ningún término), así que su estado con resultados reales no quedó cubierto.

No se encontró scroll horizontal de página en ninguna de las 20 pantallas/estados — `document.scrollingElement.scrollWidth` nunca superó `innerWidth`. Esto no contradice el recorte de íconos que ya reportaba CLAUDE.md en Clientes: ese recorte es contra el borde de un contenedor con overflow oculto, no un desborde de la página entera, así que no dispara scroll — pero sigue siendo un problema real, confirmado de nuevo en este barrido (ver "Clientes" abajo).

## Home

Sin hallazgos propios más allá de los transversales (ver esa sección al final): el ícono de búsqueda/perfil del TopBar queda chico, igual que en todas las pantallas. Nada bloqueante.

## Plano

Molesto, de pantalla — `src/components/dashboard/PlanoStatsBar.jsx`: la fila de tres tarjetas de estadística (Ocupación / Carpas / Sombrillas) no entra en 360 ni en 390px. La tercera tarjeta ("Sombrillas") queda cortada contra el borde derecho, mostrando solo "SO" y "75%" sin el label completo — la información existe pero se pierde en silencio, sin scroll propio que la revele.

Molesto, por diseño — `src/components/dashboard/Cell.jsx`: cada celda de carpa/sombrilla mide 24×18px en la vista fit-to-container por defecto (incluso menos, 8×6px, se midió en algún estado con zoom aplicado), muy por debajo del mínimo táctil de 44px. Es la experiencia esperada según CLAUDE.md (hay que hacer zoom con el botón "+" o pinch antes de tocar una celda individual), pero vale la pena confirmar que el gesto de zoom se descubre solo — si no, cada toque en el plano sin zoom previo va a fallar seguido.

Molesto, del shell compartido — paginador "Día anterior/Día siguiente" (38×38px) y el botón "–" de zoom quedan cerca pero por debajo de 44px. Mismo patrón se repite en Ocupación y Caja (ver abajo), así que es un solo componente de paginación a ajustar una vez.

Cosmético — el input de fecha (`dd/mm/aaaa`) corre a 14px de font-size, por debajo del umbral de 16px que evita el auto-zoom de iOS Safari (ver "Problemas transversales").

## Cabinas y Lockers

Sin hallazgos accionables: el único texto en 8px es la etiqueta "Ejemplo" de las tarjetas de muestra, que CLAUDE.md marca a propósito como la única pantalla con datos de ejemplo (sección en desarrollo, solo lectura). Cosmético, no aplica arreglarlo ahora.

## Recepción

Cosmético, de pantalla — `src/pages/Recepcion.jsx`: el input de código ("Ej: PRIUS-A3X9K2") corre a 14px sin `inputMode` definido. No se reprodujo el problema del barrido anterior (CLAUDE.md "Pendiente" mencionaba que había quedado atascada en "Verificando credenciales" al fotografiar) — esta vez cargó bien en ambos tamaños.

## Reservas

Cosmético, del shell compartido — buscador y los campos "Llegada desde"/"Llegada hasta" en 14px.

Dentro del modal "Nueva reserva" (`src/pages/crm/Reservas.jsx`, `src/components/crm/ReservaCalendar.jsx`): la navegación de mes del calendario (28×28px) queda por debajo de 44px, igual que en el date picker de RegistrarPago (ver abajo) — mismo componente de calendario compartido, un solo arreglo cubre los dos lugares. El footer sticky "Cancelar"/"Crear reserva" se confirmó correctamente por encima del BottomNav (no es un bug, pese a que sus coordenadas se solapan en el DOM).

## Clientes

Bloqueante, de pantalla — `src/pages/crm/Clientes.jsx` (panel expandido de la ficha): con un email largo, el valor se superpone visualmente con la columna CUIT de al lado — confirmado en captura (`mobile-360__ficha-cliente.png`), el grid de 2 columnas no trunca ni envuelve el texto del email antes de invadir la columna vecina.

Bloqueante parcial, del shell compartido — `src/components/crm/ScrollToTopButton.jsx`: el botón flotante naranja se superpone, a diferencia del BottomNav, por encima de contenido clickeable real — en la captura tapa los íconos de acción (editar/eliminar) de la tarjeta de cliente de más abajo y, en la ficha expandida, los botones "Comprobante"/"Confirmar temporada". A diferencia del caso del BottomNav, acá el hit-test confirmó que SÍ gana por z-index sobre esos botones reales.

Molesto, de pantalla, ya reportado antes — íconos de acción de la fila colapsada (billetera/comprobante/editar/eliminar) se cortan contra el borde derecho en 360 y 390px. Mismo hallazgo que ya constaba en CLAUDE.md "Pendiente" (barrido mobile anterior), confirmado de nuevo con capturas nuevas.

Molesto — "Comprobante" y "Confirmar temporada" son botones de texto de 16px de alto, debajo del mínimo táctil, mismo patrón que se repite en Notificaciones y Leads (ver "Problemas transversales").

Cosmético — buscador en 14px.

## Caja

No verificado — `CerrarCajaStepper` no se pudo abrir (caja cerrada en el momento del barrido), queda pendiente de una corrida con caja abierta.

Cosmético — inputs de fecha y monto en 14px.

## Reportes

Sin hallazgos propios: la tabla de escritorio (`<table>` en `src/pages/crm/Reportes.jsx`) ya tiene su versión de tarjetas para mobile, correctamente alternada con `sm:hidden`/`hidden sm:block`. Mismo patrón correcto en `DataTable.jsx` (usado por Reservas y Home) — no se encontraron tablas "desnudas" sin alternativa mobile en toda la app.

## Ocupación

Molesto, por diseño — igual que el Plano, 153 elementos bajo 44px: es inherente a mostrar un Gantt/heatmap de ~184 unidades en una pantalla de 360px. Los chips de filtro "Carpa"/"Sombrilla"/"Todas" (61×26px) y el paginador "Anterior/Siguiente" (38×38px) rozan el mínimo sin alcanzarlo — mismo componente de paginación que Plano/Caja.

Cosmético — input de fecha en 14px.

## Historial

Molesto, de pantalla — `src/pages/crm/Actividad.jsx` (componente real detrás de la ruta `/app/historial`): los chips de filtro ("Caja", "Todo", "Anulaciones", "Notas") miden entre 36 y 61px de alto, por debajo de 44px — el ancho sobra, falta nada más que padding vertical.

Cosmético — dos inputs de fecha y el buscador, todos en 14px.

## Notificaciones

Bloqueante liviano, de pantalla — `src/pages/crm/Notificaciones.jsx`: las acciones de cada notificación ("Registrar pago", "Ir a Caja", "Ver reserva") son botones de texto de apenas 15px de alto — muy por debajo del mínimo táctil, y son la única acción primaria de cada tarjeta urgente. En la cuenta de prueba había 37 notificaciones urgentes simultáneas (saldos pendientes), así que el riesgo real de tocar mal es alto. Mismo patrón de "botón de texto chico como única acción" que en Clientes y Leads — candidato fuerte a un componente compartido con altura mínima 44px.

## Leads

Molesto, de pantalla — `src/pages/crm/Leads.jsx`: los links de email (ej. "tibaldid@hotmail.com") son el único punto de contacto clickeable de cada lead y miden 16px de alto. Mismo patrón que Notificaciones/Clientes.

## Comprobantes

Cosmético — los botones "B y N"/"Color" del selector de modo (57×35 / 66×35px) quedan por debajo de 44px de alto. El texto de pie del comprobante ("Emitido 11/10/2026...") corre a 8.6px — es parte del documento real pensado para impresión en papel, conviene confirmar si ese tamaño también se usa en la vista previa en pantalla o si debería ser mayor ahí.

## Perfil

Cosmético — inputs de tarifa en 14px, sin otros hallazgos propios.

## BottomNav — menú "Más"

Sin hallazgos propios: el sheet cubre correctamente todo el ancho y alto necesarios, "Cerrar Sesión" queda bien por encima del BottomNav de fondo pese a que sus coordenadas se solapan en el DOM (falso positivo de la primera versión del chequeo, descartado por hit-test real).

## TopBar — búsqueda mobile

Sin botones ni inputs chicos detectados, pero se midió vacía (sin término de búsqueda cargado) — no cubre el estado real con resultados. Repetir con un término cargado para una auditoría completa de esta pantalla.

## RegistrarPago — date picker abierto

Cosmético, del shell compartido — mismo patrón que "Nueva reserva": navegación de mes del calendario (36×36px) por debajo de 44px, e inputs de comprobante (monto, punto de venta, número, fecha) en 14px. El footer "Confirmar Pago" se confirmó correctamente por encima del BottomNav.

## Problemas transversales (arreglar una sola vez en el shell o en componentes compartidos)

1. **RESUELTO (Fase 1).** **Inputs en 14px en toda la app.** El hallazgo más repetido del barrido: buscadores, fechas, montos y campos de comprobante miden sistemáticamente 14px de font-size, por debajo del umbral de 16px que evita que iOS Safari haga zoom automático al enfocar un campo. Aparece en Clientes, Reservas, Caja, Historial, Ocupación, Perfil, Plano, Recepción, el modal "Nueva reserva" y RegistrarPago — prácticamente todo lugar con un input de texto. Vive en los componentes compartidos de `src/components/inputs/` (`SearchInput`, `MoneyInput`, `IntegerInput`, `TextInput`) y en `DateInput.tsx` (que además envuelve `react-day-picker`, cuyos botones de navegación de mes —28-36px— también quedan chicos en todos los calendarios de la app). Un solo ajuste de font-size en esos componentes cubre casi todas las pantallas.
2. **RESUELTO (Fase 1).** **Título de sección truncado en el TopBar.** Confirmado de nuevo con capturas: "Directo…" (Clientes), "Notifica…" (Notificaciones), "Plano d…" (Plano) — mismo patrón sistemático que ya constaba en CLAUDE.md "Pendiente". Vive en `SECTION_TITLES`/`<h1>` de `src/components/crm/TopBar.jsx`.
3. **RESUELTO (Fase 1).** **Botones de navegación estándar por debajo de 44×44px.** El ícono de búsqueda/perfil del TopBar (36×36 y 66×40) aparece en las 20 pantallas/estados. Los paginadores "anterior/siguiente" (36-38px) se repiten en Plano, Ocupación y Caja. Son pocos componentes compartidos, no 20 arreglos distintos.
4. **Pendiente (Fase 4, propio de cada pantalla).** **Botones de texto chicos como única acción primaria.** Mismo patrón en tres pantallas distintas: "Registrar pago"/"Ir a Caja" en Notificaciones (15px de alto), "Comprobante"/"Confirmar temporada" en la ficha de Clientes (16px), y los links de email en Leads (16px). Candidato a un solo componente de "acción chip" compartido con altura mínima 44px.
5. **RESUELTO (Fase 1).** **`ScrollToTopButton` se superpone a contenido clickeable real.** A diferencia del BottomNav (que gana correctamente por z-index), este botón flotante sí tapa acciones reales en Clientes. Vale la pena revisar su posicionamiento — por ejemplo, respetar el mismo margen que ya reserva el `pb-20`/`pb-12` de `AppLayout.jsx`, o detectar colisión con el contenido de abajo.
6. **Pendiente (Fase 4, propio de cada pantalla).** **Overflow silencioso dentro de contenedores internos.** El plano (`PlanoViewport`) y la fila de stat-cards de `PlanoStatsBar.jsx` recortan contenido contra su propio borde sin aviso ni scroll propio — no dispara el chequeo de scroll horizontal de la página porque el overflow queda contenido adentro de un div con `overflow: hidden`, pero la información ("Sombrillas 75%") se pierde igual para el usuario.
7. **RESUELTO (Fase 1).** **`html5-qrcode` se carga completo apenas se entra a Recepción.** El build de producción (`pnpm run build`) confirma el peso real: el chunk `Recepcion-*.js` pesa 352 KB / 105 KB gzip, el segundo más pesado de toda la app después del bundle principal — aunque `Recepcion.jsx` ya es lazy a nivel de ruta, `EscanearQR.jsx` importa `html5-qrcode` de forma eager dentro de esa página, así que se descarga igual aunque el usuario solo quiera tipear el código a mano en el mostrador. Candidato a `React.lazy()` del componente `EscanearQR`, no de la página entera.
8. **Parcialmente resuelto (Fase 1 solo en componentes compartidos; páginas quedan para Fase 4).** **307 usos de `text-[8px]`/`[9px]`/`[10px]` en todo el proyecto**, concentrados en pocos archivos: `Reservas.jsx` (39), `Clientes.jsx` (33), `UnidadPreviewModal.jsx` (19), `Ocupacion.jsx` (15), `DetallePago.jsx` (14), `TopBar.jsx` (13). No todos son bugs — varios son badges/contadores que funcionan bien chicos — pero es la misma clase de problema que ya se resolvió a propósito en el Plano (commits recientes de legibilidad: "números y celdas más grandes"), y conviene una pasada dedicada en esos archivos.
9. **No hay tablas sin versión mobile.** Chequeado explícitamente: todo uso de `<table>` real (Reportes.jsx) y el componente genérico `DataTable.jsx` (usado por Reservas y Home) ya tienen su alternativa de tarjetas con `sm:hidden`/`md:hidden`. Nada que arreglar acá.
10. **No hay interacciones que dependan solo de `:hover`.** Revisado el código de `ReservaCalendar.jsx`, `ConfirmDeleteModal.jsx`, `Reportes.jsx` y `KpiCard.jsx` (los que usan `hover:` fuera de los estados visuales estándar de hover-sobre-botón) — todos los `hover:` encontrados son feedback visual sobre elementos que también responden a tap, ninguno esconde una acción exclusiva de mouse.
11. **RESUELTO (Fase 1).** **`h-screen`/`100vh` en el shell raíz** (`AppLayout.jsx`, usado también por `Sidebar.jsx` aunque ese está oculto en mobile). No se detectó recorte real en ninguna captura — todo el contenido vive dentro del `<main>` con su propio scroll — pero `100vh` es un riesgo conocido en iOS Safari (la barra de direcciones puede dejar un `h-screen` más alto que el viewport visible real). Vale la pena vigilarlo si en el futuro aparecen reportes puntuales de "la pantalla no entra" en iPhone.

## Lo que no se encontró (y vale la pena remarcar)

Scroll horizontal de página: cero casos en 20 pantallas/estados × 2 tamaños. Elementos realmente tapados por el BottomNav (con hit-test de verdad, no solo coordenadas): cero. Interacciones hover-only sin equivalente táctil: cero. Tablas sin alternativa mobile: cero.
