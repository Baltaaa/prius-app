// Tema antes de que monte React (sin flash). Script clásico y bloqueante en el
// <head>: la CSP (`script-src 'self'`) no deja correr uno inline. Lee la última
// preferencia de este dispositivo (lib/tema.js la guarda en 'prius:tema') y
// pone data-theme en <html> y el color de la barra del navegador.
(function () {
  var oscuro = false
  try {
    var p = window.localStorage.getItem('prius:tema')
    oscuro = p === 'oscuro' || (p === 'sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  } catch (e) { /* sin storage: claro */ }
  document.documentElement.setAttribute('data-theme', oscuro ? 'dark' : 'light')
  var meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', oscuro ? '#0E0E0D' : '#F8F7F2')
})()
