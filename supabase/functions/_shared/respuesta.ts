// Helpers de respuesta JSON compartidos por las Edge Functions de reservas
// públicas (Fase 2, oct 2026). Todas responden siempre con los headers de
// CORS del request, pasados por quien llama.

export function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  })
}

export function datosInvalidos(campos: Record<string, string>, cors: Record<string, string>): Response {
  return json({ ok: false, error: "datos_invalidos", campos }, 400, cors)
}

export function captchaInvalido(cors: Record<string, string>): Response {
  return json({ ok: false, error: "captcha_invalido", mensaje: "No pudimos validar que sos una persona. Probá de nuevo." }, 403, cors)
}

export function rateLimited(cors: Record<string, string>): Response {
  return json({ ok: false, error: "rate_limited", mensaje: "Demasiados intentos. Esperá un momento y probá de nuevo." }, 429, cors)
}

export function errorInterno(detalle: unknown, cors: Record<string, string>): Response {
  console.error("[reservas-publicas] error interno:", detalle)
  return json(
    { ok: false, error: "interno", mensaje: "No pudimos procesar la reserva. Probá de nuevo en unos minutos." },
    500,
    cors,
  )
}
