import { invalidRequest } from './errors.js'

// Validates a JSON request body against a small schema, e.g.
//   { name: { type: 'string', required: true, maxLength: 100 },
//     needs: { type: 'string', maxLength: 500 } }
// Unknown fields are rejected rather than ignored, so a client can never smuggle
// extra data (such as a registeredCount) through to a handler.
export function validateBody(schema, body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw invalidRequest('Request body must be a JSON object.')
  }

  for (const key of Object.keys(body)) {
    if (!(key in schema)) {
      throw invalidRequest(`Unexpected field: ${key}.`)
    }
  }

  const result = {}
  for (const [key, rule] of Object.entries(schema)) {
    const value = body[key]

    if (value === undefined || value === null || value === '') {
      if (rule.required) {
        throw invalidRequest(`${key} is required.`)
      }
      continue
    }

    if (rule.type === 'string') {
      if (typeof value !== 'string') {
        throw invalidRequest(`${key} must be text.`)
      }
      const trimmed = value.trim()
      if (rule.required && !trimmed) {
        throw invalidRequest(`${key} is required.`)
      }
      if (rule.maxLength && trimmed.length > rule.maxLength) {
        throw invalidRequest(`${key} must be at most ${rule.maxLength} characters.`)
      }
      result[key] = trimmed
    } else if (rule.type === 'integer') {
      if (!Number.isInteger(value)) {
        throw invalidRequest(`${key} must be a whole number.`)
      }
      if (rule.min !== undefined && value < rule.min) {
        throw invalidRequest(`${key} must be at least ${rule.min}.`)
      }
      if (rule.max !== undefined && value > rule.max) {
        throw invalidRequest(`${key} must be at most ${rule.max}.`)
      }
      result[key] = value
    } else if (rule.type === 'boolean') {
      if (typeof value !== 'boolean') {
        throw invalidRequest(`${key} must be true or false.`)
      }
      result[key] = value
    } else {
      throw new Error(`Unsupported schema type for ${key}: ${rule.type}`)
    }
  }

  return result
}
