type MailPayload = { to?: string; subject: string; html: string; from?: string; replyTo?: string }

export async function sendEmail(payload: MailPayload) {
  const webhook = process.env.MAIL_WEBHOOK_URL
  const fallbackTo = process.env.NOTIFY_EMAIL || "oscar.farias.ext@redsalud.cl"
  const from = payload.from || process.env.MAIL_FROM || "noreply@backoffice.local"
  const to = payload.to || fallbackTo
  if (!webhook) return { ok: false, skipped: true, reason: "MAIL_WEBHOOK_URL not configured" }
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (process.env.MAIL_WEBHOOK_AUTH) {
      headers.Authorization = process.env.MAIL_WEBHOOK_AUTH
    }
    const res = await fetch(webhook, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...payload, to, from, replyTo: payload.replyTo }),
    })
    if (!res.ok) return { ok: false, skipped: false, status: res.status }
    return { ok: true }
  } catch (err) {
    return { ok: false, skipped: false, error: String(err) }
  }
}
