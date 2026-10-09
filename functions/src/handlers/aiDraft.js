import { descriptionPrompt, emailPrompt, parseDraft } from '../ai/drafts.js'
import { releaseDailySlot, reserveDailySlot } from '../core/dailyLimit.js'
import { ApiError, notFound, notOwner } from '../core/errors.js'
import { EVENT_ID } from '../core/validate.js'

// "Draft with AI" for club members: an email to an event's registrants, or a
// description for the event form. The Worker holds the Gemini key and builds
// the prompt itself, from event details only - registrations are never read
// here, so no registrant data can reach the AI service. The draft is only
// returned to the organiser to edit; nothing is sent or saved.
export const AI_DAILY_LIMIT = 20

const text = (maxLength) => ({ type: 'string', maxLength })

export const aiDraftSchema = {
  kind: { type: 'string', required: true, maxLength: 30, pattern: /^(registrant-email|event-description)$/ },
  // registrant-email: the event to write about (must be the caller's).
  eventId: { ...EVENT_ID, required: false },
  // event-description: what has been typed into the event form so far.
  title: text(120),
  eventType: text(60),
  venue: text(120),
  address: text(200),
  access: text(300),
  clubName: text(120),
  instructions: text(500),
}

async function requireClubMember(firestore, uid) {
  const profile = await firestore.getDocument(`users/${uid}`)
  if (profile?.data.role !== 'clubMember') {
    throw new ApiError(403, 'NOT_CLUB_MEMBER', 'Only club members can use AI drafting.')
  }
}

async function promptFor(body, user, firestore) {
  if (body.kind === 'registrant-email') {
    if (!body.eventId) throw new ApiError(400, 'INVALID_REQUEST', 'eventId is required.')
    const event = await firestore.getDocument(`events/${body.eventId}`)
    if (!event) throw notFound('This event no longer exists.')
    if (event.data.createdBy !== user.uid) {
      throw notOwner('Only the club member who created this event can draft emails about it.')
    }
    return emailPrompt(event.data, body.instructions)
  }

  await requireClubMember(firestore, user.uid)
  if (!body.title) throw new ApiError(400, 'INVALID_REQUEST', 'Give the event a title first.')
  return descriptionPrompt(
    {
      title: body.title,
      type: body.eventType,
      venue: body.venue,
      address: body.address,
      access: (body.access ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      clubName: body.clubName,
    },
    body.instructions,
  )
}

export async function aiDraft({ user, body, deps }) {
  const { system, prompt, schema } = await promptFor(body, user, deps.firestore)

  const slot = await reserveDailySlot(deps.firestore, {
    collection: 'aiUsage',
    key: user.uid,
    limit: AI_DAILY_LIMIT,
    limitMessage: `You've used AI drafting ${AI_DAILY_LIMIT} times today, which is the daily limit. Please try again tomorrow.`,
  })
  try {
    const response = await deps.ai.generate({ system, prompt, schema })
    return { draft: parseDraft(response, body.kind), remainingToday: slot.remaining }
  } catch (error) {
    // A draft that didn't arrive shouldn't count towards the limit.
    await releaseDailySlot(deps.firestore, slot.path)
    throw error
  }
}
