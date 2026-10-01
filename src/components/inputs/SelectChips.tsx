/**
 * Chips de selección única para opciones pocas (medio de pago, tipo de pago,
 * condición IVA, tipo de alquiler) — reemplaza un <select> cuando hay pocas
 * opciones y conviene verlas todas de un vistazo, con targets de 44px.
 *
 * Uso: <SelectChips label="Medio de pago" options={[{value:'efectivo',label:'Efectivo'}]} value={medio} onChange={setMedio} />
 */
export interface SelectChipsOption {
  value: string
  label: string
}

export interface SelectChipsProps {
  label?: string
  hint?: string
  error?: string
  options: SelectChipsOption[]
  value: string
  onChange: (value: string) => void
  required?: boolean
  className?: string
}

export default function SelectChips({ label, hint, error, options, value, onChange, required, className = '' }: SelectChipsProps) {
  return (
    <div className={className}>
      {label && (
        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">
          {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
      )}
      <div className="flex flex-wrap gap-2" role="radiogroup">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`px-3 py-2.5 rounded-lg text-xs font-bold border transition-all min-h-[44px] ${
              value === o.value ? 'bg-[#FDE047] text-black border-[#FDE047]' : 'bg-white/5 text-gray-300 border-white/10 hover:text-white'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {error ? <p className="text-[11px] text-red-400 mt-1.5">{error}</p> : hint ? <p className="text-[11px] text-gray-500 mt-1.5">{hint}</p> : null}
    </div>
  )
}
