// Título de página del topbar. El Dashboard pasa `greeting` (más grande) y una
// bajada; el resto de las secciones solo el título. Con `compacto` (Home
// scrolleado) el saludo se achica al título chico y la bajada se desvanece:
// solo transform/opacity, el alto de la topbar no cambia (ver index.css
// ".greeting-wrap").
export default function PageHeader({ title, shortTitle, greeting = false, compacto = false, children }) {
  return (
    <div className={`min-w-0 ${greeting ? 'greeting-wrap' : ''}`} data-compacto={greeting ? String(compacto) : undefined}>
      <h1
        title={title}
        className={`${greeting ? 'greeting-h1 text-[24px] leading-8 md:text-topbar xl:text-page' : 'text-[20px] leading-7 md:text-topbar'} text-ink truncate`}
      >
        {shortTitle ? <><span className="xl:hidden">{shortTitle}</span><span className="hidden xl:inline">{title}</span></> : title}
      </h1>
      {greeting ? <div className="greeting-sub">{children}</div> : children}
    </div>
  )
}
