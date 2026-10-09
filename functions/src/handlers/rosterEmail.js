import { toCsv } from '../../../shared/csv.js'
import { emailNotVerified, notFound, notOwner } from '../core/errors.js'
import { escapeHtml } from '../core/email.js'
import { EVENT_ID } from '../core/validate.js'

// "Email me the roster": the event's creator gets its registrations as a CSV,
// built here with the same serialiser the app's export uses. The recipient is
// always the caller's own verified address from the ID token, so registrant
// data can't be sent anywhere else.
const MELBOURNE_TZ = 'Australia/Melbourne'

const melbourneDateTime = new Intl.DateTimeFormat('en-AU', {
  timeZone: MELBOURNE_TZ,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})
const melbourneDay = new Intl.DateTimeFormat('en-CA', { timeZone: MELBOURNE_TZ, dateStyle: 'short' })

function fileName(title, now) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  return `ecostride-roster-${slug || 'event'}-${melbourneDay.format(now)}.csv`
}

export const rosterEmailSchema = { eventId: EVENT_ID }

export async function emailRoster({ user, body, deps }) {
  if (!user.emailVerified || !user.email) {
    throw emailNotVerified()
  }

  const event = await deps.firestore.getDocument(`events/${body.eventId}`)
  if (!event) {
    throw notFound('This event no longer exists.')
  }
  if (event.data.createdBy !== user.uid) {
    throw notOwner('Only the club member who created this event can get its roster.')
  }

  const registrations = await deps.firestore.listDocuments(`events/${body.eventId}/registrations`)
  const rows = registrations
    .map(({ data }) => data)
    .sort((a, b) => (a.registeredAt?.getTime() ?? 0) - (b.registeredAt?.getTime() ?? 0))
    .map((r) => [r.name, r.email, r.needs, r.registeredAt ? melbourneDateTime.format(r.registeredAt) : ''])
  const csv = toCsv(['Name', 'Email', 'Needs', 'Registered (Melbourne time)'], rows)

  const now = new Date()
  const title = escapeHtml(event.data.title)
  await deps.email.sendEmail({
    recipients: [{ email: user.email }],
    subject: `Roster: ${event.data.title}`,
    html:
      `<p>Attached is the roster for <strong>${title}</strong>: ` +
      `${rows.length} registrant${rows.length === 1 ? '' : 's'} as of ${melbourneDateTime.format(now)} (Melbourne time).</p>` +
      '<p>It contains personal details. Please keep it private and delete it after the event.</p>' +
      '<p>EcoStride</p>',
    attachments: [{ name: fileName(event.data.title, now), content: csv }],
  })

  return { sentTo: user.email, count: rows.length }
}
