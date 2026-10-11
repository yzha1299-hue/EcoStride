import { describe, expect, it } from 'vitest'
import { apiOriginForCsp } from './cspApiOrigin.js'

// The Content-Security-Policy only needs to name the API's host when the API
// is on another origin; same-origin is 'self'.
describe('apiOriginForCsp', () => {
  it.each([undefined, '', '/api', '/'])('adds nothing for the same-origin API (%j)', (value) => {
    expect(apiOriginForCsp(value)).toBe('')
  })

  it('names the origin of a full URL, without any path', () => {
    expect(apiOriginForCsp('https://api.example.com')).toBe('https://api.example.com')
    expect(apiOriginForCsp('https://example.com:8443/v1/')).toBe('https://example.com:8443')
    expect(apiOriginForCsp('http://localhost:8787')).toBe('http://localhost:8787')
  })

  it('ignores a value that is not a URL', () => {
    expect(apiOriginForCsp('not a url')).toBe('')
  })

  it('refuses anything that could add more than one source to the policy', () => {
    expect(apiOriginForCsp("https://a.example; script-src *")).toBe('')
    expect(apiOriginForCsp('javascript:alert(1)')).toBe('')
  })
})
