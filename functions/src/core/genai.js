import { ApiError } from './errors.js'
import { fetchUpstream } from './upstream.js'

// The one place the API talks to a generative AI model (Google Gemini,
// generateContent). Callers pass a system instruction, a prompt and a
// response schema, and get the raw response back to parse; swapping models
// or providers means changing this file.
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

export function createTextGenerator({ apiKey, model }) {
  async function generate({ system, prompt, schema }) {
    if (!apiKey || !model) {
      throw new ApiError(503, 'AI_UNAVAILABLE', "AI drafting isn't set up on the server yet.")
    }
    const response = await fetchUpstream(
      'The AI service',
      `${GEMINI_URL}/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: schema,
            temperature: 0.7,
          },
        }),
      },
      // 429: the free tier's per-minute quota is used up - worth its own message.
      { timeoutMs: 25000, allowStatuses: [429] },
    )
    if (response.status === 429) {
      throw new ApiError(503, 'AI_BUSY', 'The AI service is busy right now. Please try again in a minute.')
    }
    return response.json()
  }

  return { generate }
}
