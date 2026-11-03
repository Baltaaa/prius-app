// Título de página del topbar. El Dashboard pasa `greeting` (más grande) y una
// bajada; el resto de las secciones solo el título.
export default function PageHeader({ title, shortTitle, greeting = false, children }) {
  return (
    <div className="min-w-0">
      <h1 className={`text-[20px] leading-7 md:text-page ${greeting ? 'xl:text-greeting' : ''} text-ink truncate`}>
        {shortTitle ? <><span className="xl:hidden">{shortTitle}</span><span className="hidden xl:inline">{title}</span></> : title}
      </h1>
      {children}
    </div>
  )
}
