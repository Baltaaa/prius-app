import { DayPicker } from 'react-day-picker'
import { es } from 'react-day-picker/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// 'yyyy-mm-dd' <-> Date local (evita el corrimiento de un día que da
// `new Date('yyyy-mm-dd')` al parsearse como UTC medianoche).
const toDate = (str) => {
  if (!str) return undefined
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const toStr = (date) => {
  if (!date) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Mismo criterio de iniciales que Calendario.jsx (arrancando en lunes).
const DIAS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']
const formatWeekdayName = (date) => DIAS[(date.getDay() + 6) % 7]

// Layout "around": prev/caption/next quedan como hermanos de MonthGrid dentro
// de `month` (no dentro de un Nav propio) — por eso `month` se vuelve grid de
// 3 columnas y cada uno se ubica por posición, en vez de depender del orden
// del DOM. Con el layout por default ("nav" con position:absolute) los
// botones de mes quedaban posicionados contra un ancestro lejano y no se
// veían — de ahí que el calendario pareciera "sin navegación".
const classNames = {
  root: 'text-white',
  months: 'block',
  month: 'grid grid-cols-[auto_1fr_auto] grid-rows-[auto_auto] items-center gap-y-1',
  month_caption: 'col-start-2 row-start-1 flex items-center justify-center h-9',
  caption_label: 'text-xs font-bold uppercase tracking-widest text-white',
  button_previous:
    'col-start-1 row-start-1 justify-self-start p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:pointer-events-none',
  button_next:
    'col-start-3 row-start-1 justify-self-end p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:pointer-events-none',
  month_grid: 'col-span-3 row-start-2 w-full border-collapse mt-2',
  weekdays: 'flex',
  weekday: 'w-9 h-9 text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center justify-center',
  week: 'flex',
  day: 'w-9 h-9 p-0 text-center align-middle',
  day_button:
    'w-9 h-9 rounded-lg text-sm font-semibold text-gray-300 hover:bg-white/10 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-[#FDE047]/50',
  today: '[&_button]:border [&_button]:border-[#FDE047]/40',
  outside: '[&_button]:text-gray-700',
  disabled: '[&_button]:text-gray-600 [&_button]:hover:bg-transparent [&_button]:cursor-not-allowed [&_button]:opacity-40',
  selected: '[&_button]:bg-[#FDE047] [&_button]:text-black [&_button]:hover:bg-[#FDE047]',
  range_start: '[&_button]:bg-[#FDE047] [&_button]:text-black [&_button]:hover:bg-[#FDE047]',
  range_end: '[&_button]:bg-[#FDE047] [&_button]:text-black [&_button]:hover:bg-[#FDE047]',
  range_middle: '[&_button]:bg-[#FDE047]/20 [&_button]:text-white [&_button]:rounded-none',
}

const modifiersClassNames = {
  ocupado: '[&_button]:line-through [&_button]:decoration-2',
}

const Chevron = (props) => (props.orientation === 'left' ? <ChevronLeft size={16} /> : <ChevronRight size={16} />)

// Date picker Glass Dark del form de Reservas (Tarea 7, disponibilidad
// dinámica): tacha y bloquea los días ya ocupados por otra reserva
// período/día de la unidad elegida — misma regla que el exclusion constraint
// `reservas_no_overlap_periodo_dia` (ver CLAUDE.md), calculada en
// `rangosOcupadosPorUnidad` (src/lib/reservas.js). Sin unidad elegida
// todavía, no hay nada que tachar. Navegación de mes con `navLayout="around"`
// (Tarea 8-2) — el tachado/bloqueo aplica igual en cualquier mes visible,
// porque `rangosOcupados` no depende del mes mostrado.
export default function ReservaCalendar({ mode, value, onChange, rangosOcupados = [], disabled = false }) {
  const disabledRanges = rangosOcupados.map((r) => ({ from: toDate(r.desde), to: toDate(r.hasta) }))

  const shared = {
    navLayout: 'around',
    disabled: disabled ? true : disabledRanges,
    modifiers: { ocupado: disabledRanges },
    modifiersClassNames,
    classNames,
    locale: es,
    weekStartsOn: 1,
    formatters: { formatWeekdayName },
    components: { Chevron },
    showOutsideDays: true,
  }

  if (mode === 'single') {
    const selected = toDate(value)
    return <DayPicker mode="single" selected={selected} defaultMonth={selected} onSelect={(d) => onChange(toStr(d))} {...shared} />
  }

  const selected = { from: toDate(value?.desde), to: toDate(value?.hasta) }
  return (
    <DayPicker
      mode="range"
      selected={selected}
      defaultMonth={selected.from}
      onSelect={(range) => onChange({ desde: toStr(range?.from), hasta: toStr(range?.to) })}
      {...shared}
    />
  )
}
