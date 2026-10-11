//   GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json \
//   node scripts/seed-club-demo.mjs club@test.com
//
// Runs locally with the Admin SDK (rules bypassed). Re-running replaces these
// two events and their registrations; other events are untouched.
import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'
import { melbourneTimeToDate, MELBOURNE_TZ } from '../src/utils/format.js'

const PROJECT_ID = 'ecostride-82c87'

const EVENTS = [
  {
    id: 'demo-club-twilight-ride',
    title: 'Twilight community ride',
    type: 'Active travel',
    description:
      'An easy evening ride along the Yarra Trail, finishing with a chat about greener trips to training.',
    venue: 'Federation Square',
    address: 'Swanston St & Flinders St, Melbourne VIC 3000',
    lat: -37.818,
    lng: 144.9691,
    daysFromNow: 6,
    start: [17, 30],
    end: [19, 30],
    capacity: 20,
    registrations: 12,
    access: ['Family friendly'],
  },
  {
    id: 'demo-club-gear-swap',
    title: 'Club gear swap and carpool day',
    type: 'Club session',
    description: 'Swap pre-loved sports gear and set up carpools for the coming season.',
    venue: 'Fitzroy Town Hall',
    address: '201 Napier St, Fitzroy VIC 3065',
    lat: -37.7983,
    lng: 144.9784,
    daysFromNow: 9,
    start: [10, 0],
    end: [12, 0],
    capacity: 16,
    registrations: 16,
    access: ['Concession available'],
  },
]

const FIRST_NAMES = [
  'Aisha',
  'Ben',
  'Chloe',
  'Daniel',
  'Emily',
  'Farid',
  'Grace',
  'Hiro',
  'Isla',
  'Jack',
  'Kiri',
  'Liam',
  'Mei',
  'Noah',
  'Olivia',
  'Priya',
]
const LAST_NAMES = ['Nguyen', 'Smith', 'Patel', 'Chen', 'Williams', 'Kaur', 'Brown', 'Tanaka']
const NEEDS = [
  '',
  '',
  'Wheelchair access',
  'Vegetarian',
  '',
  'Hearing loop, please',
  '',
  'Gluten free',
]

function melbourneDatePlus(days) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: MELBOURNE_TZ }).format(new Date())
  const [year, month, day] = today.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  }
}

async function main() {
  const email = process.argv[2]
  if (!email) throw new Error('Usage: node scripts/seed-club-demo.mjs <club-member email>')
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error(
      'Set GOOGLE_APPLICATION_CREDENTIALS to your service-account key file (see README).',
    )
  }
  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID })
  const db = getFirestore()

  const { uid } = await getAuth().getUserByEmail(email)
  const profile = await db.collection('users').doc(uid).get()
  if (!profile.exists || profile.data().role !== 'clubMember') {
    throw new Error(
      `${email} is not a club member (role: ${profile.data()?.role ?? 'no profile'}).`,
    )
  }

  for (const [index, event] of EVENTS.entries()) {
    const date = melbourneDatePlus(event.daysFromNow)
    const startsAt = melbourneTimeToDate({ ...date, hour: event.start[0], minute: event.start[1] })
    const endsAt = melbourneTimeToDate({ ...date, hour: event.end[0], minute: event.end[1] })
    const eventRef = db.collection('events').doc(event.id)

    const existing = await eventRef.collection('registrations').listDocuments()
    const batch = db.batch()
    existing.forEach((ref) => batch.delete(ref))
    batch.set(eventRef, {
      title: event.title,
      type: event.type,
      description: event.description,
      venue: event.venue,
      address: event.address,
      lat: event.lat,
      lng: event.lng,
      startsAt: Timestamp.fromDate(startsAt),
      endsAt: Timestamp.fromDate(endsAt),
      capacity: event.capacity,
      registeredCount: event.registrations,
      access: event.access,
      clubName: '',
      status: 'open',
      createdBy: uid,
      createdAt: FieldValue.serverTimestamp(),
    })
    for (let n = 0; n < event.registrations; n++) {
      const first = FIRST_NAMES[(n + index * 5) % FIRST_NAMES.length]
      const last = LAST_NAMES[(n * 3 + index) % LAST_NAMES.length]
      batch.set(eventRef.collection('registrations').doc(`demo-club-${index}-${n}`), {
        name: `${first} ${last}`,
        needs: NEEDS[(n + index) % NEEDS.length],
        // example.com is reserved for documentation, so this can never reach a real inbox.
        email: `${first}.${last}.${index}${n}@example.com`.toLowerCase(),
        registeredAt: Timestamp.fromMillis(Date.now() - (event.registrations - n) * 3_600_000),
      })
    }
    await batch.commit()
    console.log(
      `seeded ${event.id}: ${startsAt.toISOString()} (${event.registrations}/${event.capacity})`,
    )
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
