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
- shadcn/ui + lucide-react

## Vocabulario de dominio (usar estos términos, no traducir)
- **Carpas / sombrillas / cabinas / locker**: unidades de playa alquilables, 4 tipos distintos (antes documentado incorrectamente como un solo grupo). El plano de playa solo dibuja carpas y sombrillas; cabinas y lockers están dentro del complejo y se manejan en su propia sección del CRM (flujo aparte, pendiente).
- **T / P / D (Temporada / Período / Día)**: tipo de alquiler de una reserva, no estado de la unidad. Es el dato que históricamente el carpero anotaba a mano sobre el plano impreso (ej: "C.19 ADRIAN 27/12 AL 09/01" = Carpa 19, cliente Adrian, tipo Período, 27/12 al 09/01).
- **Plano interactivo**: mapa visual de la playa con el estado de cada unidad.
- **Caja diaria**: registro de movimientos de dinero del día.
- **Preconfirmada**: estado intermedio de una reserva.
- **ARCA / AFIP**: autoridad fiscal argentina.
- **Mercado Pago**: pasarela de pago principal candidata.
- **CUIT / clave fiscal**: credenciales fiscales argentinas.

## Estructura de datos (Supabase — 8 tablas)
1. `clientes`
2. `unidades` (carpas/sombrillas)
3. `reservas`
4. `pagos` — motor de pagos por instancias (Fase 2, **implementada** sep 2026). Columnas: `id` uuid, `reserva_id` uuid FK → `reservas.id`, `monto` numeric, `fecha` date (default hoy), `medio` text (CHECK: efectivo | tarjeta_credito | tarjeta_debito | transferencia — cambiado de la versión anterior efectivo|transferencia|mercadopago|tarjeta, sin datos que migrar), `comprobante` text (registro interno, no factura ARCA/AFIP), `nro_cuota` int (asignado siempre por trigger, ver nota abajo — nunca se manda a mano), `cuotas_tarjeta` int (nullable, solo tarjeta_credito), `created_at`. Alta desde `PagoModal.jsx` vía `usePagos()`, un solo componente/hook compartido entre Clientes y Reservas. Trigger `fn_pago_actualiza_saldo` (AFTER INSERT/UPDATE/DELETE en `pagos`) recalcula `reservas.saldo`/`estado_pago` a partir de `valor_total - sum(pagos.monto)`; trigger `fn_reserva_recalcula_saldo` (BEFORE INSERT/UPDATE OF valor_total en `reservas`) mantiene la misma cuenta si se edita el monto contratado. `reservas.saldo`/`estado_pago` ya **no se cargan a mano** en el modal de Reservas — quedan de solo lectura, el motor los gestiona.
5. `caja_diaria`
6. `gastos_caja`
7. `leads` — consultas del formulario de contacto de la landing (`beachFlow`), mismo proyecto Supabase que el CRM. Flujo: form → webhook n8n → INSERT en `leads` → n8n notifica por CallMeBot al WhatsApp administrativo. Columnas: `id` uuid, `created_at` timestamptz, `nombre` text NOT NULL, `telefono` text NOT NULL, `email` text NOT NULL, `asunto` text NOT NULL, `mensaje` text, `origen` text (default `'landing-web'`), `estado` text (default `'nuevo'`; valores usados: nuevo | contactado | descartado), `notas_crm` text. RLS: `SELECT` + `UPDATE` para `authenticated`, `INSERT` para `anon` (la landing). Alimenta el módulo Leads (`/app/leads`).
8. `eventos` — log de auditoría escrito solo por triggers (`fn_log_evento`). Cada INSERT/UPDATE/DELETE sobre reservas/pagos/clientes/unidades/gastos_caja queda registrado con su fecha de negocio (`fecha_ref`). Alimenta la Línea de Tiempo (`/app/actividad`). RLS: solo lectura para `authenticated`.

Campos clave para el plano:
- `unidades.tipo`: carpa | sombrilla | cabina | locker
- `unidades.estado`: libre | ocupada | reservada — derivado, escrito solo por trigger, nunca editado a mano desde el CRM (`reservada` queda para holds/preconfirmadas)
- `reservas.tipo_alquiler`: temporada | periodo | dia (temporada = temporada completa, sin fechas obligatorias)
- `reservas.estado`: activa | cancelada
- `reservas.fecha`: solo para `tipo_alquiler = 'dia'`

Columnas confirmadas de `reservas` (auditoría sep 2026): `id`, `cliente_id`, `fecha_inicio`, `fecha_fin`, `numero_factura`, `notas`, `valor_total`, `saldo`, `estado_pago`, `created_at`, `tipo_alquiler`, `fecha`, `estado`, `origen`. No existe `codigo` ni `codigo_reserva` — se crea recién cuando se implemente el sistema de reservas públicas (`PRIUS-A3X9K2`).

`reservas.origen`: `manual` (default) | `web` — CHECK `reservas_origen_check`, agregado sep 2026. Hoy el CRM solo crea `manual`; el valor `web` queda reservado para cuando el sistema de reservas públicas por QR (`PRIUS-A3X9K2`, todavía en planificación) empiece a insertar reservas directamente. El filtro/badge de origen en Reservas.jsx ya está preparado para distinguirlos, aunque hoy siempre muestre "Manual".

Columnas confirmadas de `clientes`: `id`, `nombre`, `telefono` (nullable), `cuit`, `mail`, `notas`, `created_at`. Ojo: el campo de correo es `mail`, no `email` (distinto de `leads.email`, que sí se llama `email` — inconsistencia de nombres entre tablas, no unificar sin evaluar impacto).

**Nota de auditoría (ago 2026):** el proyecto Supabase tenía tablas duplicadas en inglés (`beach_clubs`, `admin_users`, `units`, `reservations`), remanentes de la etapa con Dyad — sin datos, sin referencias en código, eliminadas vía migración tras confirmar que no se usaban. Las tablas válidas son siempre las 8 listadas arriba, en español.

**✅ Deuda técnica de `Dashboard.jsx` (localStorage) resuelta (sep 2026):** el plano ahora lee/escribe contra Supabase con Realtime. `prius_beach_units` eliminado.

## Módulos del CRM (8)
Home, Plano, Reservas, Clientes, Caja, Reportes, Leads, + el dashboard de plano existente.

## Módulo Leads (`/app/leads`)
- Bandeja de leads en tiempo real sobre la tabla `leads`. Es el canal de lectura de leads del CRM: en producción reemplaza a la notificación automática por CallMeBot de n8n (n8n puede seguir insertando en `leads`, pero el staff lee acá).
- Vive en el `DataProvider` (patrón single-write / reactive-read): `leads` + `fetchLeads` + suscripción Realtime a la tabla + mutación `updateLead`. Selector `useLeads()` expone `leads`, `sinContactar` y `updateLead`; también exporta `waLink()` (normaliza teléfono AR → `https://wa.me/549…`).
- Cada lead: datos de contacto + asunto + mensaje, orden por `created_at` desc, indicador visual para `estado = 'nuevo'`. Badge de "sin contactar" en el sidebar.
- Botón "Contactar por WhatsApp": abre `wa.me` con el teléfono normalizado en `target="_blank"` y pasa el lead a `contactado`. No hay Edge Function ni envío automático de mensajes — solo redirect del navegador.
- Estados: `nuevo` → `contactado` → `descartado` (reabrible). Update reactivo, sin recargar la bandeja.
- Realtime: `leads` está en la publication `supabase_realtime` y usa su **propio canal** (`crm-leads-realtime`) en `DataProvider`, no el `crm-realtime` general. Motivo histórico: un binding `postgres_changes` sobre una tabla ausente de la publication anula todos los eventos de ese canal, y `crm-realtime` incluía `clientes`/`caja_diaria`/`gastos_caja` sin que estuvieran en la publication. **Resuelto (sep 2026, migración `realtime_clientes_caja_gastos` aplicada):** las tres se agregaron a `supabase_realtime`, así que Clientes y Caja ya refrescan en vivo por el canal principal. `leads` se deja igual en su canal propio por aislamiento, no por necesidad.
- CHECK `leads_estado_check` en la DB: `estado in ('nuevo','contactado','descartado')`.

## Reservas vs Clientes — son conceptualmente distintas (sep 2026)
Quedaron pixel-idénticas en la sesión anterior (misma tabla, mismo modal) y eso escondía que son cosas distintas. Se separaron en contenido y en layout:

- **Reservas (`/app/reservas`) = cola operativa.** Solo `tipo_alquiler in ('periodo','dia')` — alquileres acotados en el tiempo. Un cliente de temporada completa sin ninguna reserva de período/día **no aparece acá**. Layout tipo feed/tabla cronológico: ordenado por fecha de llegada (`fecha_inicio` en período, `fecha` en día) más reciente primero, con filtros siempre visibles arriba (rango de fechas, estado de pago, tipo período/día). Columna "Origen" (manual/web, ver `reservas.origen` arriba) — hoy siempre "Manual", preparada para cuando el sistema de reservas públicas por QR empiece a escribir `web`. El selector de tipo de alquiler del modal de alta/edición ya no ofrece "Temporada" — una temporada completa se carga desde Clientes (ver abajo), no desde acá, porque si se creara desde Reservas desaparecería de la lista apenas guardada (no es período/día).
- **Clientes (`/app/clientes`) = directorio maestro.** Lista a TODO cliente histórico sin excepción, sin filtrar por `tipo_alquiler` — temporada actual, temporadas pasadas, períodos y días pasados, y también clientes sin ninguna reserva asociada (la tabla `clientes` es independiente; `reservas.cliente_id` es nullable). Layout de filas-tarjeta expandibles, no tabla: **toda la caja del cliente es clickeable** (no un ícono chico) y expande inline —sin modal, sin cambiar de ruta— datos completos, la lista de TODAS sus reservas (activas y canceladas, cualquier tipo_alquiler) y una grilla de pagos por reserva (ver "Grilla de pagos" abajo — reemplazó la lista plana de historial). Un solo cliente expandido a la vez (`expandedId` en estado, clickear otro colapsa el anterior). Acento cyan (`text-cyan-400`, `border-cyan-400/40`) en vez del dorado `#FDE047` de Reservas, para que ambas pantallas no se confundan a simple vista — sigue dentro de la misma paleta Glass Dark, el `#FDE047` se mantiene como color de las acciones primarias (Nuevo Cliente/Reserva) en ambas.
- **Restyle previo (sep 2026):** Clientes.jsx había quedado con clases de la paleta "Quiet Luxury" clara (ver nota en "Diseño" más abajo) que nunca se aplicó al resto del CRM real — texto negro sobre tarjetas oscuras. Se corrigió a Glass Dark antes de esta separación conceptual.

### Alta de temporada, desde Clientes (sep 2026)
Un "cliente de temporada" es, en la base, un registro en `reservas` con `tipo_alquiler = 'temporada'` vinculado a un `cliente_id` — no una entidad separada. Por eso el alta vive del lado de Clientes y no de Reservas: crearla desde Reservas la haría desaparecer de la cola apenas guardada (no es período/día), y conceptualmente el directorio maestro es el dueño natural de "todo lo que le pasa a un cliente", temporada incluida. Dos puntos de entrada, mismos campos (unidad, `temporada` label, `valor_total` con `CurrencyInput`, notas), sin duplicar el formulario:
1. **Al crear un cliente nuevo:** checkbox opcional "Agregar reserva de temporada para este cliente ahora" en el modal "Nuevo Cliente" — al tildarlo aparecen los campos inline en el mismo formulario. Submit encadena `createCliente` → `createReserva` con el `cliente_id` recién creado.
2. **Para un cliente ya existente:** botón "Agregar Temporada" dentro de la fila expandida (sección Reservas) — abre un modal standalone con los mismos campos, apuntando a ese cliente.

Ambos usan `createReserva` de `useReservas()` con `tipo_alquiler: 'temporada'`, `origen: 'manual'`. La reserva creada nunca aparece en Reservas.jsx (filtro por `tipo_alquiler`) y se refleja en vivo en la fila expandida del cliente vía el mismo canal Realtime (sin wiring nuevo). Verificado en el navegador: alta de cliente+temporada en un solo submit, no aparece en Reservas, sí aparece en Clientes con su reserva asociada.

### Motor de pagos (Fase 2, implementado sep 2026) — compartido entre ambas
- `PagoModal.jsx` + `usePagos()` son el único componente/hook de alta de pago, invocado desde Clientes (elige entre las reservas activas del cliente) y desde Reservas (reserva ya fijada) — no se duplica.
- Campos: reserva, monto (`CurrencyInput`), medio de pago, fecha, nro. de cuota (opcional), nro. de comprobante (interno). `reservas.saldo`/`estado_pago` ya no se editan a mano — los recalculan los triggers Postgres (ver tabla `pagos` arriba).
- **`pagos.nro_cuota` es automático, no se carga a mano (fix sep 2026).** Era un input numérico libre y permitía repetir el mismo número en la misma reserva (se detectó con Hugo Bendaham: dos pagos con `nro_cuota=1`). Ahora lo asigna siempre el trigger `fn_pago_asigna_nro_cuota` (BEFORE INSERT en `pagos`) como el próximo secuencial para esa `reserva_id` — `count(*) + 1`, sin huecos ni repetidos, ignorando cualquier valor que mande el cliente. Migración `pagos_nro_cuota_automatico` incluyó un backfill del histórico (recalculado por `created_at` real). `PagoModal` ya no tiene el input — muestra un texto informativo ("Este va a quedar registrado como el pago N.° X de esta reserva") calculado en el front solo para previsualizar, el número real lo pone la DB.
- **`pagos.cuotas_tarjeta`** (int, nullable, migración `pagos_cuotas_tarjeta` sep 2026): cantidad de cuotas en las que la tarjeta le cobra el pago al cliente. Solo se muestra/edita en `PagoModal` cuando `medio = 'tarjeta_credito'` (chips 1/3/6/12 + carga libre); al cambiar a otro medio se oculta y se limpia antes de guardar. **Distinto de `nro_cuota`**, que es el número de instancia de pago sobre el saldo total de la reserva (ej. "este es el pago #2 de la temporada") — son dos conceptos no relacionados, no se reusa el mismo campo. Se muestra como "Tarjeta de Crédito — N cuotas" (helper `formatMedioPago` en `src/lib/pagos.js`, único lugar con el mapeo medio→label) en el historial de pagos de Clientes y en Comprobantes.
- `CurrencyInput.jsx` + `formatCurrency` (`lib/format.js`) son el único formateo de moneda del CRM — `valor_total`, el monto de `PagoModal`, y las columnas de saldo de ambas pantallas. Se eliminó un `formatCurrency` duplicado que tenía `Comprobantes.jsx`.
- Módulo Comprobantes (`/app/comprobantes`, ya existente) se reutilizó para listar los pagos de la reserva seleccionada vía `usePagos(reservaId)` — no se armó una pantalla de facturación aparte.
- Deep-link desde la búsqueda global: `/app/reservas?id=<uuid>` abre el modal de edición de esa reserva; `/app/clientes?id=<uuid>` ahora expande inline la fila de ese cliente (antes abría un modal de edición — ya no existe ese modal separado, edición y vista conviven en la misma fila expandida).
- Realtime: `clientes`, `reservas` y `pagos` están en la publication `supabase_realtime`, todas escuchadas desde el único canal `crm-realtime` del `DataProvider` (agregar una tabla nueva a Realtime es: sumarla a la publication + un `.on(...)` más en ese mismo canal — ninguna pantalla abre su propio `supabase.channel`). Verificado con dos pestañas: un pago cargado en una se refleja en la otra sin recargar.

### Grilla de pagos por reserva, dentro de Clientes (sep 2026)
Reemplaza la lista plana de historial de pagos que había en la fila expandida. Reproduce el cuadro que ya usa el administrador en Excel: **Precio de Venta | Mes 1 … Mes 6 | Saldo**, en ese orden. Componente `PagosGrid.jsx` — **una grilla por reserva**, no una fila por cliente (`valor_total`/`saldo` son datos de la reserva, no del cliente; un cliente con varias temporadas ve una grilla por cada una).

- Cada columna de mes muestra el pago cuyo `pagos.nro_cuota` sea ese número. Si no hay pago para ese número, la celda queda vacía con borde punteado (distinta de "$0"). Si algún caso tiene más de 6 cuotas, se agregan columnas extra en vez de perder el dato (`totalMeses = max(6, nro_cuota más alto, próximo secuencial)`).
- **Correspondencia mes↔cuota:** hoy `nro_cuota` 1..6 se trata como orden secuencial puro de carga (lo asigna el trigger `fn_pago_asigna_nro_cuota`, ver arriba), **no** un mes calendario real. **Pendiente confirmar con el administrador** si en algún momento hace falta atarlo a un mes calendario real (ej. si un cliente paga el "Mes 3" en enero y el "Mes 1" en abril, hoy el sistema no lo distingue — solo ve orden de llegada de los pagos).
- **Único punto clickeable para cargar un pago nuevo: la próxima celda vacía en secuencia** (`nro_cuota = cantidad de pagos ya cargados + 1`). Las celdas de meses más adelante se ven vacías pero deshabilitadas (gris, sin click) — el trigger de saldo no permite "saltar" cuotas (siempre asigna el próximo secuencial), así que clickear una celda futura no podría, de todas formas, cargar el pago ahí. Esto es una limitación deliberada para no romper el trigger de saldo (fuera de alcance de esta sesión) — si a futuro el administrador necesita registrar pagos fuera de orden, hay que revisar ese trigger.
- Click en una celda YA cargada abre `PagoModal` en un modo de solo lectura nuevo (prop `pagoExistente`): muestra monto, medio de pago, fecha y comprobante, sin formulario ni botón de guardar — no se tocó `handleSubmit`/`createPago`, es un `return` distinto dentro del mismo componente.
- Si el pago fue con `tarjeta_credito`, la celda muestra un badge chico (ícono `CreditCard` + "Nx") con la cantidad de cuotas, sin romper el layout — informativo, no reemplaza la columna de mes.

### Limpieza de datos de prueba (sep 2026)
La reserva de prueba "JORGE PECOTCHE" (temporada 2026/2027, $1.500.000, con dos pagos de prueba incluyendo `REC-TEST-01`) se detectó 100% ficticia (teléfono inválido, sin email/CUIT) y se borró por completo —cliente, reserva y los 2 pagos— antes de la carga de clientes reales. La reserva huérfana (`tipo_alquiler = 'dia'`, sin cliente) que había quedado pendiente de revisión ya no está en la base. También se creó y borró en esta sesión un cliente "TEST TEMPORADA QA" y, en la sesión de la grilla de pagos, un pago de prueba de $500 sobre la reserva real de Hugo Bendaham — ambos verificados y removidos sin dejar rastro. La única reserva real hoy es la de HUGO BENDAHAM.

## Búsqueda global
Barra de búsqueda en el header superior, visible en todos los módulos del CRM. Búsqueda en tiempo real, client-side, sobre los datos ya cargados en `DataProvider` (sin round-trip a Supabase por ahora — server-side queda para cuando el volumen de reservas históricas lo justifique).

Busca sobre `clientes.nombre` y `clientes.telefono` (ambos ya vienen anidados en cada reserva vía el join existente en `RESERVA_SELECT` de `DataProvider.jsx`, no hace falta cruzar nada a mano). Resultados agrupados por tipo (cliente / reserva), click navega directo al registro correspondiente. Match case-insensitive y sin distinguir acentos; tolera `telefono` nulo sin romper.

`reservas.codigo` no existe en el schema — queda fuera de esta feature, se suma cuando se implemente el sistema de reservas públicas (`PRIUS-A3X9K2`).

**Fix incluido:** el `<input>` de búsqueda en `TopBar.jsx` (línea 44-52) existía pero era decorativo (sin lógica) y estaba oculto en mobile/tablet (`hidden lg:block`) — se reutiliza el mismo input, se le agrega la lógica de filtrado, y se lo hace visible en todos los breakpoints.

## Principio arquitectónico clave (del catch-up con el dueño, julio 2026)
El dueño piensa el sistema como **cliente-céntrico y reactivo en tiempo real**, no como módulos aislados. Toda acción del cliente (reserva, pago, check-in, consumo de servicio) debe:
1. Escribir en `reservas` / `pagos` (fuente de verdad única).
2. Propagarse automáticamente y en tiempo real a:
   - **Plano interactivo** → cambia estado visual de la unidad (libre / ocupada / pendiente de pago).
   - **Caja diaria** → genera el movimiento correspondiente sin carga manual.
   - **Reportes** → se recalculan en vivo.
   - **Listados de clientes/reservas** → reflejan el estado actualizado.

**Implementación esperada:** patrón "single write, multiple reactive reads" usando Supabase Realtime. Evitar que cada pantalla (Plano, Caja, Reportes) dispare su propia lógica de escritura; todas deben suscribirse al mismo canal reactivo sobre `reservas`/`pagos`, idealmente con triggers de Postgres que actualicen `unidades.estado` y `caja_diaria`/`gastos_caja` automáticamente al insertar una reserva o un pago.

El plano nunca recibe un estado tipeado a mano: reacciona vía trigger Postgres (`trg_reserva_actualiza_unidad`) a INSERT/UPDATE/DELETE en `reservas`. La vigencia de la reserva determina `unidades.estado` (libre/ocupada). Los vencimientos sin actividad de escritura (una reserva `periodo`/`dia` que vence sin que se dispare ningún write ese día) los resuelve `pg_cron` corriendo `fn_recalcular_estados_unidades()` a diario (03:05 UTC / 00:05 ART); el front además llama esa función por RPC al abrir el plano.

## Sistema de reservas públicas (planificado, sin auth)
- Sin login para el cliente final.
- Mismo proyecto Supabase que el CRM, sincronizado en tiempo real.
- Precio varía según método de pago.
- Grupos de más de 6 personas → dispara una segunda unidad automáticamente.
- El hold de la reserva dura hasta el día del check-in.
- Códigos de reserva únicos para recepción (formato: `PRIUS-A3X9K2`).
- **Seguridad crítica:** todos los writes públicos pasan por Supabase Edge Functions, nunca inserts directos desde el cliente. RLS en la anon key restringe a solo lectura de disponibilidad.

## Diseño ("Quiet Luxury") — ⚠️ desactualizado respecto a la implementación real (ver nota)
- Colores documentados: `#FFFFFF`, `#F2CA50`, `#000000`, `#E5E5E5`
- Tipografía: Inter
- Estética plana: sin sombras, sin gradientes
- Mobile-first, con bottom nav bar en pantallas chicas. La versión mobile debe sentirse como una app nativa de Play Store: totalmente interactiva, moderna, prolija visualmente e intuitiva — no una web responsive genérica.

**Nota (sep 2026):** esto describe una paleta clara que **no es la que corre hoy en el CRM**. Sidebar, TopBar, AppLayout, `DataTable`/`Modal` genéricos y todas las pantallas reales (Reservas, Caja, Comprobantes, Leads, Clientes) usan una estética "Glass Dark" (fondo oscuro, `glass-card`, acento `#FDE047`) heredada del commit `2c781ed` ("Unificación bajo estética Glass Dark", etapa Dyad). Clientes.jsx se había escrito siguiendo esta sección al pie de la letra y quedó visualmente roto contra el resto de la app (texto negro sobre tarjetas oscuras) — se corrigió unificándolo a Glass Dark, no a esta paleta. Esta sección queda para que decidas: o se actualiza para documentar Glass Dark como el sistema real, o se planifica una migración real a esta paleta clara en algún momento. Hasta que se resuelva, cualquier pantalla nueva debería copiar el estilo de Reservas/Sidebar (Glass Dark), no esta sección.

## Pendiente / en foco ahora (migración a Claude Code)
- **✅ Fase 2 — motor de pagos por instancias, implementado (sep 2026):** alta de pago real sobre `pagos` (`PagoModal` + `usePagos`, compartido Clientes/Reservas), `reservas.saldo`/`estado_pago` recalculados por trigger a partir de los pagos. **Todavía no implementado dentro de Fase 2:** cruce automático del pago con `caja_diaria`/`gastos_caja` (un pago registrado hoy no genera movimiento de caja) y selección de Mercado Pago como medio (el CHECK de `pagos.medio` es efectivo|tarjeta_credito|tarjeta_debito|transferencia, sin mercadopago — eso depende de qué pasarela se elija, ver punto siguiente). No asumir que un pago mueve la caja hasta que esto se sume.
- Pasarela de pago: Mercado Pago Checkout Pro (candidata principal) vs Payway vs Mobbex — evaluar comisiones.
- Facturación ARCA/AFIP: requiere CUIT + certificado + integración WSFEv1 (o servicio intermediario).
- Edge Functions para reservas públicas.
- DNS: dominio `priusplayagrande.com.ar` en NIC.ar, delegado a Cloudflare (no transferencia, `.com.ar` no soportado como registrar en Cloudflare).

## Preferencias de trabajo
- Prompts flat, concisos, sin tablas markdown ni headers pesados (para no gastar tokens de más con agentes de IA).
- Deliverables para el dueño del balneario: lenguaje no técnico, orientado a beneficios de negocio, no a implementación.
- Diseño: se trabaja primero en Google Stitch (exporta ZIP con `DESIGN.md` + `code.html` + `screen.png`) antes de pasar a código.
- Mantenimiento de `CLAUDE.md`: Claude entrega siempre el archivo completo y actualizado, listo para reemplazar el existente — no diffs sueltos para pegar a mano.

## Aprendizajes de prompt engineering (relevantes también para Claude Code)
- Instrucciones abstractas generan que el agente invente componentes nuevos que no pedimos.
- Es mejor dar el código fuente real en el prompt que descripciones abstractas o listas de archivos.
- Preferir "borrar y reemplazar" explícito en vez de "mejorar" cuando se pide refactor.