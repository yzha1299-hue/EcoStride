import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTextGenerator } from './genai.js'

const generator = createTextGenerator({ apiKey: 'key', model: 'some-model' })
const request = { system: 's', prompt: 'p', schema: {} }

afterEach(() => vi.unstubAllGlobals())

const stubStatus = (status) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"x"}', { status })))

describe('createTextGenerator', () => {
  it.each([429, 503])('says the service is busy when the model answers %i', async (status) => {
    stubStatus(status)

    await expect(generator.generate(request)).rejects.toMatchObject({ status: 503, code: 'AI_BUSY' })
  })

  it('still reports other failures as an upstream error', async () => {
    stubStatus(500)

    await expect(generator.generate(request)).rejects.toMatchObject({ status: 502, code: 'UPSTREAM_ERROR' })
  })

  it('returns the model response on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"candidates":[]}', { status: 200 })))

    expect(await generator.generate(request)).toEqual({ candidates: [] })
  })

  it('is unavailable without a key or model', async () => {
    await expect(createTextGenerator({ apiKey: '', model: 'm' }).generate(request)).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
    })
  })
})
