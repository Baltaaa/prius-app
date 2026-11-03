# Prius App — Contexto del proyecto

## Quién soy yo (Balta) y para quién es esto
Desarrollador/consultor externo construyendo la plataforma digital de **Prius Playa Grande**, un balneario en Mar del Plata, Argentina. Trabajo para el dueño del balneario (cliente), no soy parte interna del negocio. Todo el trabajo y la comunicación es en **español**.

## Qué es Prius App
CRM a medida que reemplaza por completo el flujo manual en Excel del balneario: plano de playa, caja diaria y reservas de temporada. Es distinto del sitio público (repo `beachFlow`, solo landing page pública).

## Repos
- `priusApp`: el CRM completo (login, dashboard, plano, etc.) — **este repo**.
- `beachFlow`: se mantiene solo para la landing pública.

## Stack técnico
- React 19 + TypeScript + Vite
- Tailwind CSS v3
- React Router DOM v7
- Supabase (auth, DB, Edge Functions, Realtime)
- lucide-react (primitivas propias en src/components/brand)

## Vocabulario de dominio (usar estos términos, no traducir)
- **Carpas / sombrillas**: unidades de playa alquilables.
- **Plano interactivo**: mapa visual de la playa con el estado de cada unidad.
- **Caja diaria**: registro de movimientos de dinero del día.
- **Preconfirmada**: estado intermedio de una reserva.
- **Cosocios**: clientes adicionales vinculados a una misma reserva/unidad (tabla `reserva_clientes`).
- **Temporada / Período / Día**: valores de `reservas.tipo_alquiler`.
- **ARCA / AFIP**: autoridad fiscal argentina.
- **Mercado Pago**: pasarela de pago principal candidata.
- **CUIT / clave fiscal**: credenciales fiscales argentinas.

## Estructura de datos (Supabase — 6 tablas)
1. `clientes`
2. `unidades` (carpas/sombrillas)
3. `reservas`
4. `pagos`
5. `caja_diaria`
6. `gastos_caja`

## Módulos del CRM (7)
Home, Plano, Reservas, Clientes, Caja, Reportes, + el dashboard de plano existente.

## Principio arquitectónico clave (del catch-up con el dueño, julio 2026)
El dueño piensa el sistema como **cliente-céntrico y reactivo en tiempo real**, no como módulos aislados. Toda acción del cliente (reserva, pago, check-in, consumo de servicio) debe:
1. Escribir en `reservas` / `pagos` (fuente de verdad única).
2. Propagarse automáticamente y en tiempo real a:
   - **Plano interactivo** → cambia estado visual de la unidad (libre / ocupada / pendiente de pago).
   - **Caja diaria** → genera el movimiento correspondiente sin carga manual.
   - **Reportes** → se recalculan en vivo.
   - **Listados de clientes/reservas** → reflejan el estado actualizado.

**Implementación esperada:** patrón "single write, multiple reactive reads" usando Supabase Realtime. Evitar que cada pantalla (Plano, Caja, Reportes) dispare su propia lógica de escritura; todas deben suscribirse al mismo canal reactivo sobre `reservas`/`pagos`, idealmente con triggers de Postgres que actualicen `unidades.estado` y `caja_diaria`/`gastos_caja` automáticamente al insertar una reserva o un pago.

## Sistema de reservas públicas (planificado, sin auth)
- Sin login para el cliente final.
- Mismo proyecto Supabase que el CRM, sincronizado en tiempo real.
- Precio varía según método de pago.
- Grupos de más de 6 personas → dispara una segunda unidad automáticamente.
- El hold de la reserva dura hasta el día del check-in.
- Códigos de reserva únicos para recepción (formato: `PRIUS-A3X9K2`).
- **Seguridad crítica:** todos los writes públicos pasan por Supabase Edge Functions, nunca inserts directos desde el cliente. RLS en la anon key restringe a solo lectura de disponibilidad.

## Diseño
Fuente de verdad: `design/DESIGN.md` (paleta, tipografía Manrope, forma, componentes, gráficos, animaciones, layout). Referencia visual: `design/reference/`. Tokens en `src/index.css` y `tailwind.config.js`; primitivas y shell en `src/components/brand/`. `pnpm audit:design` debe dar cero hallazgos.
- Excepciones documentadas: el mapa del plano en desktop/tablet, las vistas de impresión A4 y `lib/colors.ts`.
- Un mismo estado = mismo color en toda la app: `COLOR_ESTADO` en `lib/colors.ts`.
- Mobile-first, con bottom nav bar en pantallas chicas. La versión mobile debe sentirse como una app nativa de Play Store: totalmente interactiva, moderna, prolija visualmente e intuitiva — no una web responsive genérica.
- Espaciado (escala de 4px, detalle en DESIGN.md "Espaciado"): padding de página 16/24/32px, gap entre cards 12/16/20px, padding de card 16/20/24px (hero 28px), card dentro de card `card-inner` (16px, fondo surface), etiqueta de sección 13px a 8px de su contenido y 24px entre secciones, contenido máx. 1680px centrado desde 1920px. Siempre con los tokens (`px-page`, `gap-grid`, `card-pad`, `card-inner`, `section-label`); prohibidos `p-[13px]`, medios pasos (`p-2.5`) y padding propio en una `card-surface`.
- Un solo botón primario negro visible por vista: el del topbar ("+ Nueva reserva"). Las acciones de página son `btn-secondary` (pill blanca con borde `line`); el primario solo se repite dentro de modales y sheets, y en Login / Cambiar contraseña.
- Paneles de detalle: el layout lo decide el ancho del PANEL con container queries (`@container` + `@[880px]:`), no el viewport. Historial al lado del detalle solo si el panel mide 880px o más.
- Checklist responsive (antes de dar una pantalla por terminada, `e2e/rebrand-responsive.spec.ts` y `e2e/rebrand-overlays.spec.ts` en los 11 anchos de DESIGN.md): cero scroll horizontal, nada desborda su card o modal, ningún monto ni nombre truncado sin `title`, la bottom nav no tapa contenido, touch targets ≥ 44px e inputs ≥ 16px en mobile, `dvh` y nunca `vh`.

## Reglas UX/UI y permisos (testing 23/10/2026)
- Plano: el mapa no se rediseña. Todas las casillas con borde sutil (#E5E5E5), toda la casilla clickeable (número incluido), sin selección de texto (select-none). El panel de unidad muestra titular y cosocios; "Ver ficha de cliente" navega a `/clientes?cliente=<id>` con la ficha abierta. "Asignar cliente de temporada" / "Asignar reserva" abre el modal ahí mismo en el Plano, sin navegar, con la unidad precargada.
- Buscador global del topbar: placeholder "Búsqueda inteligente", en pill blanca. Reservas no tiene buscador propio; Clientes conserva su input para filtrar la lista, en la topbar de la sección con el mismo ancho que el global.
- Reservas desktop: tabla 60% / ficha 40% (desde 1280px; entre 1024 y 1279 la ficha es un drawer superpuesto del 45% con fondo semitransparente y cierre con click afuera, para no aplastar la tabla). La tabla no tiene columna Saldo (se ve en la ficha); columnas Llegada, Cliente, Unidad, Monto total, Estado y Origen con anchos fijos medidos contra el espacio real (nunca a ojo) — Origen baja a solo ícono con tooltip entre 1280 y 1366, texto completo desde 1440. Ficha con datos y acciones en grilla de dos columnas, instancias de pago sin truncar ("Sin comprobante" entero).
- Topbars de sección en una sola línea (búsqueda/filtros a la izquierda, acción principal a la derecha), misma altura en todas.
- Paneles de detalle (Clientes y Reservas, desktop ≥1024px): la lista/tabla y la ficha son dos cajas de EXACTAMENTE la misma altura, que llenan el viewport completo (`100dvh` menos header global y topbar de sección) sin que la página scrollee — el footer global se oculta en estas dos secciones desde ese ancho (sigue visible en mobile/tablet, sin cambios ahí). Cada caja scrollea por dentro solo si su contenido no entra (tabla con encabezado sticky); nada de alturas calculadas a mano (`calc(100vh-...)`, `sticky top-4`) — el alto sale de flex/grid con `min-h-0`/`min-height:0` en toda la cadena, nunca de JS. **Ojo con CSS Grid**: un grid con filas implícitas (`auto`) autosizea la fila al contenido antes de resolver `height:100%` en los hijos — es circular por spec y el browser lo resuelve mal (la fila termina más alta que el contenedor real). Si el panel usa `display:grid` para la fila tabla/ficha, hace falta `gridTemplateRows: minmax(0, 1fr)` explícito (mismo rol que `min-h-0` en flexbox); si usa flexbox con `align-items: stretch` (default), no hace falta nada extra. Placeholder a alto completo cuando no hay selección y crossfade suave al cambiar de registro, sin saltos de tamaño.
- "Nueva reserva" es un solo botón global (topbar desde tablet, "+" de la bottom nav en mobile) que abre el modal en la sección actual; ninguna sección tiene su propio botón de Nueva reserva.
- Reservas: sin columna de acciones en la tabla; las acciones viven en la ficha lateral.
- Nueva reserva: tipo Temporada / Período / Día. Temporada oculta el date picker y usa las fechas de la temporada vigente desde una única fuente de verdad; solo admite unidades libres toda la temporada. En pantalla solo se muestra "Temporada vigente 2026/2027", nunca las fechas.
- Nueva reserva: el primer pago (seña o total) con su comprobante se carga sí o sí en el mismo modal, inline y en una sola transacción. Única excepción: check "Cargar más tarde". Las unidades bonificadas no piden pago.
- Instancias de pago: grilla responsive sin scroll horizontal ni vertical interno; dato principal = número de comprobante (tipo + número) completo, sin truncar; secundario = monto. El tipo de comprobante se muestra siempre en tarjeta y detalle.
- Nueva reserva y asignación de temporada permiten cargar el pago y su comprobante en el mismo flujo, reutilizando exactamente la lógica de Registrar Pago.
- Cosocios: todos los cosocios de una unidad se listan en ficha de reserva, panel del Plano, ficha de cliente y lista de Clientes. Cualquier cosocio puede registrar pagos con la misma lógica que el titular; el pago guarda el cliente_id de quien pagó, impacta el saldo total de la reserva compartida y en la caja figura con su nombre.
- Estado de pago manual: solo superadmin puede revertir o cambiar el estado de pago de una reserva (ej. sacar "Pagado"), con motivo obligatorio, registro en Historial y validación de rol en Supabase.
- Solo superadmin puede editar monto o tipo de comprobante de un pago, anularlo o eliminarlo. Se valida en UI y en Supabase (RLS/RPC).
- Registrar Pago solo muestra aviso cuando el pago NO afecta la caja de hoy (histórico u otro día).
- Registrar Pago (componente único, usado en ficha de cliente, ficha de reserva y nueva reserva): medio de pago como select con ícono/emoji por opción, sin fondos grises, punto de venta siempre 1 automático y oculto.
- Comprobantes anulados no bloquean: la unicidad tipo + punto de venta + número aplica solo a comprobantes vigentes; un número anulado se puede volver a cargar y el anulado queda en el historial.
- Overlays anidados: click fuera de un select/popover/date picker abierto solo cierra ese overlay, nunca el modal que lo contiene. El modal solo se cierra (o pide descartar cambios) con click en su propio fondo cuando no hay ningún overlay interno abierto. Escape cierra solo la capa de arriba.
- Checks que despliegan campos: fade + scroll suave que centra los campos nuevos en el viewport (utilidad reutilizable).
- Toda request a Supabase usa el loader universal: botón en loading y deshabilitado, sin pantallazos, toast de éxito/error específico. Un único sistema de toast en la app.
- Ningún número se muestra sin formato: pesos, dólares, cantidades, porcentajes, fechas y horas usan los formateadores únicos de la app en toda la app (Historial, Notificaciones, CSV e impresiones incluidos). Los eventos nuevos de Historial guardan montos formateados o estructurados.
- Comprobantes emitidos: ID correlativo único desde 001 generado en base; impresión siempre en blanco y negro, dos copias idénticas por hoja A4 (50% cada una, línea de corte); sin DNI, teléfono ni CUIT del cliente.
- Caja (abierta, cerrada, impresión y CSV): el arqueo integra TODOS los medios de pago, no solo efectivo: por cada medio Esperado, Contado/Verificado y Diferencia, más una fila Total; el desglose por medio muestra cantidad, ingresos, egresos y neto. Todo calculado en un solo lugar (función/vista de Postgres) y leído igual por pantalla, impresión y CSV. Cada comprobante muestra en chico el nombre y apellido del cliente.
- Validación: un único módulo de validadores para toda la app. DNI 7-8 dígitos (se guarda sin puntos), CUIT 11 dígitos con verificador módulo 11, celular normalizado a +549…, email válido en minúsculas, montos positivos. Date pickers de solo selección, sin texto tipeable. CHECK constraints NOT VALID en `clientes` (no tocan datos históricos). Errores en español debajo del campo, al blur o submit.
- Dashboard: hero Cobranzas temporada + accesos rápidos 3x2 (Reservar, Cobrar, Check-in, Buscar cliente, Plano, Leads); Condiciones marítimas + Capacidad diaria; Últimos movimientos. Cobrar lleva a Reservas filtrado por saldo. En desktop la caja vive solo en la tarjeta del sidebar; en mobile y tablet, como card en el Dashboard.
- Responsive: verificar siempre 390, 1024, 1280, 1366x768, 1397x834 y 1440; nada se pisa ni se corta en el header. Anchos y altos de columna/panel calibrados en el navegador contra el espacio real disponible, no a ojo — una columna o caja que "entra justo" en un breakpoint y se pisa/desborda en el de al lado es un bug.
- Mobile iPhone (sistema único): gutter lateral 16px, gap 12px entre cards, radios y alturas de controles consistentes, touch targets mínimo 44px, inputs con font-size 16px (evita el zoom de iOS), safe areas con env(safe-area-inset-*) y viewport-fit=cover, alturas con dvh. Montos con componente único que nunca parte el "$" del número (nowrap + tamaño fluido). Ningún contenido queda tapado por la bottom nav ni por la barra de Safari. Un solo botón flotante de alta (el "+" de la bottom nav); sin FABs duplicados. Bottom sheets con header compacto, scroll interno y botón de confirmar fijo abajo. Verificar en 375, 393 y 430 de ancho con emulación iPhone.
- Títulos de sección: el título vive en el topbar (28px; 36-40px solo en el saludo del Dashboard, "Hola, <nombre>"), nunca como bloque H1 + subtítulo dentro de la pantalla.
- Bottom nav mobile: el ítem activo en pill negra, los inactivos en gris; el "+" central es dorado.
- Plano mobile: sin chips de filtro (tipo de unidad y estado); se usan solo en desktop/tablet. El plano aprovecha ese espacio.
- Lista de Clientes (todas las vistas y breakpoints): la card no muestra teléfono. Izquierda: avatar + nombre y apellido + debajo la etiqueta de estado (Pagado, Seña parcial, Sin pago, Sin confirmar, Bonificada). Derecha, alineados en columna: saldo pendiente (si hay) y unidad.
- Scroll: cada pantalla arranca arriba de todo (al iniciar sesión, al cambiar de ruta, al recargar); el header nunca queda cortado.
- Loading de inicio de sesión: solo el logo y el spinner, sin círculo/anillo alrededor del logo.
- Tests contra producción: Playwright solo con `playwright.rebrand.config.ts` y `e2e/guard.ts` (lista blanca de requests, sin escrituras). La config por defecto tiene un globalTeardown que borra datos en producción al terminar cualquier corrida.
- Login (rebranding Stitch, design/stitch/06-login-*): desktop pantalla dividida (imagen + marca a la izquierda, card de formulario a la derecha); mobile imagen arriba y formulario en bottom sheet. Imagen de fondo y logo: siempre los assets reales de la app, nunca los placeholders de los mocks. Estados Normal / Inactividad / Error; sin selector de estados visible. Sin cambios en la lógica de auth ni en las reglas de sesión.
- Verificación: ningún fix de interacción (clicks, navegación, modales) se da por terminado sin probarlo con un click real en el navegador o un test de interacción.
- Confirmación de superadmin (26/10/2026): toda acción destructiva o sensible de superadmin (eliminar reserva/cliente, quitar cosocio, eliminar lead, anular pago, editar comprobante o monto de un pago vigente, cambiar/revertir estado de pago manual, reabrir caja) exige reingresar la contraseña del superadmin logueado en un modal de confirmación único (`ConfirmarSuperadminModal.jsx`), no "escribí el nombre para confirmar". La contraseña se verifica del lado servidor (Edge Function `superadmin-action`) antes de ejecutar la acción real vía un dispatcher de Postgres (`fn_ejecutar_accion_superadmin`); las RPC destructivas ya no son invocables directo desde el cliente (sin `EXECUTE` para `authenticated`). Intentos fallidos limitados (5 seguidos → bloqueo de 15 min) y registrados en Historial junto con cada acción ejecutada. La sesión del browser no se toca en ningún momento (ni re-login, ni timeout, ni reload).

## Pendiente / en foco ahora (migración a Claude Code)
- Pasarela de pago: Mercado Pago Checkout Pro (candidata principal) vs Payway vs Mobbex — evaluar comisiones.
- Facturación ARCA/AFIP: requiere CUIT + certificado + integración WSFEv1 (o servicio intermediario).
- Edge Functions para reservas públicas.
- DNS: dominio `priusplayagrande.com.ar` en NIC.ar, delegado a Cloudflare (no transferencia, `.com.ar` no soportado como registrar en Cloudflare).

## Preferencias de trabajo
- Prompts flat, concisos, sin tablas markdown ni headers pesados (para no gastar tokens de más con agentes de IA).
- Deliverables para el dueño del balneario: lenguaje no técnico, orientado a beneficios de negocio, no a implementación.
- Diseño: se trabaja primero en Google Stitch (exporta ZIP con `DESIGN.md` + `code.html` + `screen.png`) antes de pasar a código.

## Aprendizajes de prompt engineering (relevantes también para Claude Code)
- Instrucciones abstractas generan que el agente invente componentes nuevos que no pedimos.
- Es mejor dar el código fuente real en el prompt que descripciones abstractas o listas de archivos.
- Preferir "borrar y reemplazar" explícito en vez de "mejorar" cuando se pide refactor.
- Un fix declarado "resuelto" sin verificación de interacción no cuenta: siempre reproducir el bug y probar el arreglo en navegador.
