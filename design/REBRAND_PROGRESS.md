# Rebranding Prius App — Progreso

Rama: rebrand/orvio. Al inicio de cada sesión: rebase sobre main. Los hotfixes van a main.
Fuente de verdad del diseño: design/DESIGN.md. Referencia visual: design/reference/.

## Estado por fase
- [x] Fase 0 — Inventario (aprobado 2/11/2026)
- [x] Fase 1 — Tokens y codemod
- [x] Fase 2 — Primitivas y componentes brand
- [x] Fase 3 — Piloto Dashboard
- [ ] Fase 4 — Rollout por pantalla
- [ ] Fase 5 — Modales y overlays
- [ ] Fase 6 — Auditoría final

## Baseline (antes de tocar nada)
JS 1533,1 KB (461,1 KB gzip) · CSS 131,9 KB (25,8 KB gzip) · fuentes 284,1 KB · 88 chunks
Chunk principal index 128,1 KB gzip · lint 0 errores, 23 warnings · typecheck OK
vitest 77/78: falla format.test.ts ("Unidad carpa #74"), previo al rebranding y ajeno a estilos.

## Después de Fase 1
JS 1524,1 KB (459,1 KB gzip) · CSS 73,3 KB (16,7 KB gzip) · fuentes 70,7 KB · 88 chunks.
Codemod: 3.595 clases en 84 archivos. lint 0 errores, typecheck OK, vitest igual que el baseline.
Pendientes de Fase 4: text-xs y text-[8-13px], uppercase/tracking, hex en DateInput.tsx:248-252 y Dashboard.jsx:863-865.
Cambio respecto de la tabla: text-prius-success va a text-success-ink, porque el verde sólido da 3,3:1 sobre blanco.

## Decisiones de ejecución
- Playwright corre con la cuenta de .env.local, por pedido del usuario (2/11/2026), siempre detrás del guard.
- Sin frenos intermedios: el usuario pidió seguir de punta a punta.
- Motion descartado por presupuesto: +30,3 KB gzip (domAnimation) y +45,4 KB (domMax), tope +25 KB.
- Los snapshots guardados del plano son anteriores al rediseño Stitch. El mapa se comparó contra main en vivo: solo cambia la fuente.
- Zoom mínimo en 1440 y 768: ningún número de celda se corta.

## Reglas de ejecución
- Playwright solo con playwright.rebrand.config.ts + e2e/guard.ts (lista blanca): E2E_BASE_URL=http://localhost:5197 RUTAS=home npx playwright test --config playwright.rebrand.config.ts e2e/rebrand-shots.spec.ts --project=desktop-1440. Nunca la config por defecto: su globalTeardown borra datos en producción.
- e2e/reservas.spec.ts no se corre.

## Rollout (Fase 4)
- [x] Dashboard (piloto, Fase 3)
- [ ] Plano (entorno)
- [ ] Reservas
- [ ] Recepción
- [ ] Clientes
- [ ] Caja Diaria
- [ ] Reportes
- [ ] Leads
- [ ] Historial
- [ ] Comprobantes
- [ ] Mi cuenta
- [ ] Cabinas y Lockers
- [ ] Notificaciones
- [ ] Ocupación
- [ ] Login
- [ ] CambiarContrasena
- [ ] NotFound
- [ ] dev/PlanoPublicoPreview

# Inventario Fase 0

## Rutas y páginas
/, /login, /recuperar: pages/Login.jsx
/restablecer-contrasena, /cambiar-contrasena: pages/CambiarContrasena.jsx
/app/home: pages/crm/Home.jsx
/app/plano: pages/Dashboard.jsx
/app/cabinas-lockers: CabinasLockers.jsx
/app/recepcion: pages/Recepcion.jsx
/app/reservas: Reservas.jsx
/app/clientes: Clientes.jsx
/app/caja: Caja.jsx
/app/reportes: Reportes.jsx
/app/leads: Leads.jsx
/app/ocupacion: Ocupacion.jsx (flag apagada, igual se reestiliza)
/app/historial: Actividad.jsx + crm/Historial.jsx
/app/notificaciones: Notificaciones.jsx
/app/comprobantes: Comprobantes.jsx
/app/perfil: Perfil.jsx
/app/dev/plano-publico: dev/PlanoPublicoPreview.jsx
404: crm/NotFound.jsx

## Layouts y shell
layouts/AppLayout, ui-prius/AppShell, ui-prius/NavRail, crm/Sidebar, crm/TopBar, crm/BottomNav, crm/AppFooter, crm/ScrollToTopButton, ui/GlobalLoader

## Modales sobre Modal.jsx
RegistrarPago, RegistrarGasto, ReservaFormModal (Nueva reserva), ReservaDetalleModal, DetallePago, DetalleGasto, CambiarEstadoPagoModal, GestionCosociosModal, AsignarUnidadModal, MoverUnidadDialog, ClimaPanel, EscanearQR, 3 modales inline en Clientes.jsx (líneas 1044, 1216, 1308)

## Overlays manuales
ConfirmarSuperadminModal, InactivityWarningModal, CerrarCajaStepper, UnidadPreviewModal, confirm/alert de DialogProvider (16 llamadas), sheet "Más" de BottomNav, plano fullscreen en Dashboard.jsx, pantalla negra de Recepcion.jsx:28

## Sheets y drawers
ui-prius/BottomSheet (Reservas, Clientes, Historial, HistorialDetalle), drawer 1024-1279 de Reservas.jsx:693, fichas mobile a pantalla completa (Reservas.jsx:752, Clientes.jsx:1003)

## Dropdowns, popovers y pickers
BrandSelect, DateInput, ReservaCalendar, ClienteBuscador, búsqueda global (dropdown desktop y pantalla mobile), Notificaciones (popover y hoja mobile), menú de perfil, tooltips de Cell.jsx (congelados)

## Toasts
Único sistema: context/DialogProvider.jsx (23 llamadas; tonos default, success, error, con action opcional)

## Estados vacíos
ClienteBuscador, ClienteDetalleContent, GestionCosociosModal, Historial, NotificacionesBandeja, RegistrarPago, ReservaDetalleModal, ReservaPagosCard, ResumenCaja, SaldoReserva, ClimaChip, ClimaHero, ClimaPanel, CabinasLockers, Caja, Clientes, Comprobantes, Home, Ocupacion, Reportes, BrandSelect, búsqueda de TopBar

## Skeletons
ui/Skeleton.jsx (Home, Caja, Clientes, Comprobantes, Reportes, Reservas, Recepcion, Dashboard, Historial, PlanoStatsBar) + .skeleton-shimmer

## Para borrar (código muerto confirmado sin importadores)
src/components/ui/*.tsx y .ts en minúscula (salvo BrandSelect.tsx), src/components/hooks/*, theme-provider.tsx, styles/globals.css, UnitCard, ui/BeachFlowLogo, crm/ClienteDrawer, crm/ClienteSelector, crm/KpiCard, dashboard/SettingsPanel, dashboard/UnitModal, ui-prius/{Input,Button,ListItem,Card,Chip}. Antes de borrar se reconfirma con build y lib/utils.ts (sin usos fuera de esos archivos).
Quedan: BrandSelect, GlobalLoader, LoadingButton, MonedaSwitch, MontoStat, ScrollFade, Skeleton (mayúscula), WhatsAppIcon.

## Estilos hardcodeados
Totales en src/ (sin shadcn muerto excluido del detalle): 1.988 tokens prius/gold/hairline, 996 colores Tailwind, 791 rounded-*, 174 hex, 106 shadow, 41 fuentes, 28 rgb.
Detalle: archivo hex/rgb/tailwind/token/shadow/rounded/font

pages/Login 18/1/62/1/1/16/5; CambiarContrasena 0/0/14/17/0/6/1; Recepcion 2/0/22/71/2/23/0; Dashboard 3/2/19/39/0/20/2
crm/Caja 0/0/54/146/1/51/3; Home 0/0/34/68/0/32/2; Clientes 0/0/21/63/4/15/1; Reservas 0/0/19/37/0/9/2; Reportes 1/0/23/40/2/19/0; Ocupacion 0/0/19/45/0/26/0; Leads 0/0/17/32/0/11/0; Perfil 0/0/12/29/0/11/1; Comprobantes 1/0/2/14/2/7/0; CabinasLockers 0/0/4/29/0/9/0; NotFound 0/0/2/4/0/1/0; Notificaciones 0/0/0/0/0/1/0; dev/PlanoPublicoPreview 0/0/3/3/0/2/0
index.css 19/15/0/1/6/2/5; layouts/AppLayout 0/0/0/1/0/0/0
components/crm: TopBar 0/5/26/68/7/20/1; ReservaDetalleContent 0/0/30/49/0/15/0; DetallePago 0/0/27/58/0/15/0; StatusBadge 0/0/24/0/0/1/0; ReservaFormModal 0/0/17/77/2/17/0; Historial 0/0/19/52/0/22/0; ResumenCaja 0/0/18/71/0/14/0; CerrarCajaStepper 0/0/15/38/2/8/0; ClienteDetalleContent 0/0/14/35/0/8/0; BottomNav 0/0/14/21/0/11/1; PagoComprobanteCampos 0/0/12/30/1/7/0; DetalleGasto 0/0/13/20/0/5/0; ConfirmarSuperadminModal 0/0/12/14/1/7/0; NotificacionesBandeja 0/0/11/30/0/7/0; ClienteBuscador 0/0/10/25/0/7/0; Sidebar 0/0/10/20/0/7/1; ReservaDetalleModal 0/0/10/28/0/4/0; ReservaCalendar 1/0/8/17/0/4/0; RegistrarPago 0/0/7/22/1/7/0; HistorialDetalle 0/0/8/20/0/9/0; ReservaPagosCard 0/0/7/31/0/6/0; GestionCosociosModal 0/0/6/9/0/4/0; Modal 0/0/4/11/1/4/0; ReservaListaMobile 0/0/5/9/0/4/0; InactivityWarningModal 0/0/3/13/1/6/0; CambiarEstadoPagoModal 0/0/2/12/0/3/0; MontoReserva 0/0/3/3/0/1/0; RegistrarGasto 0/0/1/4/1/1/0; ScrollToTopButton 1/0/1/0/0/1/0; AvisoCajaCerrada 0/0/1/6/0/2/0; DataTable 0/0/1/5/0/3/0; AppFooter 0/0/1/6/0/2/0; SaldoReserva 0/0/0/4/0/0/0
components/dashboard: PlanoStatsBar 15/0/22/31/0/16/0; UnidadDetalleContent 1/0/29/47/0/21/0; ClimaPanel 1/0/19/25/0/9/0; ClimaChip 0/0/14/21/0/7/0; ClimaHero 0/0/11/28/0/9/1; PlanoMobile 0/0/5/15/0/8/0; MoverUnidadDialog 0/0/7/9/1/3/0; AsignarUnidadModal 0/0/4/5/1/1/0; PlanoLeyenda 1/0/2/10/0/5/0; PlanoZoomBar 1/0/1/1/0/1/0; UnidadPreviewModal 0/0/2/2/0/2/0; UnidadDetallePanel 0/0/0/1/0/1/0
inputs: DateInput 6/3/4/10/1/2/0; MoneyInput 0/0/5/13/0/2/0; IntegerInput, TextInput, PhoneInput, CuitInput, SearchInput, DniInput (3 tailwind, 5-9 tokens, 1 rounded cada uno)
ui propios: BrandSelect 0/0/9/19/0/4/0; GlobalLoader 4/0/1/0/0/0/0; MonedaSwitch 0/0/4/3/1/2/0; Skeleton 1/0/0/2/0/1/0; LoadingButton 1/0/0/0/0/0/0
ui-prius: NavRail 0/0/5/7/0/3/1; BottomSheet 0/0/3/4/0/4/2; AppShell 0/0/2/0/0/0/1
otros: context/DialogProvider 0/0/11/17/2/6/0; recepcion/EscanearQR 0/0/2/5/0/2/0; hooks/useDeepLinkTarget 1 hex; lib/highlight 1 hex

Excepciones (no se reestilizan):
Plano: dashboard/Cell 5/2/13/1/4/3/0; CellMobile 3/0/6/3/0/1/0 (colores de estado); plano/PlanoGrid 0/0/17/0/0/4/0; PlanoViewport 2/0/6/0/0/3/0; CeldaPublica 4/0/10/0/0/1/0; lib/colors.ts 6/0/13.
Impresión: PlanoImpresion 25/0/0/0/1/0/1; ComprobanteDocumento 21/0/0/0/0/0/2; CajaImpresion 10/0/0/0/1/0/1; ComprobanteImpresionDoble 1 hex; lib/imprimirDocumento 1 hex.

Fuera de JS/TS: 15 clases globales con color en index.css (.card-light 90 usos, .glass-card 11, .sticky-blur 6, .popover-light 5, .glass-tooltip 4, .glass-popover 3, autofill, scrollbar, hover-row, focus-ring, deep-link-highlight).
