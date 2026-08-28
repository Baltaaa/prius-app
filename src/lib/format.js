// Formatters a nivel de módulo: se crean UNA vez para toda la app.
// Antes cada página hacía `new Intl.NumberFormat(...)` dentro del componente,
// re-creándolo por celda y por render (cientos de objetos por tecla en el buscador).

const currencyFmt = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

const dateFmt = new Intl.DateTimeFormat('es-AR')

export const formatCurrency = (val) => currencyFmt.format(Number(val) || 0)

export const formatDate = (val) => (val ? dateFmt.format(new Date(val)) : 'N/A')
