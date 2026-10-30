# tipo-cambio

Punto 4 (30/10/2026). Consulta DolarApi (`/v1/dolares/oficial` y `/v1/dolares/blue`)
DESDE EL SERVIDOR — nunca desde el browser — y cachea el resultado en
`tipos_cambio`. Si la API falla o tarda (timeout 6s), devuelve la última
cotización guardada con `stale: true`.

Deployada en producción el 30/10/2026 (v1, verify_jwt: true). El código vive
en el dashboard de Supabase; este README queda como referencia del contrato:

    POST /functions/v1/tipo-cambio   (requiere JWT de usuario logueado)
    -> { ok, fecha, fresco, cotizaciones: { oficial: {...}, blue: {...} } }
