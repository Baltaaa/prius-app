// Matriz única de permisos (Tarea 3, guía Roles/Login). La UI solo oculta —
// la base decide de verdad vía RLS y las funciones usuario_activo()/
// es_superadmin()/es_admin() (ver migración roles_perfiles_y_rls_usuario_activo).
//
// Uso: const puedo = usePermiso('reabrir_caja'); o <Permiso clave="bonificar">...</Permiso>

export type Rol = 'superadmin' | 'admin'

// Claves explícitas, exclusivas de superadmin. Todo lo que NO esté acá y
// tampoco sea una de las acciones de operación diaria de `admin` (Plano,
// Reservas, Clientes, cobros, gastos, abrir/cerrar caja, anular con caja
// abierta, comprobantes, imprimir/exportar, historial) cae en "solo
// superadmin" por default — ver `usePermiso`.
export const PERMISOS: Record<string, Rol[]> = {
  reportes_globales: ['superadmin'],
  reabrir_caja: ['superadmin'],
  bonificar: ['superadmin'],
  ajustes_precio: ['superadmin'],
  editar_unidades: ['superadmin'],
  gestion_usuarios: ['superadmin'],
  editar_comprobante: ['superadmin'],
  // Anular un pago y corregir el monto de uno YA verificado (testing oct
  // 2026, items 9/10) — espeja el guard real de anular_pago/
  // fn_editar_monto_pago_vigente. Distinto de editar_monto_pago (abajo),
  // que es solo para CARGAR el monto de un recibo migrado sin verificar.
  anular_pago: ['superadmin'],
  editar_monto_pago_vigente: ['superadmin'],
  // Borrado definitivo de un lead ya descartado (oct 2026) — espeja la
  // policy de RLS real (es_superadmin()), acá es solo para ocultar el botón.
  eliminar_lead: ['superadmin'],
  // Cargar el monto real de un pago migrado que llegó con monto null (nunca
  // "corregir" uno ya verificado) — oct 2026, pendiente pago_sin_monto.
  editar_monto_pago: ['superadmin', 'admin'],
  // Recepción (Fase 3 reservas públicas, D9): check-in sin cobrar con saldo
  // pendiente es la única acción de Recepción restringida — el cobro normal
  // es operación diaria (ver `recepcion_cobrar` abajo).
  'recepcion.checkin_sin_cobro': ['superadmin'],
  // Fase 4A (oct 2026): vista previa interna de la variante pública del
  // plano — herramienta de desarrollo, no para uso operativo diario.
  plano_publico_preview: ['superadmin'],
  // Ítem 2 (25/10/2026): revertir/cambiar a mano el estado_pago calculado
  // de una reserva — espeja el guard real de cambiar_estado_pago_manual/
  // revertir_estado_pago_automatico en la base.
  ajustar_estado_pago: ['superadmin'],
  // Mini-prompt 26/10/2026, cambio de criterio explícito: antes cualquier
  // usuario activo podía sacar un cosocio (RLS usuario_activo()); ahora es
  // superadmin + contraseña, como cualquier otro hard-delete.
  quitar_cosocio: ['superadmin'],

  // Operación diaria — explícitas para que quede documentada la matriz
  // completa, aunque el default ya las permitiría para admin.
  plano: ['superadmin', 'admin'],
  reservas: ['superadmin', 'admin'],
  clientes: ['superadmin', 'admin'],
  registrar_cobro: ['superadmin', 'admin'],
  registrar_gasto: ['superadmin', 'admin'],
  abrir_cerrar_caja: ['superadmin', 'admin'],
  anular_con_caja_abierta: ['superadmin', 'admin'],
  comprobantes: ['superadmin', 'admin'],
  imprimir_exportar_caja: ['superadmin', 'admin'],
  historial_cajas: ['superadmin', 'admin'],
  'recepcion.cobrar': ['superadmin', 'admin'],
}

/** Clave no registrada en la matriz → solo superadmin (default seguro). */
export function tienePermiso(rol: Rol | null | undefined, clave: string): boolean {
  if (!rol) return false
  const roles = PERMISOS[clave]
  if (!roles) return rol === 'superadmin'
  return roles.includes(rol)
}
