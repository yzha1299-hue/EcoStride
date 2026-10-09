import { ApiError } from './errors.js'
import { fetchUpstream } from './upstream.js'

// The one way the API sends email. Handlers call
//   sendEmail({ recipients: [{ email, name? }], subject, html, attachments, replyTo? })
// and never see the provider, so swapping Brevo for another service means
// changing only this file. Each attachment is { name, content } with text
// (e.g. a CSV) or bytes, or { name, base64 } when it is already encoded.
//
// With several recipients each gets their own copy (Brevo "message
// versions"), so nobody sees anyone else's address.
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'
// Recipients per Brevo request; larger lists go out in several requests.
const BATCH_SIZE = 500

export function createEmailSender({ apiKey, senderEmail, senderName = 'EcoStride' }) {
  async function sendEmail({ recipients, subject, html, attachments = [], replyTo }) {
    if (!apiKey || !senderEmail) {
      throw new ApiError(503, 'EMAIL_UNAVAILABLE', "Email isn't set up on the server yet.")
    }
    if (!recipients.length) {
      return
    }

    const message = {
      sender: { email: senderEmail, name: senderName },
      subject,
      htmlContent: html,
    }
    if (replyTo) {
      message.replyTo = replyTo
    }
    if (attachments.length) {
      message.attachment = attachments.map(({ name, content, base64 }) => ({
        name,
        content: base64 ?? toBase64(content),
      }))
    }

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE)
      const addressed =
        batch.length === 1
          ? { ...message, to: batch }
          : { ...message, messageVersions: batch.map((recipient) => ({ to: [recipient] })) }
      await fetchUpstream(
        'The email service',
        BREVO_URL,
        {
          method: 'POST',
          headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(addressed),
        },
        { timeoutMs: 15000 },
      )
    }
  }

  return { sendEmail }
}

// Brevo takes attachments as base64. Text is encoded as UTF-8 first, so a
// CSV's byte-order mark and non-ASCII names survive.
function toBase64(content) {
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

// For putting user-entered text (event titles, names) into an HTML body.
export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
