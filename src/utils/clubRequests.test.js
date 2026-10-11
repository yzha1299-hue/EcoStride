import { describe, expect, it } from 'vitest'
import { pendingRequestRows } from './clubRequests'

const profile = (uid, email, createdAt) => ({ uid, data: { email, createdAt } })

// The admin page lists people waiting to become club members, longest wait first.
describe('pendingRequestRows', () => {
  it('lists each person with their email and when they signed up', () => {
    const when = new Date('2026-10-01T02:00:00Z')

    expect(pendingRequestRows([profile('u1', 'ann@example.com', when)])).toEqual([
      { uid: 'u1', email: 'ann@example.com', requestedAt: when },
    ])
  })

  it('puts the longest wait first', () => {
    const rows = pendingRequestRows([
      profile('late', 'late@example.com', new Date('2026-10-05')),
      profile('early', 'early@example.com', new Date('2026-10-01')),
      profile('mid', 'mid@example.com', new Date('2026-10-03')),
    ])

    expect(rows.map((row) => row.uid)).toEqual(['early', 'mid', 'late'])
  })

  it('puts a profile without a date last instead of failing', () => {
    const rows = pendingRequestRows([
      profile('nodate', 'nodate@example.com', null),
      profile('dated', 'dated@example.com', new Date('2026-10-01')),
    ])

    expect(rows.map((row) => row.uid)).toEqual(['dated', 'nodate'])
    expect(rows[1].requestedAt).toBeNull()
  })

  it('is empty when nobody is waiting', () => {
    expect(pendingRequestRows([])).toEqual([])
  })
})
