import { describe, expect, it } from 'vitest'
import { createRateLimiter, findApiKey, parseApiKeys } from './apiKeys.js'

describe('parseApiKeys', () => {
  it('reads comma-separated name:key pairs, ignoring spaces and blanks', () => {
    const keys = parseApiKeys(' demo:abc123 , council-widget:def456,, ')

    expect(keys).toEqual([
      { name: 'demo', key: 'abc123' },
      { name: 'council-widget', key: 'def456' },
    ])
  })

  it('returns no keys when the secret is missing or empty', () => {
    expect(parseApiKeys(undefined)).toEqual([])
    expect(parseApiKeys('')).toEqual([])
  })

  it('skips malformed entries rather than accepting a key without a name', () => {
    expect(parseApiKeys('nocolon,:emptyname,emptykey:,ok:k1')).toEqual([{ name: 'ok', key: 'k1' }])
  })

  it('keeps colons inside a key', () => {
    expect(parseApiKeys('demo:a:b:c')).toEqual([{ name: 'demo', key: 'a:b:c' }])
  })
})

describe('findApiKey', () => {
  const keys = [
    { name: 'demo', key: 'abc123' },
    { name: 'council', key: 'zzz999' },
  ]

  it('returns the name of the matching key', () => {
    expect(findApiKey(keys, 'zzz999')).toBe('council')
  })

  it('returns null for a wrong, partial, longer or missing key', () => {
    expect(findApiKey(keys, 'abc124')).toBeNull()
    expect(findApiKey(keys, 'abc12')).toBeNull()
    expect(findApiKey(keys, 'abc1234')).toBeNull()
    expect(findApiKey(keys, '')).toBeNull()
    expect(findApiKey(keys, null)).toBeNull()
  })
})

describe('createRateLimiter', () => {
  it('allows up to the limit within a window, then refuses with the seconds until the window resets', () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 })
    const t0 = 1_000_000

    expect(limiter.check('demo', t0).allowed).toBe(true)
    expect(limiter.check('demo', t0 + 1).allowed).toBe(true)
    expect(limiter.check('demo', t0 + 2)).toMatchObject({ allowed: true, remaining: 0 })
    expect(limiter.check('demo', t0 + 10_000)).toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 50 })
  })

  it('starts a fresh window once the previous one has passed', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 })

    expect(limiter.check('demo', 0).allowed).toBe(true)
    expect(limiter.check('demo', 59_999).allowed).toBe(false)
    expect(limiter.check('demo', 60_000).allowed).toBe(true)
  })

  it('counts each key separately', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 })

    expect(limiter.check('demo', 0).allowed).toBe(true)
    expect(limiter.check('council', 0).allowed).toBe(true)
    expect(limiter.check('demo', 1).allowed).toBe(false)
  })

  it('never reports less than one second to wait', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 })
    limiter.check('demo', 0)

    expect(limiter.check('demo', 59_900).retryAfterSeconds).toBe(1)
  })
})
