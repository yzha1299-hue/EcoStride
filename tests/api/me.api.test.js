import { beforeEach, describe, expect, it } from 'vitest'
import { api, db, resetEmulators, signedInUser } from './apiEnv'

beforeEach(async () => {
  await resetEmulators()
})

describe('GET /api/me', () => {
  it('refuses a request without a sign-in token', async () => {
    const response = await api('/me')

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('refuses a token that is not a valid Firebase ID token', async () => {
    const response = await api('/me', { token: 'not-a-real-token' })

    expect(response.status).toBe(401)
    expect(response.body.error).toEqual({
      code: 'UNAUTHENTICATED',
      message: 'Your sign-in could not be verified. Please sign in again.',
    })
  })

  it("returns the verified identity and the caller's role", async () => {
    const clara = await signedInUser('clara', { email: 'clara@example.com', emailVerified: true })
    await db.doc('users/clara').set({ email: 'clara@example.com', role: 'clubMember' })

    const response = await api('/me', { token: clara.token })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ uid: 'clara', email: 'clara@example.com', emailVerified: true, role: 'clubMember' })
  })

  it('reports no role for an account that has not finished sign-up', async () => {
    const paul = await signedInUser('paul', { emailVerified: false })

    const response = await api('/me', { token: paul.token })

    expect(response.body).toMatchObject({ uid: 'paul', emailVerified: false, role: null })
  })
})

describe('the API in general', () => {
  it('answers unknown routes with NOT_FOUND', async () => {
    const response = await api('/nope')

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('NOT_FOUND')
  })

  it('is never cached and sends no CORS headers, so other sites cannot read it', async () => {
    const paul = await signedInUser('paul')

    const response = await api('/me', { token: paul.token, headers: { Origin: 'https://evil.example' } })

    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  })
})
