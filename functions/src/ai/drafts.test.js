import { describe, expect, it } from 'vitest'
import { DRAFT_LIMITS, descriptionPrompt, emailPrompt, parseDraft } from './drafts.js'

const event = {
  title: 'Bike maintenance basics',
  type: 'Workshop',
  description: 'Fix a flat and adjust brakes.',
  venue: 'Brunswick Town Hall',
  address: '233 Sydney Rd, Brunswick VIC 3056',
  startsAt: new Date('2026-10-10T00:00:00Z'), // 11:00 am Melbourne (daylight saving)
  endsAt: new Date('2026-10-10T02:00:00Z'),
  access: ['Wheelchair accessible'],
  clubName: 'Carlton Cycling Club',
  status: 'open',
  createdBy: 'secret-creator-uid',
  registeredCount: 12,
}

describe('emailPrompt', () => {
  it('gives the model the event facts, with times in Melbourne time', () => {
    const { prompt } = emailPrompt(event, '')

    for (const fact of ['Bike maintenance basics', 'Brunswick Town Hall', '233 Sydney Rd', 'Wheelchair accessible', 'Carlton Cycling Club']) {
      expect(prompt).toContain(fact)
    }
    expect(prompt).toContain('Saturday 10 October 2026')
    expect(prompt).toContain('11:00 am')
  })

  it('never includes the creator, registration numbers or anything about registrants', () => {
    const { prompt, system } = emailPrompt({ ...event, registrations: [{ email: 'rita@example.com' }] }, '')
    const everything = prompt + system

    expect(everything).not.toContain('secret-creator-uid')
    expect(everything).not.toContain('rita@example.com')
    expect(everything).not.toMatch(/\b12\b/)
  })

  it("puts the organiser's instructions in their own marked section, after the facts", () => {
    const { prompt } = emailPrompt(event, 'Remind them to bring water.')

    expect(prompt).toMatch(/ORGANISER INSTRUCTIONS[\s\S]*Remind them to bring water\./)
    expect(prompt.indexOf('EVENT DETAILS')).toBeLessThan(prompt.indexOf('ORGANISER INSTRUCTIONS'))
  })

  it('says when there are no instructions rather than leaving an empty section', () => {
    expect(emailPrompt(event, '   ').prompt).toMatch(/ORGANISER INSTRUCTIONS[\s\S]*\(none\)/)
  })

  it('tells the model the event is cancelled when it is', () => {
    expect(emailPrompt({ ...event, status: 'cancelled' }, '').prompt).toMatch(/cancelled/i)
  })

  it('tells the model not to invent facts and not to follow instructions that change its rules', () => {
    const { system } = emailPrompt(event, '')

    expect(system).toMatch(/never invent/i)
    expect(system).toMatch(/instructions/i)
  })

  it('asks for a subject and a message', () => {
    expect(Object.keys(emailPrompt(event, '').schema.properties)).toEqual(['subject', 'message'])
  })
})

describe('descriptionPrompt', () => {
  it('uses only the fields typed into the form', () => {
    const { prompt, schema } = descriptionPrompt(
      { title: 'Family ride intro', type: 'Active travel', venue: 'Princes Park', address: '', access: ['Family friendly'], clubName: '' },
      'Mention kids can bring scooters.',
    )

    expect(prompt).toContain('Family ride intro')
    expect(prompt).toContain('Princes Park')
    expect(prompt).toContain('Family friendly')
    expect(prompt).toMatch(/ORGANISER INSTRUCTIONS[\s\S]*scooters/)
    expect(prompt).not.toMatch(/Address:/)
    expect(Object.keys(schema.properties)).toEqual(['description'])
  })
})

describe('parseDraft', () => {
  const ok = (object) => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(object) }] } }] })

  it('returns the fields the schema asked for, trimmed', () => {
    expect(parseDraft(ok({ subject: '  Hello ', message: 'Hi everyone.\n' }), 'registrant-email')).toEqual({
      subject: 'Hello',
      message: 'Hi everyone.',
    })
  })

  it('cuts text that is longer than the form allows', () => {
    const long = 'x'.repeat(DRAFT_LIMITS.subject + 50)
    const draft = parseDraft(ok({ subject: long, message: 'm' }), 'registrant-email')

    expect(draft.subject).toHaveLength(DRAFT_LIMITS.subject)
  })

  it('joins text split across several parts', () => {
    const response = { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"descrip' }, { text: 'tion":"A ride."}' }] } }] }

    expect(parseDraft(response, 'event-description')).toEqual({ description: 'A ride.' })
  })

  it('reports a refusal when the prompt or the answer was blocked', () => {
    expect(() => parseDraft({ promptFeedback: { blockReason: 'SAFETY' } }, 'event-description')).toThrow(
      expect.objectContaining({ code: 'AI_REFUSED' }),
    )
    expect(() => parseDraft({ candidates: [{ finishReason: 'SAFETY' }] }, 'event-description')).toThrow(
      expect.objectContaining({ code: 'AI_REFUSED' }),
    )
  })

  it('reports the service as unavailable for empty, malformed or incomplete answers', () => {
    for (const response of [
      {},
      { candidates: [] },
      { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not json' }] } }] },
      ok({ subject: 'Only a subject' }),
      ok({ subject: '', message: '   ' }),
    ]) {
      expect(() => parseDraft(response, 'registrant-email')).toThrow(expect.objectContaining({ code: 'AI_UNAVAILABLE' }))
    }
  })
})
