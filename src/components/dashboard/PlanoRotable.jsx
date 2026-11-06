// Capa que gira el plano 180° (botón "Rotar") para mostrarle al cliente la vista desde la
// entrada. Envuelve al PlanoGrid SIN tocar su geometría: la capa mide lo mismo que el mapa y gira
// sobre su propio centro, así el encuadre, el zoom, el arrastre y los taps (que miran el tamaño
// del contenido, no su orientación) funcionan igual rotado.
//
// El giro es un `transform: rotate` de 600ms (index.css, `.plano-rotable`). Los números y las
// etiquetas (`.plano-contra`) giran en sentido contrario con la misma curva y duración, así se
// leen siempre derechos, también durante la animación. Todo va por variables CSS heredadas:
// girar no vuelve a renderizar ninguna de las ~184 celdas.
export default function PlanoRotable({ rotado, children }) {
  return (
    <div
      data-plano-rotable
      data-rotado={rotado ? 'true' : 'false'}
      className="plano-rotable flex flex-col items-center"
      style={{ '--plano-giro': rotado ? '180deg' : '0deg', '--plano-contra': rotado ? '-180deg' : '0deg' }}
    >
      {children}
    </div>
  )
}
