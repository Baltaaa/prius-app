// Entrada de cards: fade + subida de 8px, escalonada de a 40ms con `index`.
// Usa la animación de página: fill `backwards`, así al terminar no queda
// ningún transform que atrape a un `position: fixed` de adentro.
export default function Reveal({ index = 0, className = '', children, as: Tag = 'div' }) {
  return (
    <Tag className={`anim-fade-up-page ${className}`} style={{ animationDelay: `${index * 40}ms` }}>
      {children}
    </Tag>
  )
}
