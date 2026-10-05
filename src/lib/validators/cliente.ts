import { cuitValido, emailValido } from '../parse'

// Única fuente de verdad de validación del alta/edición de cliente — usada
// tanto en Clientes.jsx como en el alta inline de Reservas.jsx (oct 2026,
// antes este último no validaba nada). Espeja las mismas reglas que los
// CHECK de la base (clientes_cuit_formato_check / clientes_dni_formato_check).
export interface ClienteFormValues {
  nombre: string
  telefono: string | null
  condicionIva: string
  cuit: string
  mail?: string
}

export interface ClienteFormErrors {
  nombre?: string
  telefono?: string
  cuit?: string
  razonSocial?: string
  mail?: string
}

export function requiereCuitClienteForm(condicionIva: string): boolean {
  return condicionIva === 'responsable_inscripto' || condicionIva === 'exento'
}

export function validarClienteForm(values: ClienteFormValues, razonSocial = ''): ClienteFormErrors {
  const errors: ClienteFormErrors = {}
  if (!values.nombre || values.nombre.trim().length < 2) errors.nombre = 'Ingresá el nombre completo'
  if (!values.telefono) errors.telefono = 'Ingresá un teléfono válido'
  if (requiereCuitClienteForm(values.condicionIva) && (values.cuit.length !== 11 || !cuitValido(values.cuit))) {
    errors.cuit = 'CUIT inválido'
  }
  if (values.condicionIva === 'responsable_inscripto') {
    const rs = razonSocial.trim()
    if (rs.length < 2 || rs.length > 120) errors.razonSocial = 'Entre 2 y 120 caracteres'
  }
  if (values.mail && !emailValido(values.mail)) errors.mail = 'Email inválido'
  return errors
}

export function clienteFormValido(values: ClienteFormValues, razonSocial = ''): boolean {
  return Object.keys(validarClienteForm(values, razonSocial)).length === 0
}
