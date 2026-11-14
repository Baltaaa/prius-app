// Tema antes de que monte React, y antes del primer pintado: sin flash de
// ningún color. Script clásico y bloqueante en el <head> — NO inline, porque
// la CSP de producción (`script-src 'self'`) no deja correr scripts inline.
//
// Lee la última preferencia de este dispositivo (lib/tema.js la guarda en
// 'prius:tema'; sin preferencia guardada sigue a prefers-color-scheme) y deja
// listo, antes de que el navegador pinte nada:
//   - data-theme en <html> (los tokens de index.css cuelgan de ahí),
//   - el background de <html> y <body> con el canvas del tema — el CSS puede
//     llegar un frame más tarde y ese frame se veía blanco (o negro),
//   - el color de la barra del navegador en mobile (meta theme-color).
(function () {
  var CANVAS = { dark: '#0E0E0D', light: '#F8F7F2' }
  var oscuro = false
  try {
    var p = window.localStorage.getItem('prius:tema')
    if (p === 'oscuro') oscuro = true
    else if (p === 'claro') oscuro = false
    else oscuro = window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch (e) { /* sin storage: claro */ }
  var tema = oscuro ? 'dark' : 'light'
  var html = document.documentElement
  html.setAttribute('data-theme', tema)
  html.style.backgroundColor = CANVAS[tema]
  html.style.colorScheme = tema
  var meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', CANVAS[tema])
})()
