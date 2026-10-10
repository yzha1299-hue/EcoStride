// Cloud Functions entry point. The whole API is one HTTPS function, `api`,
// served on the site's origin at /api/** by a Firebase Hosting rewrite.
import { setGlobalOptions } from 'firebase-functions/v2'
import { onRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { logger } from 'firebase-functions'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { createApi } from './http.js'
import { createEmailSender } from './core/email.js'
import { me } from './handlers/me.js'
import {
  EMAIL_REGISTRANTS_MAX_BODY_BYTES,
  emailRegistrants,
  emailRegistrantsSchema,
} from './handlers/emailRegistrants.js'
import { emailRoster, rosterEmailSchema } from './handlers/rosterEmail.js'
import { cancelRegistration, cancelSchema, register, registerSchema } from './handlers/registrations.js'

setGlobalOptions({
  // Next to Firestore (australia-southeast1).
  region: 'australia-southeast1',
  // Runs as a dedicated account that may only read and write Firestore
  // (Cloud Datastore User), not the project's broad default account.
  serviceAccount: 'ecostride-api@ecostride-82c87.iam.gserviceaccount.com',
  // A ceiling on scaling, so a traffic spike or abuse can't run up the bill.
  maxInstances: 10,
  memory: '256MiB',
  // Firebase Hosting gives up on a request after 60 seconds anyway.
  timeoutSeconds: 60,
})

initializeApp()

// Brevo credentials live in Secret Manager and are only available to the
// function while it runs. Locally the emulator reads functions/.secret.local;
// with none set, email endpoints answer EMAIL_UNAVAILABLE.
const BREVO_API_KEY = defineSecret('BREVO_API_KEY')
const BREVO_SENDER_EMAIL = defineSecret('BREVO_SENDER_EMAIL')

// Each route: whether it needs a signed-in caller and, for requests with a
// body, the schema that body must match.
const routes = {
  'GET /me': { handler: me, auth: true },
  'POST /registrations': { handler: register, auth: true, schema: registerSchema },
  'POST /registrations/cancel': { handler: cancelRegistration, auth: true, schema: cancelSchema },
  'POST /events/roster-email': { handler: emailRoster, auth: true, schema: rosterEmailSchema },
  'POST /events/email-registrants': {
    handler: emailRegistrants,
    auth: true,
    schema: emailRegistrantsSchema,
    maxBodyBytes: EMAIL_REGISTRANTS_MAX_BODY_BYTES,
  },
}

// The logger wants a message first; the entry's fields become structured
// fields in Cloud Logging (filterable by endpoint, outcome, status...).
function log(level, entry) {
  const message = level === 'error' ? `${entry.endpoint} failed: ${entry.error}` : `${entry.endpoint} ${entry.status}`
  logger[level](message, entry)
}

export const api = onRequest(
  {
    // Reached through Hosting by anyone; each route checks the caller itself.
    invoker: 'public',
    // Same-origin API: no CORS headers at all, so other sites' pages can't
    // read responses. Set explicitly because the Functions emulator otherwise
    // turns CORS on for every origin, which would hide the difference.
    cors: false,
    secrets: [BREVO_API_KEY, BREVO_SENDER_EMAIL],
  },
  createApi({
    routes,
    auth: () => getAuth(),
    deps: () => ({
      db: getFirestore(),
      email: createEmailSender({ apiKey: BREVO_API_KEY.value(), senderEmail: BREVO_SENDER_EMAIL.value() }),
    }),
    log,
  }),
)
