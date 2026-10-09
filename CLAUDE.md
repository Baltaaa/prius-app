# Prius App — Contexto del proyecto

## Quién soy yo (Balta) y para quién es esto
Desarrollador/consultor externo construyendo la plataforma digital de Prius Playa Grande, un balneario en Mar del Plata, Argentina. Trabajo para el dueño del balneario (Chelo), no soy parte interna del negocio. Todo el trabajo y la comunicación es en español.

## Qué es Prius App
CRM a medida que reemplaza el flujo manual en Excel del balneario: plano de playa, caja diaria y reservas de temporada. En producción en prius-app.pages.dev desde el 1/10/2026; Marcelo Madotta (Mado) lo opera a diario. Es distinto del sitio público (repo beachFlow).

## Repos
- priusApp: el CRM completo — este repo.
- beachFlow: landing pública y futuro sistema de reservas públicas. Comparte el mismo proyecto Supabase.

## Stack técnico
React 19 + TypeScript + Vite, Tailwind CSS v3, React Router DOM v7, Supabase (auth, DB, Edge Functions, Realtime), shadcn/ui + lucide-react. react-hook-form + zod (formularios y validación), date-fns (fechas, locale es), libphonenumber-js (teléfonos), vitest (tests). Deploy en Cloudflare Pages.

## Roles
- superadmin (permiso total): Chelo, Marcelo Madotta, Balta.
- admin: personal capacitado bajo cargo del dueño.
- Implementado: columna `perfil.rol` ('superadmin' | 'admin'), matriz de claves en `src/lib/permisos.ts` (`tienePermiso(rol, clave)`, hook `usePermiso(clave)`) — toda clave no registrada en la matriz cae a "solo superadmin" por default seguro. Espejado en la base por `es_superadmin()`/`es_admin()` (ver migración `roles_perfiles_y_rls_usuario_activo`).

## Vocabulario de dominio (usar estos términos, no traducir)
- Tipos de unidad: carpa, sombrilla, cabina, locker.
- Plano interactivo: mapa visual de la playa con el estado de cada unidad.
- Caja diaria: sesión de caja del día (apertura, movimientos, cierre con arqueo y Z). Arqueo: comparación entre efectivo esperado y contado al cierre. Z: cierre del controlador fiscal, se carga a mano (opcional).
- Comprobante: factura o recibo emitido por fuera del CRM (FA/FB/FC, RA/RB/RC/RX + número). Formato único de display: `TIPO-NUMERO` (ej. "FB-727", "RB-1131") — sin punto de venta, sin ceros a la izquierda, helper único `formatComprobante()` en `lib/format.ts` (espejado en SQL por `fn_comprobante_etiqueta()`, usado dentro de `resumen_caja()`).
- tipo_alquiler (propiedad de reservas): temporada / período / día.
- reservas.estado_pago: pendiente, parcial, pagado, pendiente_confirmacion (cliente de la temporada anterior que aún no confirmó ni pagó; su unidad se muestra reservada, no libre).
- Bonificada: reserva/unidad sin cargo (costo 0, no registra pagos).
- Días (nunca "noches" ni "noche"): Prius es un balneario, no un hotel — en reservas, resúmenes, Historial, notificaciones y comprobantes siempre se habla de días. Conteo inclusivo: 27/12 al 09/01 son 14 días, no 13 (ver `diasEntre()` en Reservas.jsx, +1 explícito).
- Reserva con precio unificado / grupo: varias reservas del mismo cliente (ej. varios períodos no contiguos) bajo un solo precio pactado en vez de uno por reserva — tabla `reserva_grupos` + `reservas.grupo_id`. Ver "Estructura de datos".
- Candado / bloqueada: marca en una reserva (cualquier tipo_alquiler) que impide editar su fecha y su unidad hasta que un admin la desbloquee explícitamente. Cliente y pagos de esa reserva siguen editables aunque esté bloqueada.
- Co-socios: clientes adicionales que comparten una reserva/unidad.
- Carperos, comandas.
- ARCA / AFIP: autoridad fiscal argentina. CUIT / clave fiscal: credenciales fiscales.
- Mercado Pago: pasarela candidata para cobros online.
- Código de reserva: formato `PRIUS-A3X9K2` (sin 0/O/1/I), generado por `generar_codigo_reserva()` en Postgres. Vive en `codigos_reserva.codigo` (pk), referenciado por `reservas.codigo` — ver "Sistema de reservas públicas".

## Estructura de datos (Supabase)
- `clientes`: datos personales + fiscales (condicion_iva, cuit, razon_social). DNI único cuando está cargado. Columna histórica reutilizada: `mail` (no `email`).
- `unidades`: carpas/sombrillas/cabinas/lockers. `unidades.estado` siempre derivado por trigger, nunca manual. Número único por tipo. Agrupamiento por pasillo (A/B/C) es solo visual en el frontend. `fila`/`orden` (oct 2026, Fase 1 reservas públicas): posición real del plano, única fuente para el CRM y la landing — ver "Layout del plano" más abajo. `capacidad` (carpa 6, sombrilla 4), `habilitada_web` (false en cabina/locker, que hoy no tienen filas/orden cargados por no tener unidades reales todavía).
- `reservas`: tipo_alquiler, precio_lista, ajuste, bonificada, estado_pago (derivado de pagos por trigger salvo pendiente_confirmacion). Fechas según tipo: `fecha` (día), `fecha_inicio`/`fecha_fin` (período); temporada no tiene fecha propia, se resuelve contra `temporadas` vía `temporada_id`. `rango` (daterange, NOT NULL, oct 2026): unifica los tres casos, lo mantiene el trigger `fn_reserva_calcula_rango` (BEFORE INSERT/UPDATE) y, para las de temporada, también `fn_temporada_actualiza_rango_reservas` (AFTER UPDATE OF fecha_inicio/fecha_fin ON temporadas). Única regla anti-doble-reserva: exclusion constraint `reservas_sin_superposicion` sobre `(unidad_id, rango)` filtrando `estado='activa'` — reemplazó a `reservas_no_overlap_periodo_dia` (que no cubría período/día contra temporada) y convive con `reservas_temporada_unica_por_unidad` (redundante pero barata). Columna histórica reutilizada: `valor_total` (no `costo_total`) es la fuente real. `grupo_id` (nullable, FK a `reserva_grupos`) agrupa varias reservas del mismo cliente bajo un solo precio pactado (oct 2026, caso Ana Lescano) — con grupo_id seteado, `saldo`/`estado_pago` de ESA fila los calculan los mismos triggers (`fn_reserva_recalcula_saldo`/`fn_pago_actualiza_saldo`) pero contra `reserva_grupos.precio_total` y la suma de pagos de TODAS las reservas del grupo, nunca contra el `valor_total` individual. `monto_grupo_referencia` (legado de la migración del excel) quedó deprecado, no se usa en ningún cálculo. `preconfirmada` (boolean) y `motivo_cancelacion` (check: vencida/cliente/administracion) + `codigo` (FK a `codigos_reserva`): del sistema de reservas públicas, ver más abajo — no se agregó un `estado_reserva` nuevo, `estado` sigue siendo solo activa/cancelada.
- `temporadas`: entidad real (fecha_inicio/fecha_fin), reemplaza al string suelto `reservas.temporada`. Alta de reserva/caja nueva toma sola la que tenga `estado='activa'` (trigger, no se elige a mano en la UI). Única fuente de fechas de temporada para todo el sistema, incluido `reservas.rango`.
- `reserva_grupos`: id, cliente_id, temporada, precio_total, notas, created_at. Alta/lectura directa (mismo patrón de permisos que `reservas`, sin RPC) desde `crearGrupoReservas()` en DataProvider — acción "Agrupar reservas" en Clientes.jsx. Es la feature de **precio unificado** (varios períodos de un mismo cliente bajo un pacto) — no confundir con `codigos_reserva` (ver abajo), que es una tabla distinta para el código `PRIUS-XXXXXX` de las reservas web.
- `codigos_reserva` (oct 2026, Fase 1 reservas públicas): `codigo` (pk, `PRIUS-XXXXXX`), `metodo_pago_previsto`, `unidades_contiguas`, `lead_id`, `checkin_at`, `checkin_por`. Agrupa las 1-2 unidades de una misma reserva web bajo un solo código/QR para el check-in en Recepción (Fase 3) — `cantidad_personas` y `origen='web'` ya existen en `reservas`, no se duplican acá.
- `tarifas` (oct 2026): tipo_unidad/tipo_alquiler/metodo_pago/vigencia/precio_por_dia o precio_fijo. Vacía hasta que el dueño cargue precios — sin tarifa, `cotizar()` devuelve null y la landing no deja reservar esas fechas. El precio lo calcula siempre el servidor, nunca el cliente.
- `config_reservas_publicas` (oct 2026): fila única, `activo` es el kill switch de la landing, más `tipos_alquiler_web`, `hora_corte_noshow`, `max_unidades_por_reserva`, `max_reservas_activas_por_telefono`, `dias_anticipacion_max`. Valores provisorios, se cambian con UPDATE sin tocar código.
- `rate_limits` (oct 2026, Fase 2): contador por ventana para las Edge Functions públicas. Clave = acción + hash sha256 de IP con salt, nunca la IP en crudo. Limpieza lazy dentro de `consumir_rate_limit()`, sin pg_cron. Solo service_role.
- `reserva_clientes`: una reserva puede tener varios clientes (co-socios).
- `comprobantes`: facturas/recibos cargados manualmente; unique (tipo, punto_venta, numero); un pago puede tener varios comprobantes.
- `pagos`: fuente de verdad de ingresos. medio (no `medio_pago`, columna histórica reutilizada), tipo_pago, origen (crm / web / migracion), caja_id asignado por el sistema, cliente_id, comprobante(s) opcionales, estado vigente/anulado.
- `caja_diaria`: sesión de caja (abierta/cerrada), monto inicial (columna histórica `saldo_apertura`, no `monto_inicial`), arqueo, datos Z, resumen_snapshot congelado al cerrar. Solo una abierta a la vez (índice único parcial).
- `gastos_caja`: egresos del día por categoría y medio de pago. Columna histórica `descripcion` (no `concepto`).
- `caja_eventos`: auditoría de aperturas, cierres, reaperturas y anulaciones de caja.
- `eventos`: auditoría general (ver "Historial" más abajo) — triggers `trg_zzz_log_evento` sobre clientes/unidades/reservas/pagos/comprobantes/gastos_caja/ingresos_caja/reserva_clientes/caja_diaria/leads/temporadas, función `fn_log_evento()`. Columnas `actor_nombre`/`cliente_id`/`cliente_nombre` (oct 2026, Tarea 4): snapshot resuelto en el momento del evento (actor desde `perfiles.nombre` por `auth.uid()`, cliente desde `clientes.nombre`) — el Historial sigue legible aunque después se renombre o borre el registro real. Eventos sin usuario: si el registro tiene `origen='web'` (o la tabla es `codigos_reserva`/`leads`), `actor_nombre = 'Web (cliente)'`; cualquier otro caso sin `auth.uid()` (Edge Functions internas, triggers de sistema, lo viejo migrado) muestra `'Sistema'` — nunca vacío. Backfill de los ~1066 eventos migrados antes de oct 2026 ya aplicado: clasificados por tabla+operación (ningún evento viejo tenía `usuario`, quedaron como "Sistema"; `cliente_nombre` resuelto contra el nombre actual, no un snapshot histórico real). Los de `ingresos_caja` quedaron con `tipo_evento='migracion_historica'`, sin borrar nada.
- `ingresos_caja`: deprecada (Fase 3 de Caja) — reemplazada por `pagos.caja_id`/`cliente_id`/`concepto`. Se conserva de solo lectura por su histórico, ya no se escribe.
- `notificaciones_leidas`: estado leída/no leída por usuario de las notificaciones computadas (ver "Notificaciones" más abajo) — upsert con `ON CONFLICT DO NOTHING`, sin policy de UPDATE a propósito.
- `leads`: dos entradas. (1) Form de contacto de la landing → webhook n8n → insert en `leads` + aviso por WhatsApp vía CallMeBot. Ese flujo NO se toca: ni el form, ni n8n, ni el default `origen='landing-web'`, ni la policy de INSERT de `anon` que usa (verificado nov 2026: sigue siendo el único acceso real de `anon` a esta tabla, se mantiene a propósito). (2) Form de reservas de la landing → Edge Function `lead-reserva` → `guardar_lead_reserva()`, con `origen='reservas-web'` y sin ningún aviso — nunca por n8n ni con la anon key. `estado` (nuevo/contactado/convertido/descartado), `motivo` (contacto/form_abandonado/grupo_grande/temporada/sin_disponibilidad), `datos_form` (jsonb). La relación lead → reserva vive en `codigos_reserva.lead_id`, no al revés.
- `vistas_recientes` (oct 2026, feat-4): últimos clientes/reservas que abrió cada usuario — `usuario, entidad_tipo, entidad_id, visto_at`, unique por usuario+entidad (upsert sube `visto_at`, no duplica). RLS propias. Alimenta "Recientes" en Home.
- `preferencias_usuario` (oct 2026, feat-9): clave/valor genérico por usuario (`usuario, clave, valor jsonb`), RLS propias — primer uso: Comprobantes recuerda la última reserva elegida. Reusable para otras preferencias chicas a futuro, no crear una tabla nueva por cada una.
- Vistas/funciones: `v_reservas_saldo`, `v_caja_movimientos`, `resumen_caja(caja_id)`, `historial_entidad(...)` (RPC paginada para el Historial de una entidad puntual), `cuit_valido(text)`, `es_admin()`, `es_superadmin()`. Reservas públicas (oct 2026): `disponibilidad_publica(desde,hasta)`, `cotizar(...)`, `buscar_unidad_vecina(...)`, `reserva_activa(estado,preconfirmada,vence_at)`, `generar_codigo_reserva()`, `crear_reserva_publica(jsonb)`, `consultar_reserva_publica(codigo)`, `guardar_lead_reserva(jsonb)`, `consumir_rate_limit(...)` — ver "Sistema de reservas públicas".
- Tablas legacy en inglés de la etapa Dyad (`beach_clubs`, `admin_users`, `units`, `reservations`): ya DROPeadas (migración `drop_legacy_beachflow_tables`, 30/08/2026).
- Datos de temporada 2026-2027 migrados desde `base_de_datos_2026_Prius.xlsx`. Pagos históricos con origen = migracion (algunos con monto null pendiente de verificar contra el comprobante físico; el total vive en `reservas.valor_total`). Nunca aparecen en ninguna caja. Datos migrados que no cumplen constraints nuevos quedan con NOT VALID y se reportan, no se modifican (ej.: 5 clientes con CUIT en formato viejo sin guiones/incompleto, un puñado de `caja_diaria.saldo_apertura` negativos de la etapa pre-Fase-3).

## Módulos del CRM
Home, Plano, Cabinas y Lockers, Recepción, Reservas, Clientes, Caja, Reportes, Ocupación, Historial (antes "Línea de Tiempo"), Notificaciones, Leads, Comprobantes, Perfil.
- Recepción (`/app/recepcion`, flag 'recepcion'): check-in de reservas web por QR (html5-qrcode) o código manual (`normalizarCodigoReserva` acepta URL, código con o sin prefijo). Lista "Llegan hoy". Un botón: "Cobrar $ X y hacer check-in", vía la RPC `recepcion_cobrar(codigo, medio, cobrar, hacer_checkin, ajustar_precio)`, transaccional, con lock sobre `codigos_reserva` contra el doble cobro, un pago por reserva del código.
  - Si paga con otro método: se recalcula con `cotizar()` y queda como ajuste con motivo, nunca pisando `precio_lista`.
  - Llegada futura: "Cobrar por adelantado" sin check-in.
  - Vencida: no se cobra; se ofrece "Crear reserva nueva".
  - Check-in sin cobrar con saldo: solo superadmin.
  - Sin carga de comprobante en Recepción: link a DetallePago después del cobro.
  - Accesos: sidebar, "Más", ícono QR del TopBar, UnidadPreviewModal, y la acción "Hacer check-in" en Reservas y Clientes.
- Cabinas y Lockers (`/app/cabinas-lockers`): sección en desarrollo, debajo de Plano de Playa en Gestión Operativa, con badge "Pronto" en el menú. Es de solo lectura — no escribe nada en la base. Hoy no hay unidades `tipo='cabina'`/`'locker'` cargadas (0 registros): la página usa datos reales de `unidades` en cuanto existan, y mientras tanto muestra tarjetas de ejemplo marcadas visualmente como tales. Botones de acción deshabilitados con el texto "Próximamente".
- Ocupación (`/app/ocupacion`): vistas Semana (Gantt por unidad + % de ocupación por día) y Mes (heatmap + KPIs: ocupación promedio, día pico, unidades libres hoy, desglose por tipo), navegación anterior/siguiente/Hoy, swipe en mobile, filtro por tipo de unidad. Colores por tipo_alquiler compartidos con el Plano vía `lib/colors.ts` — único lugar que los define, Cell.jsx y Ocupacion.jsx importan de ahí.
- Historial (`/app/historial`, antes `/app/actividad` — la ruta vieja redirige): feed de auditoría de `eventos`, agrupado por día ("Hoy"/"Ayer"/fecha), con KPIs del período elegido (movimientos, cobrado, reservas nuevas, modificaciones, cancelaciones). Cada evento muestra el actor y el cliente involucrado por nombre (snapshot, ver "Estructura de datos") y, para reservas/pagos, un diff "antes → después" de los campos relevantes (fechas, monto, unidad) calculado en el front desde `datos.before/after`. Filtros de fecha, usuario y búsqueda libre persistidos en la URL, paginación real contra `eventos` (ya no los últimos 300 en memoria) — filtro explícito por unidad/cliente en la UI todavía pendiente, el hook (`useHistorial.js`) ya acepta esos params. Mismo componente `Historial.jsx` se reusa compacto en la ficha de cliente, el detalle de reserva y el modal de unidad del Plano.
- Home: sección "Recientes" (feat-4) con los últimos 5 clientes/reservas que el usuario abrió, por usuario y entre dispositivos (`vistas_recientes`, sin localStorage).
- Notificaciones: caja pendiente, llegada hoy/mañana, saldo pendiente (urgente si la llegada ya pasó o es dentro de 7 días), pendiente_confirmacion sin resolver, cancelaciones y reservas nuevas/modificadas recientes (de `eventos`, ventana de 48hs). Tabs Todas/Pagos/Reservas/Llegadas/Pendientes sobre las secciones Urgentes/Informativas. Leída/no leída persistido por usuario en `notificaciones_leidas` (no localStorage).

## Principio arquitectónico clave
Sistema cliente-céntrico y reactivo en tiempo real. Patrón "single write, multiple reactive reads": toda acción de dinero escribe una sola vez, vía RPC Postgres, en `pagos`/`gastos_caja`/`caja_diaria`; triggers y Realtime propagan a Plano (estado de unidad), Reservas (estado_pago y saldo), Caja, Reportes, Ocupación, Historial, Notificaciones y listados. `unidades.estado` se deriva siempre por trigger, nunca a mano. Ninguna pantalla tiene lógica de escritura paralela — nuevas features consumen este patrón, no inventan una segunda.

## Navegación y deep-linking
- Todo estado navegable que tenga sentido compartir o sobrevivir a un refresh vive en la URL: cliente/pago/reserva resaltados, filtros de Reservas (estado/tipo/llegada), fecha y tab de Caja, vista/fecha de Ocupación, filtros de Historial.
- Las URLs de navegación entre pantallas se arman solo con los builders de `src/lib/deepLinks.ts` (`linkToCliente`, `linkToReserva`, `linkToPlano`, `linkToOcupacion`, `linkToHistorial`). Prohibido armar esos strings a mano en componentes.
- `useDeepLinkTarget` (`src/hooks/useDeepLinkTarget.js`) consume los params al montar la pantalla, hace scrollIntoView suave y resalta el elemento con `.deep-link-highlight` (borde `#F2CA50` de 2px que se desvanece solo, sin sombra) sobre cualquier elemento con `data-deeplink-id="<id>"`. Si el registro no existe, toast discreto (`useDialog().toast`, no bloqueante) y la pantalla no se rompe.
- Destinos por tipo de entidad: un pago se ve en Clientes con el cliente abierto y la cuota resaltada; una reserva de temporada también va a Clientes (vive ahí, no en Reservas), período/día va a Reservas; una unidad va al Plano en la fecha correspondiente con la unidad resaltada.
- Toda entidad visible (cliente, unidad, reserva, pago, factura) debería ser clickeable y llevar a su destino — ver "Pendiente / en foco" por lo que falta.
- Búsqueda (Clientes por comprobante, search global del TopBar): decisión tomada de filtrar en memoria sobre los datos ya cargados en `DataProvider`, no contra la base — toda la app ya trae clientes/reservas/pagos completos a memoria para el patrón realtime, y el resto de cada buscador ya filtraba así; un segundo camino de lectura solo para un campo rompería esa consistencia sin necesidad real a esta escala (un par de cientos de clientes). No agregar un query a Supabase para buscar texto salvo que el volumen de datos lo justifique de verdad.

## Overlays (regla global, oct 2026)
- Todo lo que se superpone en Z (search dropdown, menú de usuario, panel de notificaciones, popovers, dropdowns, date pickers, modales, bottom sheets) se cierra con click/tap afuera y con Escape, vía un mecanismo central único: `OverlayProvider`/`useOverlay()` (`src/context/OverlayProvider.jsx`), montado una vez en `AppLayout.jsx`. Prohibido agregar un `document.addEventListener('mousedown'/'keydown', ...)` propio en un overlay nuevo — registrarlo con `useOverlay` en cambio.
- Un solo overlay de primer nivel abierto a la vez: abrir uno nuevo cierra cualquier otro que no sea su padre. El anidado (ej. un `DateInput` o un `BrandSelect` dentro de un `Modal`) se detecta solo por contención DOM del trigger — no hace falta wiring manual salvo que el overlay no tenga un trigger clickeable visible (ej. el `confirm()`/`alert()` de `DialogProvider`, que se dispara desde código: ahí sí hay que pasar `parentId` explícito, ver `useOverlayTop()`).
- Cada overlay registra su "territorio" (trigger + panel + contenido en portal) con el ref callback `bind` que devuelve `useOverlay` — un click en cualquiera de esos nodos no cuenta como "afuera", sin importar si ese nodo vive en un portal separado (mismo problema que el bug real de `DateInput.tsx`: el calendario vive en un portal a `document.body`, fuera del subárbol del input — si un overlay nuevo no registra el nodo del portal, clickear adentro lo cierra solo, o peor, cierra al padre si está anidado en un Modal).
- El click que cierra un overlay se frena ahí (el listener global es en fase de captura): no sigue cerrando overlays de más abajo ni dispara además el `onClick` del elemento de abajo.
- Modales con formulario (Nueva/Editar reserva, RegistrarPago, CerrarCajaStepper): si hay cambios sin guardar, cerrar por click afuera o Escape pide "¿Descartar cambios?" antes — prop `isDirty` en `Modal.jsx` (función que devuelve true/false), o el mismo patrón armado a mano en los que no usan `Modal.jsx` (ej. `CerrarCajaStepper.jsx`). Sin `isDirty`, cierra directo como siempre.
- Migrados: TopBar (search, notificaciones, menú de usuario, búsqueda mobile), `Modal.jsx` (base de la mayoría de los modales), `DateInput.tsx`, `BrandSelect.tsx`, `DialogProvider` (confirm/alert), `ConfirmDeleteModal.jsx`, `UnidadPreviewModal.jsx`, `BottomNav` ("Más"), `CerrarCajaStepper.jsx`, filtros de Reservas/Clientes. No migrado a propósito: `ClienteSelector.jsx` (su dropdown no usa portal, ya es descendiente DOM de su contenedor, no tiene el bug de contención).

## Flujo de dinero (reglas de negocio)
- Los cobros se registran solo desde Clientes, Reservas (incluida el alta con seña inicial), el modal de unidad del Plano, con el componente compartido `RegistrarPago`, o desde Recepción (vía `recepcion_cobrar`, que usa `registrar_pago` por dentro para cada reserva del código). Nunca desde la Caja: se evita la doble carga. El modal de unidad del Plano (`UnidadPreviewModal.jsx`) es de solo lectura por diseño — en la práctica hoy `RegistrarPago` se usa desde Clientes y Reservas.
- Cada cobro se asigna automáticamente a la caja abierta. Cobros del CRM requieren caja abierta (si no hay, el front ofrece abrirla y reintenta sin perder datos, código de error `P0003`). Cobros web entrados con caja cerrada se asignan a la próxima caja que se abra.
- El CRM no factura: el administrador emite factura/recibo por fuera (ARCA/controlador fiscal) y carga sus datos en el cobro. El comprobante puede cargarse o editarse después desde `DetallePago` (mismo componente desde Caja, Cliente o Reserva; agregado oct 2026: también enlaza de vuelta al cliente del pago).
- En la Caja solo se escribe: apertura, gastos, cierre (arqueo + Z opcional) y reapertura (solo superadmin vía `es_superadmin()`, auditada en `caja_eventos`).
- Nada se borra: pagos y gastos se anulan con motivo, solo con su caja abierta.
- Fecha de caja en zona America/Argentina/Buenos_Aires.
- Resumen del día: pantalla (`ResumenCaja.jsx`), impresión A4 (`CajaImpresion.jsx`) y CSV (`lib/caja.js`) salen todos de `resumen_caja(caja_id)` (congelado en `resumen_snapshot` al cerrar) y deben coincidir exactamente. Incluye totales, medios de pago, arqueo, Z vs registrado, facturas, recibos, pagos sin comprobante, gastos, anulados y firmas.
- CSV: UTF-8 con BOM, separador `;`, columna `seccion`, monto como entero plano (única excepción al formato `$`).

## Decisiones de UX

### Estados de reserva: un solo indicador
Cada reserva muestra un único badge de estado, nunca repetido en la misma vista. Si `bonificada = true`, el badge es siempre "Bonificada" (tono cyan) y reemplaza por completo al de `estado_pago` — nunca conviven ni se decide entre los dos por separado (ver `lib/reservas.js` `estadoBadgeStatus`, único lugar que resuelve cuál mostrar). Si no es bonificada, labels por `estado_pago`: `pendiente_confirmacion` → "Sin confirmar", `parcial` → "Seña parcial", `pagado` → "Pagado", `pendiente` → "Sin pago". Al lado del badge, como máximo una acción primaria contextual: `pendiente_confirmacion` → "Confirmar temporada"; `parcial` o `pendiente` → "Registrar pago". Una reserva bonificada no muestra ninguna acción primaria de cobro.

### Nunca mostrar "$ 0"
En Clientes, Reservas y el modal de unidad del Plano, un monto nunca se muestra en "$ 0": se muestra el monto formateado solo si es mayor a 0 (`formatPesosVisible` en `lib/format.ts`, no formatear a mano); si es 0 (reserva pagada, saldada o bonificada), no se muestra nada en esa posición — ni "$ 0" ni un texto de reemplazo tipo "Saldado" — y el layout mantiene el espacio reservado. Excepción explícita: en Caja y Reportes un total en $0 sí es un dato real del día/período y se muestra tal cual.

### Ficha de cliente (dropdown en Clientes)
- El header colapsado muestra nombre, teléfono, unidad(es), badge de estado y saldo ("Sin precio" si no hay precio definido; nunca "$ 0"). Comprobante que matcheó la búsqueda (Tarea 3, oct 2026): línea extra bajo el nombre tipo "Comprobante FB-727 · $85.000 · 14/10/2026", clickeable para saltar a esa cuota resaltada. Búsqueda normaliza el número de comprobante (sin guiones/espacios/ceros a la izquierda), match parcial.
- Unidad(es) del header: emoji + número alineados sobre la misma línea base, número al menos del tamaño del nombre del cliente.
- El panel expandido no repite datos del header; solo agrega CUIT/DNI, Cliente desde y el detalle de reservas y pagos.
- Campos vacíos se muestran como "Sin cargar" en gris, no con guion (incluye teléfono).
- Monto con comprobante cargado pero sin poder leer el importe real: "Monto nulo" en rojo, una sola línea sin quiebre — aplica tanto al saldo del header como a las celdas de la grilla de pagos. Excepción: si la reserva que decide el badge está pagada o bonificada, ese saldo en $0 es real, no se muestra "Monto nulo".
- Pagos sin precio definido: empty state corto con botón "Definir precio" (no aplica a una reserva bonificada).
- Grilla de pagos por reserva (`PagosGrid.jsx`): sin cantidad fija de columnas — Precio venta (no se renderiza si es $0), una celda "Cuota N" por cada pago ya registrado y una sola celda "+ Cargar" después del último, y Saldo. Bonificada: una sola línea, "Carpa bonificada — no registra pagos." Saldada: sin celda "+ Cargar", Saldo dice "Unidad saldada", cuotas bloqueadas para todos los usuarios.

### Modal de unidad en el Plano: preview, con dos excepciones inline
- El modal de unidad (`UnidadPreviewModal.jsx`) es mayormente de solo lectura — no dispara `RegistrarPago` desde ahí.
- Muestra: datos de la unidad, estado derivado, reserva actual (titular, co-socios, tipo, fechas, estado, total/pagado/saldo, notas) e historial de la temporada.
- La mayoría de la edición/alta sigue enrutando: "Nueva reserva por período o día" (Reservas, con la unidad precargada por params); unidad con reserva de período/día → detalle de la reserva.
- Excepciones agregadas oct 2026, resuelven inline sin salir del Plano (`onAsignarTemporada`/`onMoverUnidad`, manejadas en `Dashboard.jsx`):
  - Unidad libre → "Asignar cliente de temporada" abre `AsignarUnidadModal.jsx`: combobox de cliente existente o alta inline (`ClienteSelector.jsx`, mismo componente que Reservas.jsx) + precio/bonificada, crea la reserva de temporada directo.
  - Unidad con reserva de temporada activa (no bloqueada) → "Mover a otra unidad" abre `MoverUnidadDialog.jsx`: pide la contraseña del superadmin logueado y llama al RPC `mover_unidad_temporada` (SECURITY DEFINER, valida rol y contraseña server-side).
- Unidad con reserva de temporada → además de mover, ficha del cliente para todo lo demás (pagos, notas, liberar).
- "Ver todas" del historial de la temporada filtra Reservas por esa unidad (`?filtroUnidad=<uuid>`) e incluye también sus reservas de `tipo_alquiler = temporada`.
- Desktop: modal centrado. Mobile: bottom sheet de altura completa con acciones fijas abajo.
- Se alimenta de la misma suscripción Realtime del Plano, incluido el deep-link `linkToPlano(fecha, unidadId)` que la abre directo con la unidad resaltada.
- `UnitModal.jsx` (el viejo modal de alta/edición que este preview reemplazó) quedó desconectado a propósito — no lo importa ninguna pantalla. No borrar ni reconectar sin confirmar antes.
- `ClienteSelector.jsx` (`src/components/crm/`): combobox de cliente + alta inline validada (mismas reglas que Clientes.jsx, `lib/validators/cliente.ts`) — único componente para elegir/crear cliente en toda la app.

### Modal "Nueva reserva" (Reservas.jsx)
Desde oct 2026: dos columnas en desktop (cliente/unidad/fechas a la izquierda, precio/resumen a la derecha) para entrar completo en 1366x768 sin scroll o con scroll interno mínimo; resumen fijo (unidad, fechas, días, total, saldo) y "Más opciones" (notas + historial) colapsado por defecto. Footer sticky con total a la izquierda y Cancelar/Crear reserva a la derecha — el botón de submit vive ahí vía el atributo HTML `form`, pero sigue disparando el mismo `<form onSubmit>` de siempre.

## Disponibilidad y no-solapamiento de reservas
- Ninguna reserva activa (día, período o temporada) puede solaparse con otra en la misma unidad — un solo exclusion constraint de Postgres (`reservas_sin_superposicion`, GiST sobre `unidad_id` + `rango`), filtrando `estado='activa'`. `rango` se calcula solo (trigger `fn_reserva_calcula_rango`) según `tipo_alquiler`; para temporada toma las fechas de `temporadas` vía `temporada_id`. Esto cubre también el caso que antes no estaba protegido a nivel DB: un período o día superpuesto con una temporada activa en la misma unidad.
- El selector de fecha del Plano recalcula la disponibilidad real de cada unidad contra las reservas que se solapen con la fecha elegida — no alcanza con mirar `unidades.estado` actual.
- Candado en reservas: columna `bloqueada` (boolean, default `false`), aplicable a cualquier tipo_alquiler. Con `bloqueada = true`, la UI deshabilita la edición de fecha y unidad (cliente y pagos se pueden seguir editando). Desbloquear requiere un modal de confirmación explícito.
- Calendario de nueva reserva / edición: el date picker (`DateInput.tsx`) marca (tachado) los días ya ocupados para la unidad seleccionada y bloquea su selección dinámicamente — misma lógica de rangos que el constraint de no-solapamiento. El calendario se renderiza en un portal a `document.body`: si se agrega lógica de cierre por click-afuera, hay que chequear contra un ref que cubra también el contenido del portal, no solo el wrapper del input (bug real corregido oct 2026 — cualquier click adentro del calendario lo cerraba de golpe).

## Borrado de datos raíz
- Reservas: dos acciones distintas. "Cancelar reserva" es soft delete (`estado` → `cancelada`), libera la unidad y el rango de fechas, no borra la fila ni sus `pagos`. "Eliminar definitivamente" es hard delete real: borra `reservas` y sus `pagos` asociados en una transacción, nunca toca `clientes`. Si la reserva está `bloqueada`, cualquiera de las dos acciones exige pasar primero por el flujo de desbloqueo.
- Confirmación reforzada: cualquier borrado de `reservas`, `clientes` o `unidades` usa `ConfirmDeleteModal`, que exige tipear el identificador exacto para habilitar el botón. Reemplaza cualquier `window.confirm`.
- Anulaciones (pagos, gastos): motivo obligatorio 5–200 caracteres, solo con la caja de ese movimiento abierta (si está cerrada, hay que reabrirla primero).

## Formato y validación de datos (obligatorio en toda la app)
- Pesos: montos enteros, sin centavos. Formato único `$ 1.089.000`; negativos `−$ 15.000` (signo menos real U+2212); cero `$ 0`. Nunca abreviar. tabular-nums y alineado a la derecha en tablas. Única excepción: CSV con entero plano. En la base, CHECK monto = round(monto) en pagos/gastos_caja/reservas/caja_diaria.
- Fechas: `30/09/2026`, `30/09/2026 08:12`, rangos estilo carpero `27/12 al 09/01` (sin año, incluso cruzando dic→ene dentro de la misma temporada; con año solo si el rango no pertenece a la temporada activa). Siempre en zona America/Argentina/Buenos_Aires, nunca la del navegador — las columnas `date` puras (`yyyy-mm-dd`) se anclan a mediodía UTC antes de formatear para no correrse un día.
- DNI `30.123.456` (7–8 dígitos, se guarda solo dígitos, único entre clientes). CUIT `20-30123456-7` (11 dígitos, dígito verificador módulo 11, función `cuit_valido()` espejada en `lib/parse.ts` y en SQL). Teléfono guardado en E.164, mostrado `+54 9 223 512-3456`. Comprobante `FB-727` (ver "Vocabulario de dominio"), buscable normalizado (`normalizarNumeroComprobante()` en `lib/parse.ts`). Unidad `Carpa 19`. Código de reserva `PRIUS-A3X9K2`.
- Nombres normalizados (capitalización con partículas en minúscula — de/del/la/las/los/y salvo al inicio —, ´/` → ').
- Única fuente de verdad: `src/lib/format.ts` (mostrar), `src/lib/parse.ts` (parsear/normalizar/validar), `src/lib/validators/` (zod por entidad, en progreso), `src/lib/colors.ts` (colores por tipo_alquiler, compartido Plano/Ocupación) y componentes en `src/components/inputs/` (`MoneyInput`, `IntegerInput`, `DniInput`, `CuitInput`, `PhoneInput`, `DateInput` construidos; `ComprobanteInput`, `TextInput`, `SearchInput`, `SelectChips` pendientes).
- Prohibido: `input type="number"` y `type="date"` nativos, `toLocaleString`/`Intl`/`toFixed` fuera de `format.ts`/`parse.ts` — barrido completo de la app todavía en progreso (hecho: Caja apertura, DateInput en Reservas/Ocupación/Historial; pendiente: el resto de los inputs de Clientes/UnitModal/Perfil/login, más la regla de ESLint que lo prohíba automáticamente).
- Validación en dos capas con las mismas reglas: zod en el front (parcial), CHECK + funciones en la base (`cuit_valido`, rangos de DNI/CUIT/cantidad de personas/montos/comprobantes). Errores de la base pendientes de mapear campo a campo en el front (hoy se muestran como alert genérico en varios flujos).
- UX de validación objetivo: onBlur y luego en vivo; error inline debajo del campo; teclado correcto en mobile; confirmación explícita para montos inusuales o que superan el saldo.
- Datos verídicos: sin mocks ni valores hardcodeados (la única pantalla con tarjetas de ejemplo es Cabinas y Lockers, marcada como tal a propósito); placeholders de formato obvios ("Ej: 30.123.456"); estados vacíos en lugar de ceros inventados.

## Sistema de reservas públicas (sin auth) — Fases 1 (DB), 2 (Edge Functions) y 3 (Recepción) hechas, oct 2026
Roadmap: 1) DB — hecha. 2) Edge Functions (crear-reserva-publica, consultar-reserva, lead-reserva) — hecha. 3) Recepción en el CRM (check-in por QR/código) — hecha. 4) Landing: form step-by-step + plano en vivo. 5) Entrega del QR (pantalla, /r/código, email, wa.me). 6) Bandeja de leads en el CRM. 7) Recordatorios WhatsApp + seña Mercado Pago.

**Recepción (Fase 3, oct 2026)**: semántica de `preconfirmada` — `true` significa "sin compromiso, puede vencer" por `vence_at`. Cuando el saldo de la reserva llega a 0 por cualquier camino (Recepción o un pago cargado directo desde Clientes), pasa a `false` — mismo trigger que ya recalcula saldo (`fn_pago_actualiza_saldo`/`fn_reserva_recalcula_saldo`), sin lógica duplicada: una reserva paga nunca vence. El check-in (llegada física) es `codigos_reserva.checkin_at`, independiente del pago — el pago online futuro usará la misma regla de `preconfirmada`.
- Front: `reservaActiva(reserva, ahora)` en `lib/reservas.js` es el espejo exacto de `reserva_activa()` en SQL, y es el único criterio de "esta reserva ocupa la unidad" por fecha — lo usan Plano (`Dashboard.jsx`), Ocupación y el selector de fecha (`rangosOcupadosPorUnidad`). Mantener sincronizados a mano si cambia uno de los dos lados.
- Badge (ver "Estados de reserva: un solo indicador"): preconfirmada vigente → "Preconfirmada" (reemplaza al de estado_pago, como Bonificada), con acción primaria "Hacer check-in" que lleva a `/app/recepcion?codigo=...`; vencida por `vence_at` sin check-in → "Vencida", sin acción. Resuelto solo en `estadoBadgeStatus` (`lib/reservas.js`).
- Plano: la reserva web preconfirmada vigente se marca con borde punteado e ícono de reloj en la celda (`Cell.jsx`, prop `esPreconfirmadaWeb`), sin colores nuevos — `PlanoImpresion.jsx` no se tocó, la letra T/P/D alcanza en blanco y negro.
- RPC `recepcion_cobrar(codigo, medio, cobrar, hacer_checkin, ajustar_precio)`: transaccional, lock `for update` sobre la fila de `codigos_reserva` (evita el doble cobro desde dos dispositivos), un `registrar_pago` por reserva del código con saldo > 0. El ajuste de precio por método distinto al previsto escribe `ajuste`/`ajuste_motivo` y `valor_total` (deja `precio_lista` intacto) — mismo mecanismo que recalcula `saldo` vía trigger. Check-in sin cobrar con saldo pendiente exige `es_superadmin()`.

Sin login para el cliente final, mismo proyecto Supabase, sincronizado en tiempo real. El requisito central de la landing: renderizar el mismo plano diario del CRM (misma grilla `fila`/`orden`), filtrado por las fechas elegidas, sin ningún dato de clientes — toda unidad ocupada aparece con candado, las libres son seleccionables.

- **Disponibilidad**: RPC `disponibilidad_publica(desde, hasta)` devuelve TODAS las unidades (id, numero, tipo, fila, orden, capacidad, bloqueada) calculado contra `reservas.rango` para el rango pedido — nunca contra `unidades.estado`, que solo refleja hoy. `bloqueada` cubre: cualquier reserva activa que se superponga (día/período/temporada), bonificadas, pendiente_confirmacion, preconfirmadas web no vencidas, y unidades con `habilitada_web = false` (hoy cabina/locker, sin unidades reales todavía).
- **Ciclo de vida sin estado nuevo**: no se agregó un `estado_reserva` — `reservas.estado` sigue siendo solo `activa`/`cancelada`. Una reserva web nace `activa` con `preconfirmada = true`. El check-in en Recepción (Fase 3) pone `preconfirmada = false`, y desde ahí `vence_at` deja de importar. `reservas.vence_at` (timestamptz, Fase 2) es el vencimiento explícito de una preconfirmada: hoy se setea en el momento de crear la reserva como `inicio + hora_corte_noshow`; con pago online futuro será un hold corto (minutos) hasta que el webhook confirme el pago. Vencerla (pasado `vence_at` sin check-in) es pasarla a `estado = 'cancelada'` con `motivo_cancelacion = 'vencida'` — lo hace `crear_reserva_publica` de forma lazy, solo sobre las unidades que una nueva reserva está pidiendo, antes de insertar (sin pg_cron). Única definición de "esta reserva ocupa la unidad": `reserva_activa(estado, preconfirmada, vence_at)`, usada por `disponibilidad_publica`, `crear_reserva_publica` y `consultar_reserva_publica` — nadie reimplementa el criterio.
- **Precio**: lo calcula siempre el servidor con `cotizar(tipo_unidad, tipo_alquiler, metodo_pago, desde, hasta)`, nunca el cliente. Sin tarifa cargada en `tarifas`, devuelve null y no se puede reservar esas fechas. Varía por método de pago, y queda congelado en `reservas.valor_total` con el método previsto al momento de reservar — si en Recepción paga con otro método, el ajuste se resuelve en la Fase 3.
- **Capacidad**: unidades estrictas = `ceil(personas / capacidad)`, máximo `config_reservas_publicas.max_unidades_por_reserva`; si se supera, el cliente va a contacto (lead `grupo_grande`). Si hace falta una segunda unidad y no vino elegida, se asigna con `buscar_unidad_vecina(unidad, desde, hasta)` — contigua (misma fila, orden ±1) > más cercana de la misma fila > cualquiera libre (con `codigos_reserva.unidades_contiguas = false` como aviso a Recepción).
- **Código y grupo web**: `codigos_reserva` (código `PRIUS-XXXXXX`, generado por `generar_codigo_reserva()`) agrupa las 1-2 unidades de una reserva vía `reservas.codigo` — tabla distinta de `reserva_grupos` (que es la feature de precio unificado del CRM, sin relación). Una reserva web de 2 unidades NO usa `reserva_grupos`: cada reserva lleva su propio `valor_total`. En Recepción (Fase 3), "Cobrar y hacer check-in" registra un pago por cada reserva del código, en una sola acción.
- **Cliente**: match en este orden — DNI de un cliente existente → teléfono E.164 del cliente más reciente con ese número → alta nueva. La web nunca modifica datos de un cliente existente.
- **Tiempo real**: Broadcast público (no postgres_changes, anon no puede suscribirse a esos) — triggers `reservas_broadcast_disponibilidad` (AFTER INSERT/UPDATE/DELETE, FOR EACH STATEMENT) y `unidades_broadcast_disponibilidad` (AFTER UPDATE OF habilitada_web/fila/orden/capacidad, para no loopear con el trigger que deriva `estado`) emiten por el canal `disponibilidad`, evento `cambio`, payload sin datos personales (`{tabla: ...}`). La landing re-consulta `disponibilidad_publica` al recibirlo, con debounce ~500ms. El CRM sigue con su suscripción de siempre, sin cambios.
- Kill switch: `config_reservas_publicas.activo = false` → la landing no acepta reservas.
- **Seguridad crítica**: todos los writes públicos pasan por Edge Functions (service role) con rate limiting, nunca inserts directos. `anon` solo ejecuta `disponibilidad_publica`, `cotizar`, `buscar_unidad_vecina` y lee `config_reservas_publicas` — sin acceso a `clientes`, `reservas`, `pagos` ni ninguna tabla de dinero (revocado explícitamente, no solo por RLS). El INSERT de `anon` en `leads` es aparte, del form de contacto de n8n (ver "Estructura de datos"), no de este sistema. Toda tabla y función nueva de esta fase trae su revoke a `anon` explícito en la misma migración, no se asume el default de Supabase.
- Código de reserva vía QR: `https://priusplayagrande.com.ar/r/PRIUS-XXXXXX`, generado del lado cliente (librería `qrcode`); staff confirma por escaneo (`jsQR`/`html5-qrcode`) o código manual — pendiente de Fase 3.

**Edge Functions (Fase 2)**: `crear-reserva-publica`, `consultar-reserva` y `lead-reserva`, en `supabase/functions/`.
- Cada una: CORS por `ALLOWED_ORIGINS` → rate limit por IP hasheada (crear 5/h, consultar 30/10min, lead 20/h) → Cloudflare Turnstile (excepto consultar) → validación zod + normalización con `_shared/parse.ts` (espejo de `src/lib/parse.ts`, mantener sincronizado) → una sola RPC SQL con service_role. Nunca queries sueltas a tablas.
- Toda la lógica de negocio vive en Postgres, en una transacción: `crear_reserva_publica(jsonb)`, `consultar_reserva_publica(codigo)`, `guardar_lead_reserva(jsonb)` — execute solo service_role.
- Respuestas: 200 `{ok:true,...}` o `{ok:false,error,mensaje}` para errores de negocio (códigos: reservas_desactivadas, tipo_no_habilitado, fechas_invalidas, fuera_de_temporada, fuera_de_anticipacion, corte_horario_hoy, capacidad_excedida, unidades_invalidas, unidad_no_disponible, sin_vecina_disponible, limite_por_telefono, sin_tarifa, no_encontrada); 400 datos_invalidos; 403 captcha_invalido; 429 rate_limited; 500 interno con mensaje genérico.
- Secrets: `TURNSTILE_SECRET_KEY` (hoy la clave de prueba de Cloudflare, reemplazar por la real antes de activar), `RATE_LIMIT_SALT`, `ALLOWED_ORIGINS`.
- Concurrencia: lock de las filas de `unidades` + exclusion constraint `reservas_sin_superposicion`. Dos clientes sobre la misma carpa: entra uno solo, el otro recibe `unidad_no_disponible`.
- Nada de este sistema manda WhatsApp ni avisos (decisión del dueño del proyecto) — ni las reservas web ni los leads del form de reservas. Las reservas web aparecen en el CRM por Realtime, Historial y Notificaciones, como cualquier reserva.

**Preparado para pago online y facturación ARCA (futuro, NO implementado — no cerrarle la puerta)**
- Regla: nada del sistema de reservas públicas puede asumir que una reserva web nunca tiene pago. Toda pieza nueva tiene que funcionar igual si el pago llega online.
- Pago online (Mercado Pago, candidata): ya existen `pagos.medio = 'mercado_pago'`, `pagos.origen = 'web'`, tarifas por método (incluye mercado_pago) y la regla de caja "cobros web con caja cerrada van a la próxima caja que se abra". El `codigos_reserva.codigo` va a ser el external_reference del pago.
  - Flujo previsto: `crear-reserva-publica` crea la reserva con `vence_at` corto → Edge Function crea la preferencia de pago → webhook idempotente de Mercado Pago → RPC de pago web.
  - El RPC de pago web es nuevo, porque `registrar_pago` exige usuario del CRM. Registra el pago (dispara caja por el patrón single write), pone `preconfirmada = false` si cubre lo exigido, y si el pago no llega, la reserva vence sola por `vence_at`.
  - A agregar en ese momento: columna de id de pago externo en `pagos` con unique (idempotencia del webhook). Una seña online se apoya en `saldo`/`estado_pago = parcial`, que ya existen.
- Facturación ARCA: `clientes` ya tiene `condicion_iva`, `cuit`, `razon_social`, y `comprobantes` ya modela FA/FB/FC.
  - A agregar en ese momento: CAE, vencimiento del CAE y punto de venta electrónico en `comprobantes`.
  - La emisión se dispara a partir del pago registrado (single write → reacción), vía WSFEv1 o un servicio intermediario, desde una Edge Function, nunca desde el navegador.
  - Requiere CUIT, certificado digital y punto de venta electrónico habilitado del dueño.
- Datos del form web: el email es obligatorio desde la Fase 4. Lo necesita la entrega del QR (Fase 5), y en el futuro el pago online y el envío de la factura. El DNI queda opcional por ahora; con facturación pasará a pedirse, con la opción de factura A con CUIT.

## Seguridad
- Escrituras de dinero solo vía RPC security definer con search_path fijo; sin insert/update/delete directos para authenticated en pagos, comprobantes, gastos_caja, caja_diaria (revocado, solo SELECT + RPC).
- Permisos centralizados en `es_admin()`/`es_superadmin()` + la matriz de `lib/permisos.ts` (ver "Roles") — ya no es "cualquier autenticado", hay roles reales desde oct 2026.
- Login con mensajes de error genéricos (no revelar si el email existe).
- `anon` sin acceso de ningún tipo (ni siquiera a nivel GRANT, no solo RLS) a `clientes`, `reservas`, `reserva_clientes`, `reserva_grupos`, `codigos_reserva`, `pagos`, `caja_diaria`, `gastos_caja`, `comprobantes`, `caja_eventos`, `ingresos_caja`, `eventos`, `perfiles`, `temporadas`, `unidades`, `tarifas`, `notificaciones_leidas`, `vistas_recientes`, `preferencias_usuario`, ni a `leads` fuera de su INSERT (oct 2026). Toda tabla o función nueva revoca a `anon` explícitamente en su propia migración — no depender del default de Supabase (que da grants amplios a tablas nuevas).

## Diseño ("Quiet Luxury")
- Colores de marca: `#FFFFFF`, `#F2CA50` (acento con moderación), `#000000`, `#E5E5E5`. Tipografía Inter. Estética plana: sin sombras, sin gradientes. Montos con tabular-nums.
- Implementación actual del CRM: tema "Glass Dark" (fondo oscuro, tarjetas semi-transparentes `.glass-card` sin backdrop-filter por rendimiento, acento dorado `#FDE047`) — es la paleta realmente implementada hoy; se mantiene por consistencia en vez de migrar a fondo blanco literal. Badges de estado usan pastel claro (`bg-green-50 text-green-700`, etc.) como chips de acento sobre el fondo oscuro, no como cambio de tema. El amarillo/dorado es acento puntual (hoy, selección, resaltado de deep-link), nunca relleno de grandes superficies ni líneas repetidas.

### Layout
El contenido de cada página ocupa todo el ancho disponible entre el sidebar y el borde derecho — nunca max-width ni centrado (`mx-auto`) a nivel de página. El padding horizontal (`px-4 sm:px-6 md:px-8`) se define una única vez en `AppLayout.jsx` (el `<main>`) y es idéntico al de `TopBar.jsx`.

### Mobile-first (prioridad absoluta)
Tiene que sentirse como una app nativa, no una web responsive achicada. Diseño base 360px, escalado hacia arriba (verificar 360/390/768/1024/1440/1920).
- Navegación: `Sidebar.jsx` oculto en mobile (`hidden md:flex`), `BottomNav.jsx` fijo con 5 ítems (Inicio, Plano, Reservas, Clientes, Más — resalta activo en amarillo, respeta `env(safe-area-inset-bottom)`). "Más" abre bottom sheet con Caja Diaria, Reportes, Cabinas y Lockers, Ocupación, Historial, módulos adicionales y Cerrar sesión.
- Header mobile (`TopBar.jsx`): título + avatar; buscador inline de desktop pasa a ícono que abre búsqueda a pantalla completa; campana de notificaciones siempre visible.
- Tablas → tarjetas: `hidden md:block`/`md:hidden`, o el prop `renderMobileCard` de `DataTable.jsx`.
- Modales → bottom sheet: `Modal.jsx` y `UnidadPreviewModal.jsx` en mobile son bottom sheet de altura completa con gesto de cierre arriba; en desktop centrados. `Modal.jsx` acepta `maxWidthClass`/`footer` opcionales (default = comportamiento de siempre) para modales anchos con footer sticky, como "Nueva reserva".
- FAB para la acción principal de una pantalla (ej. "Registrar gasto" en Caja).
- Tamaño táctil mínimo: 44×44px en todo lo clickeable. Nada que dependa solo de `:hover`.
- Plano: pinch-to-zoom táctil sobre el estado `zoom` que usan los botones +/-/reset. Ocupación: swipe horizontal para cambiar de semana/mes. Notificaciones: swipe para marcar como leída.

Layout del plano de carpas: 6 hileras y 3 pasillos. Hilera 1–25 sola (número izq). Pasillo A. Bloque 26–50 (número izq) + 51–75 (número der) espalda con espalda. Pasillo B (central, acceso, más ancho). Bloque 76–98 (número izq) + 99–121 (número der). Pasillo C. Hilera 122–144 (número der). Números siempre por fuera de los bloques. Sector Sombrillas: layout fijo. La numeración de carpas y sombrillas es la real del balneario y nunca se altera.

Desde oct 2026 esta posición vive también en la base (`unidades.fila`/`orden`, poblada en Fase 1 de reservas públicas) como fuente única para el CRM y la landing — el componente del plano del CRM (`Dashboard.jsx`/`PlanoImpresion.jsx`) no se tocó, sigue dibujando con sus rangos fijos de siempre. Mapeo aplicado: carpas fila 1=1-25, fila 2=26-50, fila 3=51-75, fila 4=76-98, fila 5=99-121, fila 6=122-144 (orden = número relativo al inicio de cada fila, ascendente izq→der, verificado contra el JSX real — ninguna hilera se dibuja invertida ni desplazada). Sombrillas en 4 filas (7 a 10), dos columnas lado a lado con hueco en el medio: fila 7 = sombrillas 1-5 (orden 1-5) y 21-25 (orden 7-11), fila 8 = 6-10 y 26-30, fila 9 = 11-15 y 31-35, fila 10 = 16-20 y 36-40. "Vecina contigua" = misma fila y `abs(orden)=1`; una unidad del otro lado de un pasillo nunca es contigua.

### Instalable como app
`public/manifest.webmanifest` + meta tags iOS en `index.html` para agregar a pantalla de inicio sin barra del navegador. Sin service worker ni cache offline a propósito: la app depende de Realtime, cachear una vista vieja sería peor que no tener nada.

### Impresión A4 (componente dedicado, sin UI, encabezados de tabla repetidos, sin cortar filas)
- Plano (`PlanoImpresion.jsx`): una hoja A4 vertical para los carperos, blanco y negro estricto. Fecha arriba a la izquierda, plano con el mismo layout que en pantalla, letra T/P/D en cada casilla ocupada. Debajo del océano, listado de períodos y días activos ese día en dos columnas (carpas izq., sombrillas der.), formato "C.01 Nombre del dd/mm al dd/mm/aa". Nunca más de una hoja.
- Caja (`CajaImpresion.jsx`): resumen del día, blanco y negro con acento dorado mínimo, mismas secciones que `ResumenCaja.jsx` (totales, por medio, arqueo, Z, facturas, recibos, sin comprobante, gastos, anulados, firmas), alimentado por `resumen_caja(caja_id)`.

## Feature flags
`src/lib/features.ts` — un booleano por feature (`isFeatureEnabled(key)`), todas en `true` por defecto. Toda feature nueva marcada como aditiva (las de la Tarea 6, oct 2026: search mejorado, acciones rápidas, drawer de cliente, recientes en Home, ir a fecha, filtros en URL de Caja/Leads, recordar config de Comprobantes) se registra ahí ANTES de implementarse, y apagarla tiene que dejar la pantalla exactamente como estaba antes de esa feature (vuelve al `useState` local de siempre, no rompe nada ni queda a mitad de camino) — ver `useFeatureUrlState()` (hooks/) como patrón para "URL si la feature está prendida, estado local si no". No todas las features usan el flag en cada punto donde tocan código (ej. el drawer de cliente wrappea la navegación existente, no la reemplaza en runtime) — revisar el flag antes de asumir que algo está activo.

## Comprobantes (oct 2026)
- Un único componente presentacional ComprobanteDocumento (props: datos, modo color|bn, tipo estado_cuenta|recibo) para vista previa e impresión.
- Impresión vía iframe aislado + window.print. Prohibido html2canvas/jsPDF para comprobantes. @page A4 margin 0, fondo blanco, print-color-adjust exact.
- Modo Color/B y N elegible por el usuario y persistido en localStorage. La vista previa es WYSIWYG.
- Logo en documentos impresos: P de Prius negra. No existe SVG de marca (solo PNG) — se usa `/prius-icon.png` con `filter: grayscale(1) brightness(0)` para forzarla a negro sólido sin el cuadrado amarillo de fondo. Migrar a SVG inline si en algún momento aparece el vectorial original.
- Validación previa obligatoria (cliente, unidad, montos coherentes) antes de emitir.
- Numeración correlativa por temporada generada en Postgres. Cada emisión guarda un snapshot en comprobantes_emitidos y las reimpresiones usan el snapshot.
- Deep link /app/comprobantes?reserva=<id>, accesible desde Reservas y Clientes.
- Los pagos históricos pre-CRM aparecen en los comprobantes aunque no impacten la caja diaria.

## Plano — stats y clima (oct 2026)
- PlanoStatsBar en la franja superior del Plano (normal y fullscreen): ocupación general, carpas, sombrillas, mix por tipo de alquiler, pendientes de pago, libres, ingresos del día y clima. Se calcula con useMemo sobre los datos ya cargados, sin queries extra.
- Los chips filtran o resaltan unidades en el plano; es solo visual.
- Clima: Open-Meteo (forecast + marine) vía la Edge Function clima-playa, con caché de 30 min. Alerta de viento con umbral configurable.
- Configuración de clima centralizada en src/config/clima.ts: spot y coordenadas compartidas por Open-Meteo y Windguru.
- Windguru: solo el widget oficial lazy en el panel de clima + link. Spot fijo 3640 (Mar del Plata Base Naval), que es el que usa Chelo para decidir alquileres y eventos. Prohibido scrapear endpoints internos.
- clima_diario (si se aprueba) guarda el resumen diario de clima y ocupación para Reportes.

## QA automatizado
Playwright (`@playwright/test`, devDependency) — `npm run test:e2e`. Credenciales de la cuenta de prueba SOLO en `.env.local` (`E2E_USER_EMAIL`/`E2E_USER_PASSWORD`, ver `.env.local.example`), nunca hardcodeadas ni en un commit — `.env.local` está en `.gitignore`. Todo dato de prueba lleva el prefijo `E2E TEST` (`PREFIJO_E2E` en `e2e/fixtures.ts`); `e2e/teardown.ts` borra clientes con ese prefijo y en cascada sus reservas/pagos/comprobantes/eventos, más (Fase 2, oct 2026) los `codigos_reserva` huérfanos de esas reservas y los `leads` con nombre que empieza con el mismo prefijo — corre automático al final de la suite (`globalTeardown`) y también a mano con `npm run test:e2e:teardown`. Tests en serie (`fullyParallel: false`), comparten estado real.

## Preferencias de trabajo
- Prompts flat, concisos, sin tablas markdown ni headers pesados.
- Deliverables para el dueño: lenguaje no técnico, orientado a beneficios de negocio.
- Diseño: primero en Google Stitch (ZIP con `DESIGN.md` + `code.html` + `screen.png`) como fuente de verdad visual. Cambios visuales no tocan lógica, hooks, queries ni routing salvo que la tarea lo pida explícitamente.
- Auditar el esquema real antes de cualquier migración; nunca asumir forma de tablas.
- CLAUDE.md se reemplaza completo desde los prompts; no se edita a mano.

## Aprendizajes de prompt engineering
- Instrucciones abstractas generan componentes inventados que no pedimos.
- Mejor dar código fuente real que descripciones abstractas.
- Preferir "borrar y reemplazar" explícito en vez de "mejorar" en refactors.
- Antes de renombrar/consolidar un helper compartido (ej. `lib/format`), verificar que no exista ya un archivo con ese nombre y otros exports — la colisión de módulos falla en silencio en tiempo de ejecución, no al compilar.
- Antes de asumir que algo "no existe todavía" (una tabla de auditoría, un sistema de roles), auditar el código y el schema real: varias veces lo que el contexto daba por pendiente ya estaba construido con otro nombre.

## Pendiente / en foco
- Checklist antes de activar las reservas online (`config_reservas_publicas.activo = true`):
  - confirmar la configuración real con el dueño (hoy `config_reservas_publicas` y `tarifas` son provisorios/vacíos);
  - cargar `tarifas`;
  - crear el widget real de Cloudflare Turnstile (hoy `TURNSTILE_SECRET_KEY` es la clave de prueba);
  - subir el rate limit de `crear-reserva-publica` a unos 20/h por IP (muchos celulares comparten IP; cada intento fallido cuenta).
- Crear un usuario e2e propio con rol admin para la suite de Playwright, en vez de usar la cuenta superadmin personal. Al hacerlo, la policy DELETE de `leads` (hoy `es_superadmin()`) necesita sumar la condición del prefijo E2E TEST.
- Recepción v2: carga de comprobante dentro del mismo flujo de cobro (hoy queda para después, vía el link a DetallePago).
- Terminar el barrido de inputs/validación: reemplazar los `input type="number"/"date"` nativos que quedan (Clientes, UnitModal, Perfil, login, algunos filtros), escribir los esquemas zod por entidad restantes y conectarlos a los formularios, agregar la regla de ESLint que prohíba formateo disperso, ampliar los tests de `parse`/`format`.
- Historial: filtro explícito por unidad/cliente en la UI (el hook ya acepta esos params, falta el selector).
- Drawer de cliente (feat-3): integrado como referencia en Reportes.jsx; falta repetir la integración en Home/Caja (resto de las pantallas con nombre de cliente en texto plano).
- Long-press en el Plano (feat-6, mobile): no se construyó — el tap ya abre `UnidadPreviewModal` con las mismas acciones (ver reserva, nueva reserva, registrar pago vía ficha de cliente) que pedía el gesto, así que un long-press aparte sería una interacción redundante, no una mejora real.
- QA e2e con Playwright armado (`npm run test:e2e`) pero nunca corrido — falta cargar `E2E_USER_EMAIL`/`E2E_USER_PASSWORD` de una cuenta de prueba en `.env.local`.
- Pago online (Mercado Pago) y facturación ARCA para reservas web: pedido anticipado por el cliente para dentro de unos meses — el sistema de reservas públicas queda preparado (ver ese bloque). Antes de implementar: elegir pasarela por comisiones (MP Checkout Pro vs Payway vs Mobbex) y conseguir CUIT, certificado y punto de venta electrónico.
- Reservas públicas: fases 4 a 7 del roadmap (landing, entrega de QR, bandeja de leads, recordatorios/seña online) — fase 3 (Recepción) ya hecha.
- `fn_reserva_vigente` — bug preexistente corregido en Fase 1 (era IMMUTABLE usando CURRENT_DATE, pasó a STABLE).
- DNS: `priusplayagrande.com.ar` en NIC.ar delegado a Cloudflare (no transferencia).
