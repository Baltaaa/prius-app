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
- **Carpas / sombrillas / cabinas / lockers**: unidades de playa alquilables.
- **Plano interactivo**: mapa visual de la playa con el estado de cada unidad.
- **Caja diaria**: registro de movimientos de dinero del día.
- **Preconfirmada / pendiente_confirmacion**: estado de una reserva sin confirmar.
- **Candado / bloqueada**: marca en una reserva (cualquier `tipo_alquiler`) que impide editar su fecha y su unidad hasta que un admin la desbloquee explícitamente. Cliente y pagos de esa reserva siguen editables aunque esté bloqueada.
- **Línea de tiempo**: vista tipo Gantt por unidad que muestra la ocupación a lo largo del tiempo (independiente del Plano, que muestra el estado en un momento puntual).
- **Co-socios**: clientes adicionales que comparten una reserva/unidad.
- **Unidad bonificada**: reserva sin cargo (`valor_total = 0`), no registra pagos. Es propiedad de la reserva, no de la unidad.
- **ARCA / AFIP**: autoridad fiscal argentina.
- **Mercado Pago**: pasarela de pago principal candidata.
- **CUIT / clave fiscal**: credenciales fiscales argentinas.

## Estructura de datos (Supabase)
Tablas principales: `clientes`, `unidades`, `reservas`, `pagos`, `caja_diaria`, `gastos_caja`, más `reserva_clientes` (tabla puente para co-socios) y `leads` (alimentada por el formulario de contacto de beachFlow).
- `tipo_alquiler` (temporada / periodo / dia) es propiedad de `reservas`.
- `reservas.estado_pago`: `pendiente`, `parcial`, `pagado`, `pendiente_confirmacion` (constraint real de la base — auditado sep. 2026; no son `sena_parcial`/`saldado`, esos son solo los labels que se muestran en UI). Significado de cada valor (lo recalculan siempre los triggers `fn_pago_actualiza_saldo`/`fn_reserva_recalcula_saldo`, nunca se carga a mano):
  - `pendiente`: reserva con precio ya cargado (`valor_total` > 0) pero sin ningún pago registrado todavía.
  - `parcial`: tiene al menos un pago, pero no cubre el total.
  - `pagado`: el total pagado cubre el `valor_total`.
  - `pendiente_confirmacion`: cliente fijo de temporada pasada que todavía no confirmó ni acordó precio para la actual (`valor_total` = 0, exclusivo de `tipo_alquiler = 'temporada'`). Sale solo de este estado en cuanto se carga un `valor_total` > 0.
- `unidades.estado` (`libre`/`ocupada`/`reservada`) siempre se deriva por trigger, nunca se carga a mano.
- `reservas.bonificada` (boolean, default `false`): unidad bonificada, propiedad de la RESERVA y no de la unidad (una misma unidad puede ser bonificada una temporada y no la siguiente). `bonificada = true` fuerza `valor_total = 0` y `estado_pago = 'pagado'` — lo hace cumplir `fn_reserva_recalcula_saldo` (dispara también con `update of bonificada`, no solo de `valor_total`), no se carga a mano. Una reserva bonificada no admite pagos: el insert de `pagos` sobre ella está bloqueado a nivel de base (`trg_pago_bloquea_bonificada`), no solo en la UI — por lo tanto tampoco genera movimientos en `caja_diaria`/`ingresos_caja` (nunca llega a existir el pago que los dispara).
- El agrupamiento por pasillo/sector es solo visual en el front.

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

## Decisiones de UX

### Estados de reserva: un solo indicador
Cada reserva muestra un único badge de estado, nunca repetido en la misma vista. Si `bonificada = true`, el badge es siempre "Bonificada" (tono cyan) y reemplaza por completo al de `estado_pago` — nunca conviven ni se decide entre los dos por separado (ver `lib/reservas.js` `estadoBadgeStatus`, único lugar que resuelve cuál mostrar). Si no es bonificada, labels por `estado_pago`: `pendiente_confirmacion` → "Sin confirmar", `parcial` → "Seña parcial", `pagado` → "Pagado", `pendiente` → "Sin pago". Al lado del badge, como máximo una acción primaria contextual: `pendiente_confirmacion` → "Confirmar temporada"; `parcial` o `pendiente` → "Registrar pago". Una reserva bonificada no muestra ninguna acción primaria de cobro (ni "Registrar pago", ni "Definir precio", ni el ícono de pago — se oculta, no se deshabilita).

### Nunca mostrar "$ 0" (sep 2026)
En Clientes, Reservas y el modal de unidad del Plano, un monto nunca se muestra en "$ 0": se muestra el monto formateado solo si es mayor a 0 (helper único `formatMontoVisible` en `lib/format.js`, no formatear a mano); si es 0 (reserva pagada, saldada o bonificada), no se muestra nada en esa posición — ni "$ 0" ni un texto de reemplazo tipo "Saldado" — y el layout mantiene el espacio reservado para que íconos/columnas vecinas no se corran. Reemplaza la regla anterior de mostrar "Saldado" en esos casos. Excepción explícita: en **Caja** y **Reportes** un total en $0 sí es un dato real del día/período y se muestra tal cual.

### Ficha de cliente (dropdown en Clientes)
- El header colapsado muestra nombre, teléfono, unidad(es), badge de estado y saldo ("Sin precio" si no hay precio definido; nunca "$ 0" — ver "Nunca mostrar $ 0" arriba).
- Unidad(es) del header: emoji + número alineados sobre la misma línea base, número al menos del tamaño del nombre del cliente (no un dato secundario chico). Con varias unidades, mismo tratamiento en todas.
- El panel expandido no repite datos del header; solo agrega CUIT/DNI, Cliente desde y el detalle de reservas y pagos.
- Campos vacíos se muestran como "Sin cargar" en gris, no con guion (incluye teléfono).
- Monto con comprobante cargado pero sin poder leer el importe real: "Monto nulo" en rojo, tamaño de texto menor, una sola línea sin quiebre (reemplaza el "Sin verificar" anterior) — aplica tanto al saldo del header como a las celdas de la grilla de pagos. Excepción: en el header, si la reserva que decide el badge está pagada o bonificada, ese saldo en $0 es real — no se muestra "Monto nulo" ahí (tampoco nada más, por la regla de "Nunca $ 0").
- Pagos sin precio definido: empty state corto con botón "Definir precio" (no aplica a una reserva bonificada, que nunca tiene ese botón).
- Grilla de pagos por reserva (`PagosGrid.jsx`): sin cantidad fija de columnas — Precio venta (no se renderiza si es $0), una celda "Cuota N" por cada pago ya registrado y una sola celda "+ Cargar" después del último (se corre de a una al cargar el siguiente pago), y Saldo. Una reserva bonificada no muestra esta grilla: una sola línea, "Carpa bonificada — no registra pagos." Una reserva saldada (`estado_pago = 'pagado'`, o suma de montos conocidos ≥ `valor_total`) no muestra la celda "+ Cargar", el Saldo dice "Unidad saldada", y todas las cuotas quedan bloqueadas (sin click, sin edición ni borrado) aunque tengan montos nulos — hoy no hay sistema de roles, así que el bloqueo aplica sin excepción para todos los usuarios (la excepción "solo un admin puede reabrirlas" queda pendiente de ese sistema, que todavía no existe).

### Modal de unidad en el Plano: preview, no editor
- El modal de unidad es solo lectura. No tiene inputs ni "Guardar cambios".
- Muestra: datos de la unidad, estado derivado, reserva actual (titular, co-socios, tipo, fechas, estado, total/pagado/saldo, notas) e historial de la temporada.
- Toda edición o alta se hace enrutando: unidad libre → "Asignar cliente de temporada" (Clientes) o "Nueva reserva por período o día" (Reservas), con la unidad precargada por params. Unidad con reserva de temporada → ficha del cliente; período o día → detalle de la reserva.
- Liberar unidad, registrar pagos y editar notas se hacen en el destino, no en el modal.
- "Ver todas" del historial de la temporada filtra Reservas por esa unidad (`?filtroUnidad=<uuid>`) e incluye también sus reservas de `tipo_alquiler = temporada` (con etiqueta "Temporada" junto al badge único; clic navega a la ficha del cliente en Clientes, no a edición).
- Desktop: modal centrado. Mobile: bottom sheet de altura completa con acciones fijas abajo.
- Se alimenta de la misma suscripción Realtime del Plano.
- `UnitModal.jsx` (el viejo modal de alta/edición que este preview reemplazó) quedó desconectado a propósito — no lo importa ninguna pantalla. Sigue en el repo sin usar porque no está decidido si se reutiliza como base para algo en Reservas; no borrar ni reconectar sin confirmar antes.

## Disponibilidad y no-solapamiento de reservas (decisión, sep. 2026)
- Las reservas de tipo `día` y `período` no pueden solaparse en fechas sobre la misma unidad. Esto se garantiza a **nivel de base**, no solo en el frontend: exclusion constraint de Postgres (`daterange` + índice GiST) sobre `unidades_id`, para que la propia base rechace cualquier cruce de fechas.
- Las reservas de temporada ocupan la unidad para todo el rango de la temporada; se modelan con el mismo mecanismo de rango de fechas.
- El selector de fecha del Plano (ya existe en el frontend) tiene que recalcular la disponibilidad real de cada unidad contra las reservas que se solapen con la fecha elegida — no alcanza con mirar `unidades.estado` actual, que solo refleja el día de hoy.
- **Candado en reservas:** columna `bloqueada` (boolean, default `false`) en `reservas`, aplicable a cualquier `tipo_alquiler`. Con `bloqueada = true`, la UI deshabilita la edición de fecha y unidad de esa reserva (cliente y pagos se pueden seguir editando). El toggle se hace con un ícono de candado en el detalle/edición de la reserva. Desbloquear requiere un modal de confirmación explícito antes de togglear a `false`.
- **Línea de tiempo (nueva sección, separada del Plano):** vista tipo Gantt por unidad, con una barra por reserva mostrando su rango de fechas, filtrable por rango de fechas. Pensada para ver de un vistazo la disponibilidad futura de toda la playa durante la temporada.
- **Calendario de nueva reserva / edición:** el date picker del formulario de reserva debe marcar visualmente (tachado) los días ya ocupados para la unidad seleccionada, y bloquear su selección de forma dinámica según cambia la unidad elegida — usa la misma lógica de rangos que el constraint de no-solapamiento, para que la UI nunca deje elegir algo que el backend va a rechazar.

## Borrado de datos raíz (decisión, sep. 2026)
- **Reservas:** dos acciones distintas, elegibles en la UI. "Cancelar reserva" es soft delete (`estado` → `cancelada`), libera la unidad y el rango de fechas del constraint de no-solapamiento, y no borra la fila ni sus `pagos` (queda para caja/reportes/histórico). "Eliminar definitivamente" es hard delete real: borra la fila de `reservas` y sus `pagos` asociados en una transacción, y nunca toca `clientes`. Si la reserva está `bloqueada`, cualquiera de las dos acciones exige pasar primero por el flujo de desbloqueo existente (modal de candado).
- **Confirmación reforzada para borrados de dato raíz:** cualquier borrado de `reservas`, `clientes` o `unidades` usa un modal de confirmación genérico y reusable (`ConfirmDeleteModal`) que exige tipear el identificador exacto de lo que se va a borrar (código de reserva, nombre de cliente, nombre de unidad) para habilitar el botón de confirmar. Reemplaza cualquier `window.confirm` u otra confirmación simple que exista hoy en esos flujos.

## Sistema de reservas públicas (planificado, sin auth)
- Sin login para el cliente final.
- Mismo proyecto Supabase que el CRM, sincronizado en tiempo real.
- Precio varía según método de pago.
- Grupos de más de 6 personas → dispara una segunda unidad automáticamente.
- El hold de la reserva dura hasta el día del check-in.
- Códigos de reserva únicos para recepción (formato: `PRIUS-A3X9K2`).
- **Seguridad crítica:** todos los writes públicos pasan por Supabase Edge Functions, nunca inserts directos desde el cliente. RLS en la anon key restringe a solo lectura de disponibilidad.

## Diseño ("Quiet Luxury")
- Colores: `#FFFFFF`, `#F2CA50`, `#000000`, `#E5E5E5`
- Tipografía: Inter
- Estética plana: sin sombras, sin gradientes
- Mobile-first, con bottom nav bar en pantallas chicas. La versión mobile debe sentirse como una app nativa de Play Store: totalmente interactiva, moderna, prolija visualmente e intuitiva — no una web responsive genérica.

Layout del plano de carpas (definido con el dueño, sept 2026): 6 hileras y 3 pasillos. Hilera 1–25 sola (número izq). Pasillo A. Bloque 26–50 (número izq) + 51–75 (número der) espalda con espalda. Pasillo B (central, acceso al balneario, más ancho, alineado con ACCESO). Bloque 76–98 (número izq) + 99–121 (número der) espalda con espalda. Pasillo C. Hilera 122–144 (número der). Números siempre por fuera de los bloques. Header y barra del océano abarcan todo el ancho del plano. Sector Sombrillas: layout fijo, no se modifica. La numeración de carpas y sombrillas es la real del balneario y nunca se altera.

Impresión A4 del plano diario: la usan los carperos en la playa, reemplaza la planilla Excel diaria. Una sola hoja A4 vertical, blanco y negro estricto (sin rellenos ni íconos). Fecha arriba a la izquierda, plano con el mismo layout que en pantalla y letra T/P/D en cada casilla ocupada. Debajo del océano, listado alineado a la izquierda de períodos y días activos ese día (no temporadas), en dos columnas: carpas a la izquierda y sombrillas a la derecha. Formato "C.01 Nombre del dd/mm al dd/mm/aa" y "S.09 Nombre dd/mm/aa" para un solo día. Nunca más de una hoja.

## Pendiente / en foco ahora
- Pasarela de pago: Mercado Pago Checkout Pro (candidata principal) vs Payway vs Mobbex — evaluar comisiones.
- Facturación ARCA/AFIP: requiere CUIT + certificado + integración WSFEv1 (o servicio intermediario).
- Edge Functions para reservas públicas.
- DNS: dominio `priusplayagrande.com.ar` en NIC.ar, delegado a Cloudflare (no transferencia, `.com.ar` no soportado como registrar en Cloudflare).

## Preferencias de trabajo
- Prompts flat, concisos, sin tablas markdown ni headers pesados (para no gastar tokens de más con agentes de IA).
- Deliverables para el dueño del balneario: lenguaje no técnico, orientado a beneficios de negocio, no a implementación.
- Diseño: se trabaja primero en Google Stitch (exporta ZIP con `DESIGN.md` + `code.html` + `screen.png`) antes de pasar a código.
- Cambios visuales no tocan lógica, hooks, queries de Supabase ni routing salvo que la tarea lo pida explícitamente.

## Aprendizajes de prompt engineering (relevantes también para Claude Code)
- Instrucciones abstractas generan que el agente invente componentes nuevos que no pedimos.
- Es mejor dar el código fuente real en el prompt que descripciones abstractas o listas de archivos.
- Preferir "borrar y reemplazar" explícito en vez de "mejorar" cuando se pide refactor.
- Auditar el schema real antes de cualquier migración; nunca asumir la forma de las tablas.
