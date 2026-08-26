const DATA_SOURCES = {
  home: {
    experiences: [
      {
        title: 'Active Travel',
        description: 'Find safe walking and cycling routes.',
        action: 'Open',
        imageKey: 'travel',
        to: '/active-travel',
      },
      {
        title: 'Club Sustainability',
        description: 'Help clubs cut energy and travel emissions.',
        action: 'Open',
        imageKey: 'clubs',
        to: '/clubs',
      },
      {
        title: 'Events & Workshops',
        description: 'Register for community green sessions.',
        action: 'Open',
        imageKey: 'events',
        to: '/events',
      },
    ],
    guides: [
      {
        title: 'For participants',
        description: 'Families, youth, casual commuters - how to find routes and join events.',
      },
      {
        title: 'For club admins',
        description: 'Run audits, carpools, and gear sharing with low-barrier tools.',
      },
    ],
  },
  activeTravel: {
    filters: ['Well-lit paths', 'Safe corridors', 'Bike parking', 'Accessible'],
    routes: [
      {
        name: 'Maribyrnong River Trail',
        detail: 'Lit path - ~2.4 km - parking nearby',
        suburb: 'Footscray',
        postcode: '3011',
        modes: ['Walk', 'Cycle'],
      },
      {
        name: 'Capital City Trail',
        detail: 'Shared path - ~3.1 km - quiet streets',
        suburb: 'Carlton',
        postcode: '3053',
        modes: ['Walk', 'Cycle'],
      },
      {
        name: 'Main Yarra Trail',
        detail: 'Riverside corridor - ~4.0 km - well-lit',
        suburb: 'Richmond',
        postcode: '3121',
        modes: ['Walk', 'Cycle', 'Micro-mobility'],
      },
      {
        name: 'Beach Road Bike Path',
        detail: 'Coastal path - ~5.2 km - accessible',
        suburb: 'St Kilda',
        postcode: '3182',
        modes: ['Cycle', 'Micro-mobility'],
      },
      {
        name: 'Southern Cross Bike Hub',
        detail: 'Secure racks - near station',
        suburb: 'Docklands',
        postcode: '3008',
        modes: ['Cycle', 'Micro-mobility'],
      },
    ],
  },
  clubs: {
    clubs: [
      {
        id: 'footscray-fc',
        name: 'Footscray Football Club',
        auditsDone: 4,
        carpoolSeats: 18,
        kgCo2: 210,
      },
      {
        id: 'carlton-cc',
        name: 'Carlton Cycling Club',
        auditsDone: 6,
        carpoolSeats: 9,
        kgCo2: 164,
      },
      {
        id: 'richmond-nc',
        name: 'Richmond Netball Club',
        auditsDone: 3,
        carpoolSeats: 22,
        kgCo2: 198,
      },
      {
        id: 'stkilda-ac',
        name: 'St Kilda Aquatic Club',
        auditsDone: 5,
        carpoolSeats: 11,
        kgCo2: 142,
      },
    ],
    tools: [
      {
        id: 'energy-audit',
        title: 'Energy self-assessment',
        description: 'Short checklist for lights, heating, and facilities.',
        action: 'Start audit',
      },
      {
        id: 'carpools',
        title: 'Match-day carpools',
        description: 'Post rides, join seats, cut match-day car trips.',
        action: 'Open carpools',
      },
      {
        id: 'guides',
        title: 'Green facility guides',
        description: 'Simple actions clubs can take this season.',
        action: 'View guides',
      },
    ],
    related: [
      {
        id: 'gear',
        title: 'Gear exchange',
        description: 'Share kits and reduce equipment waste.',
        to: '#',
      },
      {
        id: 'workshops',
        title: 'Club workshops',
        description: 'Book a sustainability session.',
        to: '/events',
      },
    ],
  },
  events: {
    events: [
      {
        id: 'active-travel-workshop',
        title: 'Active travel workshop',
        type: 'Active travel',
        suburb: 'Footscray',
        venue: 'Footscray Community Centre',
        club: '',
        day: '06',
        month: 'Sep',
        weekday: 'Sat',
        registered: 18,
        capacity: 30,
        access: ['Concession available'],
        status: 'open',
      },
      {
        id: 'club-sustainability-session',
        title: 'Club sustainability session',
        type: 'Club session',
        suburb: 'Docklands',
        venue: 'Docklands Pavilion',
        club: 'Carlton Cycling Club',
        day: '07',
        month: 'Sep',
        weekday: 'Sun',
        registered: 12,
        capacity: 20,
        access: ['Concession available'],
        status: 'waitlist',
      },
      {
        id: 'family-ride-intro',
        title: 'Family ride intro',
        type: 'Active travel',
        suburb: 'Albert Park',
        venue: 'Albert Park Lake',
        club: '',
        day: '13',
        month: 'Sep',
        weekday: 'Sat',
        registered: 25,
        capacity: 40,
        access: ['Family friendly'],
        status: 'open',
      },
      {
        id: 'bike-maintenance',
        title: 'Bike maintenance basics',
        type: 'Active travel',
        suburb: 'Brunswick',
        venue: 'Brunswick Town Hall',
        club: '',
        day: '17',
        month: 'Sep',
        weekday: 'Wed',
        registered: 9,
        capacity: 16,
        access: ['Concession available', 'Family friendly'],
        status: 'open',
      },
      {
        id: 'carpool-briefing',
        title: 'Match-day carpool briefing',
        type: 'Club session',
        suburb: 'Richmond',
        venue: 'Richmond Recreation Centre',
        club: 'Richmond Netball Club',
        day: '18',
        month: 'Sep',
        weekday: 'Thu',
        registered: 14,
        capacity: 24,
        access: ['Family friendly'],
        status: 'open',
      },
    ],
  },
  impact: {
    communityTotals: [
      { key: 'routeSearches', label: 'Route searches', value: 1240 },
      { key: 'eventSignups', label: 'Event sign-ups', value: 318 },
      { key: 'gearShares', label: 'Gear shares', value: 86 },
      { key: 'co2Saved', label: 'kg CO2 saved', value: 4920 },
    ],
    personal: {
      tripsLogged: 12,
      kmActive: 48,
      kgCo2: 16,
      progressPercent: 64,
    },
    stories: [
      {
        id: 'story-commute',
        title: 'A safer first commute',
        quote: 'The lit path to Footscray station made cycling to training feel possible.',
        imageKey: 'travel',
      },
      {
        id: 'story-carpool',
        title: 'Match-day carpooling',
        quote: 'Sharing a ride with two teammates cut our Sunday car trips in half.',
        imageKey: 'clubs',
      },
      {
        id: 'story-workshop',
        title: 'Workshop weekend',
        quote: 'The family ride intro showed us a quiet route we now use every Saturday.',
        imageKey: 'events',
      },
    ],
  },
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value))
}

export async function fetchAppData(sourceKey) {
  await Promise.resolve()

  const payload = DATA_SOURCES[sourceKey]
  if (!payload) {
    throw new Error(`Unknown data source: ${sourceKey}`)
  }

  return cloneData(payload)
}
