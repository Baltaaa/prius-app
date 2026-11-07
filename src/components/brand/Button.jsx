import { Loader2 } from 'lucide-react'

// `.btn*` viven en index.css para que LoadingButton y los <Link> usen la
// misma forma sin envolver nada.
const VARIANTES = {
  primary: 'btn-primary',
  gold: 'btn-gold',
  grafito: 'btn-grafito',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
}

export default function Button({ variant = 'primary', icon: Icon, loading = false, disabled, className = '', type = 'button', children, ...rest }) {
  return (
    <button type={type} disabled={disabled || loading} aria-busy={loading} className={`btn ${VARIANTES[variant]} ${className}`} {...rest}>
      {loading ? <Loader2 size={18} strokeWidth={1.5} className="animate-spin motion-reduce:animate-none" /> : Icon && <Icon size={18} strokeWidth={1.5} />}
      {children}
    </button>
  )
}

export function IconButton({ icon: Icon, label, className = '', type = 'button', size = 20, ...rest }) {
  return (
    <button type={type} title={label} aria-label={label} className={`btn-icon ${className}`} {...rest}>
      <Icon size={size} strokeWidth={1.5} />
    </button>
  )
}
