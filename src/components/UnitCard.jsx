export default function UnitCard({ number, status = "available", type = "sombrilla", onClick }) {
  const statusStyles = {
    available: "bg-green-100 border-green-300 text-green-800 hover:bg-green-200",
    occupied: "bg-red-100 border-beach-primary text-beach-primary hover:bg-red-200",
    reserved: "bg-orange-100 border-beach-secondary text-orange-800 hover:bg-orange-200",
    maintenance: "bg-gray-100 border-gray-300 text-gray-500",
  }

  const statusLabels = {
    available: "Disponible",
    occupied: "Ocupado",
    reserved: "Reservado",
    maintenance: "Mantenimiento",
  }

  const typeIcons = {
    sombrilla: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12h2c0-3.31 2.02-6.15 4.89-7.35L10 11h4l1.11-6.35C17.98 5.85 20 8.69 20 12h2c0-5.52-4.48-10-10-10z"/>
        <path d="M11 13H7l-2 9h2l1-4h4l1 4h2l-2-9h-2z"/>
      </svg>
    ),
    carpa: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2L2 12h3v8h6v-6h2v6h6v-8h3L12 2z"/>
      </svg>
    ),
    reposera: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M4 18h16v2H4v-2zm0-4h16v2H4v-2zm5-8v6H4V6h5zm10 0v6h-5V6h5z"/>
      </svg>
    ),
  }

  return (
    <button
      onClick={onClick}
      className={`
        relative flex flex-col items-center justify-center
        p-4 rounded-xl border-2 aspect-square
        transition-all duration-200 cursor-pointer
        ${statusStyles[status]}
      `}
    >
      <div className="mb-2 opacity-70">
        {typeIcons[type] || typeIcons.sombrilla}
      </div>
      <span className="text-2xl font-bold font-display">
        {number}
      </span>
      <span className="text-xs mt-1 opacity-70">
        {statusLabels[status]}
      </span>
    </button>
  )
}
