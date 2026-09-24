// Seeds the sample events (and demo registrations) into Firestore.
//
//   GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json \
//   SEED_CREATOR_UID=<uid of a club-member account> \
//   npm run seed:events
//
// Or against the local emulator: firebase emulators:exec --only firestore
//   --project demo-ecostride "node scripts/seed-events.mjs" (SEED_CREATOR_UID still required).
//
// Runs locally with the Admin SDK (rules bypassed). The key file must stay
// outside the repo. Event IDs match the old static data so existing ratings
// still attach. Dates are relative to "today" so a fresh seed is always upcoming.
// Re-running replaces these events and their demo registrations.
import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'
import { melbourneTimeToDate, MELBOURNE_TZ } from '../src/utils/format.js'

const PROJECT_ID = 'ecostride-82c87'

// Coordinates are approximate venue locations; the event form replaces them
// with geocoded ones once venue search exists.
const EVENTS = [
  {
    id: 'active-travel-workshop',
    title: 'Active travel workshop',
    type: 'Active travel',
    description: 'Plan safe walking and cycling trips around the inner west, with local route tips.',
    venue: 'Footscray Community Centre',
    address: '45 Moreland St, Footscray VIC 3011',
    lat: -37.8007,
    lng: 144.8998,
    daysFromNow: 3,
    start: [10, 0],
    end: [12, 0],
    capacity: 30,
    demoRegistrations: 18,
    access: ['Concession available'],
    clubName: '',
  },
  {
    id: 'club-sustainability-session',
    title: 'Club sustainability session',
    type: 'Club session',
    description: 'Practical ways for clubs to cut energy use and match-day travel emissions.',
    venue: 'Docklands Pavilion',
    address: 'Harbour Esplanade, Docklands VIC 3008',
    lat: -37.8156,
    lng: 144.9459,
    daysFromNow: 4,
    start: [14, 0],
    end: [16, 0],
    capacity: 20,
    demoRegistrations: 20,
    access: ['Concession available'],
    clubName: 'Carlton Cycling Club',
  },
  {
    id: 'family-ride-intro',
    title: 'Family ride intro',
    type: 'Active travel',
    description: 'A gentle, supervised loop of the lake for families new to riding together.',
    venue: 'Albert Park Lake',
    address: 'Lakeside Dr, Albert Park VIC 3206',
    lat: -37.8436,
    lng: 144.9663,
    daysFromNow: 10,
    start: [9, 0],
    end: [11, 0],
    capacity: 40,
    demoRegistrations: 25,
    access: ['Family friendly'],
    clubName: '',
  },
  {
    id: 'bike-maintenance',
    title: 'Bike maintenance basics',
    type: 'Active travel',
    description: 'Fix a flat, adjust brakes and keep your chain happy. Bring your own bike.',
    venue: 'Brunswick Town Hall',
    address: '233 Sydney Rd, Brunswick VIC 3056',
    lat: -37.7686,
    lng: 144.9614,
    daysFromNow: 14,
    start: [18, 0],
    end: [20, 0],
    capacity: 16,
    demoRegistrations: 9,
    access: ['Concession available', 'Family friendly'],
    clubName: '',
  },
  {
    id: 'carpool-briefing',
    title: 'Match-day carpool briefing',
    type: 'Club session',
    description: 'Set up match-day carpools for players and families, and share spare seats.',
    venue: 'Richmond Recreation Centre',
    address: 'Gleadell St, Richmond VIC 3121',
    lat: -37.8173,
    lng: 144.9996,
    daysFromNow: 15,
    start: [18, 30],
    end: [19, 30],
    capacity: 24,
    demoRegistrations: 14,
    access: ['Family friendly'],
    clubName: 'Richmond Netball Club',
  },
]

const FIRST_NAMES = ['Aisha', 'Ben', 'Chloe', 'Daniel', 'Emily', 'Farid', 'Grace', 'Hiro', 'Isla', 'Jack', 'Kiri', 'Liam', 'Mei', 'Noah', 'Olivia', 'Priya', 'Quinn', 'Ruby', 'Sam', 'Tariq', 'Uma', 'Vivek', 'Willow', 'Xavier', 'Yasmin', 'Zoe']
const LAST_NAMES = ['Nguyen', 'Smith', 'Patel', 'Chen', 'Williams', 'Kaur', 'Brown', 'Tanaka', 'Jones', 'Ali', 'Taylor', 'Wilson']
const NEEDS = ['', '', '', 'Wheelchair access', 'Vegetarian', '', 'Hearing loop, please', '', 'Gluten free', '']

// Today's calendar date in Melbourne, then shifted by whole days.
function melbourneDatePlus(days) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: MELBOURNE_TZ }).format(new Date())
  const [year, month, day] = today.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() }
}

function demoRegistrant(eventIndex, n) {
  const first = FIRST_NAMES[(n + eventIndex * 7) % FIRST_NAMES.length]
  const last = LAST_NAMES[(n * 5 + eventIndex) % LAST_NAMES.length]
  return {
    uid: `demo-${eventIndex}-${n}`,
    name: `${first} ${last}`,
    // example.com is reserved for documentation, so these can never reach a real inbox.
    email: `${first}.${last}.${eventIndex}${n}@example.com`.toLowerCase(),
    needs: NEEDS[(n + eventIndex) % NEEDS.length],
  }
}

async function deleteRegistrations(db, eventRef) {
  const existing = await eventRef.collection('registrations').listDocuments()
  for (let i = 0; i < existing.length; i += 400) {
    const batch = db.batch()
    existing.slice(i, i + 400).forEach((ref) => batch.delete(ref))
    await batch.commit()
  }
}

async function main() {
  const creatorUid = process.env.SEED_CREATOR_UID
  if (!creatorUid) {
    throw new Error('Set SEED_CREATOR_UID to the uid of a club-member account (see README).')
  }
  // Against the local emulator (FIRESTORE_EMULATOR_HOST set) no credentials are needed.
  const useEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
  if (!useEmulator && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS to your service-account key file (see README).')
  }

  initializeApp(
    useEmulator
      ? { projectId: process.env.GCLOUD_PROJECT || PROJECT_ID }
      : { credential: applicationDefault(), projectId: PROJECT_ID },
  )
  const db = getFirestore()

  for (const [index, event] of EVENTS.entries()) {
    const date = melbourneDatePlus(event.daysFromNow)
    const startsAt = melbourneTimeToDate({ ...date, hour: event.start[0], minute: event.start[1] })
    const endsAt = melbourneTimeToDate({ ...date, hour: event.end[0], minute: event.end[1] })
    const registrants = Array.from({ length: event.demoRegistrations }, (_, n) => demoRegistrant(index, n))

    const eventRef = db.collection('events').doc(event.id)
    await deleteRegistrations(db, eventRef)

    // The count and the registration documents are written in one batch so the
    // stored registeredCount always equals the number of registrations.
    const batch = db.batch()
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
      registeredCount: registrants.length,
      access: event.access,
      clubName: event.clubName,
      status: 'open',
      createdBy: creatorUid,
      createdAt: FieldValue.serverTimestamp(),
    })
    registrants.forEach((person, n) => {
      batch.set(eventRef.collection('registrations').doc(person.uid), {
        name: person.name,
        needs: person.needs,
        email: person.email,
        registeredAt: Timestamp.fromMillis(Date.now() - (registrants.length - n) * 3_600_000),
      })
    })
    await batch.commit()

    console.log(`seeded ${event.id}: ${startsAt.toISOString()} (${registrants.length}/${event.capacity})`)
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
