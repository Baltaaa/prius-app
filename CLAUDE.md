# Prius App — Contexto del proyecto

## Quién soy yo (Balta) y para quién es esto
Desarrollador/consultor externo construyendo la plataforma digital de **Prius Playa Grande**, un balneario en Mar del Plata, Argentina. Trabajo para el dueño del balneario (cliente), no soy parte interna del negocio. Todo el trabajo y la comunicación es en **español**.

## Qué es Prius App
CRM a medida que reemplaza por completo el flujo manual en Excel del balneario: plano de playa, caja diaria y reservas de temporada. Es distinto del sitio público (repo `beachFlow`, solo landing page pública).

## Repos
- `priusApp`: el CRM completo (login, dashboard, plano, etc.) — **este repo**.
- `beachFlow`: se mantiene solo para la landing pública.

## Stack técnico
- React 19 + TypeScript + Vite
- Tailwind CSS v3
- React Router DOM v7
- Supabase (auth, DB, Edge Functions, Realtime)
- shadcn/ui + lucide-react

## Vocabulario de dominio (usar estos términos, no traducir)
- **Carpas / sombrillas**: unidades de playa alquilables.
- **Plano interactivo**: mapa visual de la playa con el estado de cada unidad.
- **Caja diaria**: registro de movimientos de dinero del día.
- **Preconfirmada**: estado intermedio de una reserva.
- **ARCA / AFIP**: autoridad fiscal argentina.
- **Mercado Pago**: pasarela de pago principal candidata.
- **CUIT / clave fiscal**: credenciales fiscales argentinas.

## Estructura de datos (Supabase — 6 tablas)
1. `clientes`
2. `unidades` (carpas/sombrillas)
3. `reservas`
4. `pagos`
5. `caja_diaria`
6. `gastos_caja`

## Módulos del CRM (7)
Home, Plano, Reservas, Clientes, Caja, Reportes, + el dashboard de plano existente.

## Principio arquitectónico clave (del catch-up con el dueño, julio 2026)
El dueño piensa el sistema como **cliente-céntrico y reactivo en tiempo real**, no como módulos aislados. Toda acción del cliente (reserva, pago, check-in, consumo de servicio) debe:
1. Escribir en `reservas` / `pagos` (fuente de verdad única).
2. Propagarse automáticamente y en tiempo real a:
   - **Plano interactivo** → cambia estado visual de la unidad (libre / ocupada / pendiente de pago).
   - **Caja diaria** → genera el movimiento correspondiente sin carga manual.
   - **Reportes** → se recalculan en vivo.
   - **Listados de clientes/reservas** → reflejan el estado actualizado.

**Implementación esperada:** patrón "single write, multiple reactive reads" usando Supabase Realtime. Evitar que cada pantalla (Plano, Caja, Reportes) dispare su propia lógica de escritura; todas deben suscribirse al mismo canal reactivo sobre `reservas`/`pagos`, idealmente con triggers de Postgres que actualicen `unidades.estado` y `caja_diaria`/`gastos_caja` automáticamente al insertar una reserva o un pago.

## Sistema de reservas públicas (planificado, sin auth)
- Sin login para el cliente final.
- Mismo proyecto Supabase que el CRM, sincronizado en tiempo real.
- Precio varía según método de pago.
- Grupos de más de 6 personas → dispara una segunda unidad automáticamente.
- El hold de la reserva dura hasta el día del check-in.
- Códigos de reserva únicos para recepción (formato: `PRIUS-A3X9K2`).
- **Seguridad crítica:** todos los writes públicos pasan por Supabase Edge Functions, nunca inserts directos desde el cliente. RLS en la anon key restringe a solo lectura de disponibilidad.

## Diseño ("Quiet Luxury")
- Colores: `#FFFFFF`, `#F2CA50`, `#000000`, `#E5E5E5`
- Tipografía: Inter
- Estética plana: sin sombras, sin gradientes
- Mobile-first, con bottom nav bar en pantallas chicas. La versión mobile debe sentirse como una app nativa de Play Store: totalmente interactiva, moderna, prolija visualmente e intuitiva — no una web responsive genérica.

## Pendiente / en foco ahora (migración a Claude Code)
- Pasarela de pago: Mercado Pago Checkout Pro (candidata principal) vs Payway vs Mobbex — evaluar comisiones.
- Facturación ARCA/AFIP: requiere CUIT + certificado + integración WSFEv1 (o servicio intermediario).
- Edge Functions para reservas públicas.
- DNS: dominio `priusplayagrande.com.ar` en NIC.ar, delegado a Cloudflare (no transferencia, `.com.ar` no soportado como registrar en Cloudflare).

## Preferencias de trabajo
- Prompts flat, concisos, sin tablas markdown ni headers pesados (para no gastar tokens de más con agentes de IA).
- Deliverables para el dueño del balneario: lenguaje no técnico, orientado a beneficios de negocio, no a implementación.
- Diseño: se trabaja primero en Google Stitch (exporta ZIP con `DESIGN.md` + `code.html` + `screen.png`) antes de pasar a código.

## Aprendizajes de prompt engineering (relevantes también para Claude Code)
- Instrucciones abstractas generan que el agente invente componentes nuevos que no pedimos.
- Es mejor dar el código fuente real en el prompt que descripciones abstractas o listas de archivos.
- Preferir "borrar y reemplazar" explícito en vez de "mejorar" cuando se pide refactor.
