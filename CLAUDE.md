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
- Reserva con precio unificado / grupo: varias reservas del mismo cliente (ej. varios períodos no contiguos) bajo un solo precio pactado en vez de uno por reserva — tabla `reserva_grupos` + `reservas.grupo_id`. Ver "Estructura de datos".
- Candado / bloqueada: marca en una reserva (cualquier tipo_alquiler) que impide editar su fecha y su unidad hasta que un admin la desbloquee explícitamente. Cliente y pagos de esa reserva siguen editables aunque esté bloqueada.
- Co-socios: clientes adicionales que comparten una reserva/unidad.
- Carperos, comandas.
- ARCA / AFIP: autoridad fiscal argentina. CUIT / clave fiscal: credenciales fiscales.
- Mercado Pago: pasarela candidata para cobros online.
- Código de reserva: formato `PRIUS-A3X9K2`, para el sistema de reservas públicas (planificado).

## Estructura de datos (Supabase)
- `clientes`: datos personales + fiscales (condicion_iva, cuit, razon_social). DNI único cuando está cargado. Columna histórica reutilizada: `mail` (no `email`).
- `unidades`: carpas/sombrillas/cabinas/lockers. `unidades.estado` siempre derivado por trigger, nunca manual. Número único por tipo. Agrupamiento por pasillo (A/B/C) es solo visual en el frontend.
- `reservas`: tipo_alquiler, fechas, precio_lista, ajuste, costo_total, bonificada, estado_pago (derivado de pagos por trigger salvo pendiente_confirmacion). Sin superposición de fechas por unidad (constraint de exclusión `reservas_no_overlap_periodo_dia`, filtra `estado='activa'`). Columna histórica reutilizada: `valor_total` (no `costo_total`) es la fuente real. `grupo_id` (nullable, FK a `reserva_grupos`) agrupa varias reservas del mismo cliente bajo un solo precio pactado (oct 2026, caso Ana Lescano) — con grupo_id seteado, `saldo`/`estado_pago` de ESA fila los calculan los mismos triggers (`fn_reserva_recalcula_saldo`/`fn_pago_actualiza_saldo`) pero contra `reserva_grupos.precio_total` y la suma de pagos de TODAS las reservas del grupo, nunca contra el `valor_total` individual. `monto_grupo_referencia` (legado de la migración del excel) quedó deprecado, no se usa en ningún cálculo. Temporada no tiene fecha propia en esta tabla — se resuelve contra `temporadas` vía `temporada_id` (ver "Navegación y deep-linking" y los fixes de oct 2026 en Reservas/Ocupación/Notificaciones).
- `temporadas`: entidad real (fecha_inicio/fecha_fin), reemplaza al string suelto `reservas.temporada`. Alta de reserva/caja nueva toma sola la que tenga `estado='activa'` (trigger, no se elige a mano en la UI).
- `reserva_grupos`: id, cliente_id, temporada, precio_total, notas, created_at. Alta/lectura directa (mismo patrón de permisos que `reservas`, sin RPC) desde `crearGrupoReservas()` en DataProvider — acción "Agrupar reservas" en Clientes.jsx.
- `reserva_clientes`: una reserva puede tener varios clientes (co-socios).
- `comprobantes`: facturas/recibos cargados manualmente; unique (tipo, punto_venta, numero); un pago puede tener varios comprobantes.
- `pagos`: fuente de verdad de ingresos. medio (no `medio_pago`, columna histórica reutilizada), tipo_pago, origen (crm / web / migracion), caja_id asignado por el sistema, cliente_id, comprobante(s) opcionales, estado vigente/anulado.
- `caja_diaria`: sesión de caja (abierta/cerrada), monto inicial (columna histórica `saldo_apertura`, no `monto_inicial`), arqueo, datos Z, resumen_snapshot congelado al cerrar. Solo una abierta a la vez (índice único parcial).
- `gastos_caja`: egresos del día por categoría y medio de pago. Columna histórica `descripcion` (no `concepto`).
- `caja_eventos`: auditoría de aperturas, cierres, reaperturas y anulaciones de caja.
- `eventos`: auditoría general (ver "Historial" más abajo) — triggers `trg_zzz_log_evento` sobre clientes/unidades/reservas/pagos/comprobantes/gastos_caja/ingresos_caja, función `fn_log_evento()`. ~1066 filas migradas antes de oct 2026 no tienen `tipo_evento` cargado (se arreglo solo entre el 3 y el 5/10) y se muestran como "Otros" en el Historial — dato histórico, no bug vivo; backfill pendiente de confirmación si se quiere.
- `ingresos_caja`: deprecada (Fase 3 de Caja) — reemplazada por `pagos.caja_id`/`cliente_id`/`concepto`. Se conserva de solo lectura por su histórico, ya no se escribe.
- `notificaciones_leidas`: estado leída/no leída por usuario de las notificaciones computadas (ver "Notificaciones" más abajo) — upsert con `ON CONFLICT DO NOTHING`, sin policy de UPDATE a propósito.
- `leads`: alimentada por el formulario de contacto de beachFlow (no romper).
- Vistas/funciones: `v_reservas_saldo`, `v_caja_movimientos`, `resumen_caja(caja_id)`, `historial_entidad(...)` (RPC paginada para el Historial de una entidad puntual), `cuit_valido(text)`, `es_admin()`, `es_superadmin()`.
- Tablas legacy en inglés de la etapa Dyad (`beach_clubs`, `admin_users`, `units`, `reservations`): identificadas para DROP, pendiente de confirmación.
- Datos de temporada 2026-2027 migrados desde `base_de_datos_2026_Prius.xlsx`. Pagos históricos con origen = migracion (algunos con monto null pendiente de verificar contra el comprobante físico; el total vive en `reservas.valor_total`). Nunca aparecen en ninguna caja. Datos migrados que no cumplen constraints nuevos quedan con NOT VALID y se reportan, no se modifican (ej.: 5 clientes con CUIT en formato viejo sin guiones/incompleto, un puñado de `caja_diaria.saldo_apertura` negativos de la etapa pre-Fase-3).

## Módulos del CRM
Home, Plano, Cabinas y Lockers, Reservas, Clientes, Caja, Reportes, Ocupación, Historial (antes "Línea de Tiempo"), Notificaciones, Leads, Comprobantes, Perfil.
- Cabinas y Lockers (`/app/cabinas-lockers`): sección en desarrollo, debajo de Plano de Playa en Gestión Operativa, con badge "Pronto" en el menú. Es de solo lectura — no escribe nada en la base. Hoy no hay unidades `tipo='cabina'`/`'locker'` cargadas (0 registros): la página usa datos reales de `unidades` en cuanto existan, y mientras tanto muestra tarjetas de ejemplo marcadas visualmente como tales. Botones de acción deshabilitados con el texto "Próximamente".
- Ocupación (`/app/ocupacion`): vistas Semana (Gantt por unidad + % de ocupación por día) y Mes (heatmap + KPIs: ocupación promedio, día pico, unidades libres hoy, desglose por tipo), navegación anterior/siguiente/Hoy, swipe en mobile, filtro por tipo de unidad. Colores por tipo_alquiler compartidos con el Plano vía `lib/colors.ts` — único lugar que los define, Cell.jsx y Ocupacion.jsx importan de ahí.
- Historial (`/app/historial`, antes `/app/actividad` — la ruta vieja redirige): feed de auditoría de `eventos`, agrupado por día ("Hoy"/"Ayer"/fecha), con KPIs del período elegido (movimientos, cobrado, reservas nuevas, modificaciones, cancelaciones) y filtro de rango de fechas + búsqueda libre persistidos en la URL. Mismo componente `Historial.jsx` se reusa compacto en la ficha de cliente, el detalle de reserva y el modal de unidad del Plano.
- Notificaciones: caja pendiente, llegada hoy/mañana, saldo pendiente (urgente si la llegada ya pasó o es dentro de 7 días), pendiente_confirmacion sin resolver, cancelaciones y reservas nuevas/modificadas recientes (de `eventos`, ventana de 48hs). Tabs Todas/Pagos/Reservas/Llegadas/Pendientes sobre las secciones Urgentes/Informativas. Leída/no leída persistido por usuario en `notificaciones_leidas` (no localStorage).

## Principio arquitectónico clave
Sistema cliente-céntrico y reactivo en tiempo real. Patrón "single write, multiple reactive reads": toda acción de dinero escribe una sola vez, vía RPC Postgres, en `pagos`/`gastos_caja`/`caja_diaria`; triggers y Realtime propagan a Plano (estado de unidad), Reservas (estado_pago y saldo), Caja, Reportes, Ocupación, Historial, Notificaciones y listados. `unidades.estado` se deriva siempre por trigger, nunca a mano. Ninguna pantalla tiene lógica de escritura paralela — nuevas features consumen este patrón, no inventan una segunda.

## Navegación y deep-linking
- Todo estado navegable que tenga sentido compartir o sobrevivir a un refresh vive en la URL: cliente/pago/reserva resaltados, filtros de Reservas (estado/tipo/llegada), fecha y tab de Caja, vista/fecha de Ocupación, filtros de Historial.
- Las URLs de navegación entre pantallas se arman solo con los builders de `src/lib/deepLinks.ts` (`linkToCliente`, `linkToReserva`, `linkToPlano`, `linkToOcupacion`, `linkToHistorial`). Prohibido armar esos strings a mano en componentes.
- `useDeepLinkTarget` (`src/hooks/useDeepLinkTarget.js`) consume los params al montar la pantalla, hace scrollIntoView suave y resalta el elemento con `.deep-link-highlight` (borde `#F2CA50` de 2px que se desvanece solo, sin sombra) sobre cualquier elemento con `data-deeplink-id="<id>"`. Si el registro no existe, toast discreto (`useDialog().toast`, no bloqueante) y la pantalla no se rompe.
- Destinos por tipo de entidad: un pago se ve en Clientes con el cliente abierto y la cuota resaltada; una reserva de temporada también va a Clientes (vive ahí, no en Reservas), período/día va a Reservas; una unidad va al Plano en la fecha correspondiente con la unidad resaltada.
- Toda entidad visible (cliente, unidad, reserva, pago, factura) debería ser clickeable y llevar a su destino — ver "Pendiente / en foco" por lo que falta.

## Flujo de dinero (reglas de negocio)
- Los cobros se registran solo desde Clientes, Reservas (incluida el alta con seña inicial) o el modal de unidad del Plano, con el componente compartido `RegistrarPago`. Nunca desde la Caja: se evita la doble carga. El modal de unidad del Plano (`UnidadPreviewModal.jsx`) es de solo lectura por diseño — en la práctica hoy `RegistrarPago` se usa desde Clientes y Reservas.
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
Desde oct 2026: dos columnas en desktop (cliente/unidad/fechas a la izquierda, precio/resumen a la derecha) para entrar completo en 1366x768 sin scroll o con scroll interno mínimo; resumen fijo (unidad, fechas, noches/días, total, saldo) y "Más opciones" (notas + historial) colapsado por defecto. Footer sticky con total a la izquierda y Cancelar/Crear reserva a la derecha — el botón de submit vive ahí vía el atributo HTML `form`, pero sigue disparando el mismo `<form onSubmit>` de siempre.

## Disponibilidad y no-solapamiento de reservas
- Las reservas de tipo día y período no pueden solaparse en fechas sobre la misma unidad — exclusion constraint de Postgres (`daterange` + GiST) sobre `unidad_id`, filtrando `estado='activa'`. Las reservas de temporada ocupan la unidad para todo el rango de la temporada (resuelto vía `temporada_id` contra `temporadas`, no tienen fecha propia en `reservas`).
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

## Sistema de reservas públicas (planificado, sin auth)
- Sin login para el cliente final, mismo proyecto Supabase, sincronizado en tiempo real.
- Precio según método de pago. Grupos de más de 6 personas disparan una segunda unidad.
- Hold hasta el día del check-in. Códigos únicos formato `PRIUS-A3X9K2`, con QR generado del lado cliente (librería `qrcode`); staff confirma por escaneo (`jsQR`/`html5-qrcode`) o código manual.
- Seguridad crítica: todos los writes públicos pasan por Edge Functions (con rate limiting), nunca inserts directos. RLS en la anon key solo permite leer disponibilidad, nada de dinero. Mismas reglas de validación de esta guía aplicadas en las Edge Functions. `anon` (beachFlow) sin ningún acceso a tablas ni funciones de dinero.

## Seguridad
- Escrituras de dinero solo vía RPC security definer con search_path fijo; sin insert/update/delete directos para authenticated en pagos, comprobantes, gastos_caja, caja_diaria (revocado, solo SELECT + RPC).
- Permisos centralizados en `es_admin()`/`es_superadmin()` + la matriz de `lib/permisos.ts` (ver "Roles") — ya no es "cualquier autenticado", hay roles reales desde oct 2026.
- Login con mensajes de error genéricos (no revelar si el email existe).

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

### Instalable como app
`public/manifest.webmanifest` + meta tags iOS en `index.html` para agregar a pantalla de inicio sin barra del navegador. Sin service worker ni cache offline a propósito: la app depende de Realtime, cachear una vista vieja sería peor que no tener nada.

### Impresión A4 (componente dedicado, sin UI, encabezados de tabla repetidos, sin cortar filas)
- Plano (`PlanoImpresion.jsx`): una hoja A4 vertical para los carperos, blanco y negro estricto. Fecha arriba a la izquierda, plano con el mismo layout que en pantalla, letra T/P/D en cada casilla ocupada. Debajo del océano, listado de períodos y días activos ese día en dos columnas (carpas izq., sombrillas der.), formato "C.01 Nombre del dd/mm al dd/mm/aa". Nunca más de una hoja.
- Caja (`CajaImpresion.jsx`): resumen del día, blanco y negro con acento dorado mínimo, mismas secciones que `ResumenCaja.jsx` (totales, por medio, arqueo, Z, facturas, recibos, sin comprobante, gastos, anulados, firmas), alimentado por `resumen_caja(caja_id)`.

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
- Terminar el barrido de inputs/validación: reemplazar los `input type="number"/"date"` nativos que quedan (Clientes, UnitModal, Perfil, login, algunos filtros), escribir los esquemas zod por entidad restantes y conectarlos a los formularios, agregar la regla de ESLint que prohíba formateo disperso, ampliar los tests de `parse`/`format`.
- Historial: filtros de usuario/unidad/cliente y paginación infinita de la vista global todavía no están (solo rango de fechas + búsqueda libre + los últimos 300 eventos en memoria).
- Ocupación/Historial/Reportes: varias filas de cliente/unidad todavía sin link de salida (ver auditoría de navegación, oct 2026) — ir sumando `linkToCliente`/`linkToReserva`/`linkToPlano` a medida que se tocan esas pantallas.
- QA end-to-end en navegador (circuito de caja completo + validación de inputs), mobile real y desktop — no se hizo todavía en esta fase.
- Pasarela de pago online: Mercado Pago Checkout Pro (candidata) vs Payway vs Mobbex — evaluar comisiones.
- Facturación electrónica ARCA/AFIP integrada: fuera de alcance por ahora (se factura manualmente).
- Edge Functions para reservas públicas.
- DROP de tablas legacy (pendiente de confirmación).
- Backfill de `tipo_evento` para los ~1066 eventos migrados antes de oct 2026 (pendiente de confirmación, ver "Estructura de datos").
- DNS: `priusplayagrande.com.ar` en NIC.ar delegado a Cloudflare (no transferencia).
