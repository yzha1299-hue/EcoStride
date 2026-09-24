import { ref } from 'vue'
import { collection, getDocs, getFirestore, query, Timestamp, where } from 'firebase/firestore'

// Firestore Timestamps become plain Dates at this boundary so the rest of the
// app (and the shared event-state logic) never deals with Firestore types.
function toEvent(snapshot) {
  const data = snapshot.data()
  return {
    id: snapshot.id,
    ...data,
    startsAt: data.startsAt.toDate(),
    endsAt: data.endsAt.toDate(),
    createdAt: data.createdAt?.toDate() ?? null,
  }
}

// Events that haven't finished yet, soonest first. Finished events drop off the
// list; ones already underway stay (shown as closed for registration).
export function useEvents() {
  const events = ref([])
  const loading = ref(true)
  const error = ref('')

  async function load() {
    loading.value = true
    error.value = ''
    try {
      const snapshot = await getDocs(
        query(collection(getFirestore(), 'events'), where('endsAt', '>=', Timestamp.now())),
      )
      events.value = snapshot.docs.map(toEvent).sort((a, b) => a.startsAt - b.startsAt)
    } catch {
      error.value = 'Unable to load events right now. Please try again.'
    } finally {
      loading.value = false
    }
  }

  load()

  return { events, loading, error, reload: load }
}
