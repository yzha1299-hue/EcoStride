import { ref, watch } from 'vue'
import { doc, getDoc, getFirestore } from 'firebase/firestore'
import { user } from '../auth/authState'

// Which of the listed events the signed-in user is registered for. A
// registration is stored at events/{id}/registrations/{uid}, and the rules let
// each user read their own, so this is one small read per listed event.
export function useMyRegistrations(events) {
  const registeredIds = ref(new Set())

  watch(
    events,
    async (list) => {
      const uid = user.value?.uid
      if (!uid) {
        registeredIds.value = new Set()
        return
      }
      const db = getFirestore()
      const ids = await Promise.all(
        list.map((event) =>
          getDoc(doc(db, 'events', event.id, 'registrations', uid))
            .then((snapshot) => (snapshot.exists() ? event.id : null))
            .catch(() => null),
        ),
      )
      registeredIds.value = new Set(ids.filter(Boolean))
    },
    { immediate: true },
  )

  function setRegistered(eventId, registered) {
    const next = new Set(registeredIds.value)
    if (registered) {
      next.add(eventId)
    } else {
      next.delete(eventId)
    }
    registeredIds.value = next
  }

  return { registeredIds, setRegistered }
}
