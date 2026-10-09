// OpenAPI 3 description of the public API, served at
// GET /public/v1/openapi.json so partners can generate clients or explore it
// in tools like Swagger Editor or Postman. Human docs: docs/public-api.md.
const eventSchema = {
  type: 'object',
  required: [
    'id', 'title', 'type', 'description', 'venue', 'address', 'location', 'startsAt', 'endsAt',
    'timezone', 'capacity', 'placesLeft', 'state', 'access', 'clubName', 'url',
  ],
  properties: {
    id: { type: 'string', example: 'bike-maintenance' },
    title: { type: 'string', example: 'Bike maintenance basics' },
    type: { type: 'string', example: 'Workshop' },
    description: { type: 'string' },
    venue: { type: 'string', example: 'Brunswick Town Hall' },
    address: { type: 'string', example: '233 Sydney Rd, Brunswick VIC 3056' },
    location: {
      type: 'object',
      nullable: true,
      properties: { lat: { type: 'number' }, lng: { type: 'number' } },
      description: 'Venue coordinates, or null if the organiser has not set a map location.',
    },
    startsAt: { type: 'string', format: 'date-time', description: 'UTC (ISO 8601).' },
    endsAt: { type: 'string', format: 'date-time', description: 'UTC (ISO 8601).' },
    timezone: { type: 'string', example: 'Australia/Melbourne', description: 'The zone EcoStride displays times in.' },
    capacity: { type: 'integer', minimum: 1 },
    placesLeft: { type: 'integer', minimum: 0 },
    state: {
      type: 'string',
      enum: ['open', 'full', 'closed', 'cancelled'],
      description: 'closed = the event has started; cancelled events are listed so they can be taken down.',
    },
    access: { type: 'array', items: { type: 'string' }, example: ['Wheelchair accessible'] },
    clubName: { type: 'string' },
    url: { type: 'string', format: 'uri', description: 'Where people can register on EcoStride.' },
  },
}

const errorSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          enum: ['API_KEY_MISSING', 'API_KEY_INVALID', 'INVALID_REQUEST', 'NOT_FOUND', 'RATE_LIMITED', 'INTERNAL'],
        },
        message: { type: 'string' },
      },
    },
  },
}

const errorResponse = (description) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
})

export function openApiDocument(serverUrl) {
  return {
    openapi: '3.0.3',
    info: {
      title: 'EcoStride public events API',
      version: '1.0.0',
      description:
        'Read-only access to upcoming EcoStride community events in Melbourne. No personal data is exposed. ' +
        'Send your API key in the X-API-Key header. Limit: 60 requests per minute per key.',
    },
    servers: [{ url: serverUrl }],
    security: [{ ApiKey: [] }],
    paths: {
      '/public/v1/events': {
        get: {
          summary: 'List upcoming events',
          description: 'Events that have not ended yet, soonest first.',
          parameters: [
            { name: 'type', in: 'query', schema: { type: 'string' }, description: 'Only this event type (case-insensitive), e.g. Workshop.' },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 } },
          ],
          responses: {
            200: {
              description: 'Upcoming events',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: { $ref: '#/components/schemas/Event' } },
                      count: { type: 'integer', description: 'Events in this response.' },
                      total: { type: 'integer', description: 'Events matching the filter before the limit.' },
                      generatedAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
            400: errorResponse('Invalid query parameter'),
            401: errorResponse('Missing or invalid API key'),
            429: errorResponse('Rate limit exceeded; see the Retry-After header'),
          },
        },
      },
      '/public/v1/events/{id}': {
        get: {
          summary: 'Get one event',
          description: 'Includes live places left and state.',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: {
              description: 'The event',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { $ref: '#/components/schemas/Event' },
                      generatedAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
            401: errorResponse('Missing or invalid API key'),
            404: errorResponse('No event with that id'),
            429: errorResponse('Rate limit exceeded; see the Retry-After header'),
          },
        },
      },
    },
    components: {
      securitySchemes: { ApiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' } },
      schemas: { Event: eventSchema, Error: errorSchema },
    },
  }
}
