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
}

/** Clave no registrada en la matriz → solo superadmin (default seguro). */
export function tienePermiso(rol: Rol | null | undefined, clave: string): boolean {
  if (!rol) return false
  const roles = PERMISOS[clave]
  if (!roles) return rol === 'superadmin'
  return roles.includes(rol)
}
