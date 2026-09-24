import { ApiError, emailNotVerified, notFound, notOwner } from '../core/errors.js'
import { escapeHtml } from '../core/email.js'
import { encodeFields, retryOnConflict } from '../core/firestore.js'
import { eventToIcs } from '../core/ics.js'
import { EVENT_ID } from '../core/validate.js'

// A club member emails everyone registered for their event. Recipients are
// read here from the registrations, never sent by the browser, and each gets
// an individual copy with the event's calendar invite attached (plus an
// optional flyer).
const MELBOURNE_TZ = 'Australia/Melbourne'
export const DAILY_LIMIT = 5

const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024
// Allowed uploads: type -> accepted file extensions and the bytes every such
// file starts with, so a renamed .exe can't pass as a PDF.
const ATTACHMENT_TYPES = {
  'application/pdf': { extensions: ['.pdf'], magic: [0x25, 0x50, 0x44, 0x46] },
  'image/png': { extensions: ['.png'], magic: [0x89, 0x50, 0x4e, 0x47] },
  'image/jpeg': { extensions: ['.jpg', '.jpeg'], magic: [0xff, 0xd8, 0xff] },
}

export const emailRegistrantsSchema = {
  eventId: EVENT_ID,
  subject: { type: 'string', required: true, maxLength: 150 },
  message: { type: 'string', required: true, maxLength: 5000 },
  attachmentName: { type: 'string', maxLength: 120 },
  attachmentType: { type: 'string', maxLength: 50 },
  // base64 of at most 2 MB; the exact decoded size is checked below.
  attachmentData: { type: 'string', maxLength: 2_800_000 },
}
// Room for a 2 MB attachment once base64-encoded, plus the message.
export const EMAIL_REGISTRANTS_MAX_BODY_BYTES = 3_000_000

const attachmentInvalid = (message) => new ApiError(400, 'ATTACHMENT_INVALID', message)

// Returns the attachment ready for sendEmail, or null if none was sent.
export function checkAttachment({ attachmentName: name, attachmentType: type, attachmentData: data }) {
  if (!name && !type && !data) {
    return null
  }
  if (!name || !type || !data) {
    throw attachmentInvalid('The attachment is incomplete. Please choose the file again.')
  }
  const allowed = ATTACHMENT_TYPES[type]
  const lowerName = name.toLowerCase()
  if (!allowed || !allowed.extensions.some((extension) => lowerName.endsWith(extension))) {
    throw attachmentInvalid('Attachments must be a PDF, PNG or JPG file.')
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data) || data.length % 4 !== 0) {
    throw attachmentInvalid("The attachment couldn't be read. Please choose the file again.")
  }
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0
  if ((data.length / 4) * 3 - padding > MAX_ATTACHMENT_BYTES) {
    throw attachmentInvalid('Attachments must be 2 MB or smaller.')
  }
  const head = atob(data.slice(0, 8))
  if (!allowed.magic.every((byte, i) => head.charCodeAt(i) === byte)) {
    throw attachmentInvalid("The attachment's contents don't match its file type.")
  }
  // Keep only a plain file name (no paths or control characters).
  const safeName = [...name].map((char) => (char < ' ' || '\\/:*?"<>|'.includes(char) ? '_' : char)).join('')
  return { name: safeName, base64: data }
}

const melbourneDay = new Intl.DateTimeFormat('en-CA', { timeZone: MELBOURNE_TZ, dateStyle: 'short' })
const longDate = new Intl.DateTimeFormat('en-AU', {
  timeZone: MELBOURNE_TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const timeOfDay = new Intl.DateTimeFormat('en-AU', {
  timeZone: MELBOURNE_TZ,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

// One counter per event per Melbourne day, e.g. emailRateLimits/bike-basics_2026-09-24.
// Taking a slot and counting it happen in one preconditioned commit, so two
// sends at the same moment can't both take the 5th slot.
async function reserveSendSlot(firestore, eventId, now) {
  const day = melbourneDay.format(now)
  const path = `emailRateLimits/${eventId}_${day}`
  return retryOnConflict(
    async () => {
      const record = await firestore.getDocument(path)
      const used = record?.data.count ?? 0
      if (used >= DAILY_LIMIT) {
        throw new ApiError(
          429,
          'RATE_LIMITED',
          `You've sent ${DAILY_LIMIT} emails about this event today, which is the daily limit. Please try again tomorrow.`,
        )
      }
      const name = firestore.documentName(path)
      await firestore.commit([
        record
          ? {
              transform: { document: name, fieldTransforms: [{ fieldPath: 'count', increment: { integerValue: '1' } }] },
              currentDocument: { updateTime: record.updateTime },
            }
          : { update: { name, fields: encodeFields({ eventId, day, count: 1 }) }, currentDocument: { exists: false } },
      ])
      return { path, remaining: DAILY_LIMIT - used - 1 }
    },
    () => new ApiError(409, 'CONFLICT', 'Another email is being sent right now. Please try again.'),
  )
}

// A send that failed shouldn't use up one of the day's slots. Best effort: if
// this fails too, the worst case is one slot lost for the day.
async function releaseSendSlot(firestore, path) {
  try {
    await firestore.commit([
      {
        transform: {
          document: firestore.documentName(path),
          fieldTransforms: [{ fieldPath: 'count', increment: { integerValue: '-1' } }],
        },
      },
    ])
  } catch {
    // Ignored; see above.
  }
}

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'event'
}

function emailHtml(event, message) {
  const paragraphs = escapeHtml(message)
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => `<p>${paragraph.replace(/\r?\n/g, '<br>')}</p>`)
    .join('')
  const when = `${longDate.format(event.startsAt)}, ${timeOfDay.format(event.startsAt)} - ${timeOfDay.format(event.endsAt)} (Melbourne time)`
  const where = [event.venue, event.address].filter(Boolean).map(escapeHtml).join(', ')
  return (
    paragraphs +
    '<hr>' +
    `<p style="color:#444"><strong>${escapeHtml(event.title)}</strong>` +
    (event.status === 'cancelled' ? ' <strong style="color:#b02a37">(cancelled)</strong>' : '') +
    `<br>${when}<br>${where}</p>` +
    '<p style="color:#666;font-size:12px">You are receiving this because you registered for this event on EcoStride. ' +
    'The attached calendar invite adds it to your calendar. Reply to this email to contact the organiser.</p>'
  )
}

export async function emailRegistrants({ user, body, deps }) {
  if (!user.emailVerified || !user.email) {
    throw emailNotVerified()
  }
  const attachment = checkAttachment(body)

  const event = await deps.firestore.getDocument(`events/${body.eventId}`)
  if (!event) {
    throw notFound('This event no longer exists.')
  }
  if (event.data.createdBy !== user.uid) {
    throw notOwner('Only the club member who created this event can email its registrants.')
  }

  const registrations = await deps.firestore.listDocuments(`events/${body.eventId}/registrations`)
  const recipients = registrations
    .map(({ data }) => data)
    .filter((registration) => registration.email)
    .map((registration) => ({ email: registration.email, name: registration.name }))
  if (!recipients.length) {
    throw new ApiError(409, 'NO_RECIPIENTS', 'Nobody has registered for this event yet, so there is no one to email.')
  }

  const now = new Date()
  const slot = await reserveSendSlot(deps.firestore, body.eventId, now)

  const eventData = { id: body.eventId, ...event.data }
  const attachments = [{ name: `${slug(event.data.title)}.ics`, content: eventToIcs(eventData, { now }) }]
  if (attachment) {
    attachments.push(attachment)
  }

  try {
    await deps.email.sendEmail({
      recipients,
      // A subject is one line.
      subject: body.subject.replace(/\s+/g, ' '),
      html: emailHtml(eventData, body.message),
      attachments,
      replyTo: { email: user.email },
    })
  } catch (error) {
    await releaseSendSlot(deps.firestore, slot.path)
    throw error
  }

  return { sent: recipients.length, remainingToday: slot.remaining }
}
