import { ref } from 'vue'
import { collection, doc, getDoc, getDocs, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore'
import { user } from '../auth/authState'

// Aggregates are never stored as a separate mutable counter - that would be a
// value a client could rewrite directly. Instead each user's rating is its own
// small, rules-protected document, and the average is computed fresh from those
// real entries every time, so it can only ever reflect what users actually submitted.
export function useRatings(namespace, itemId) {
  const average = ref(0)
  const count = ref(0)
  const userRating = ref(0)
  const loading = ref(true)
  const submitting = ref(false)
  const feedback = ref('')

  const db = () => getFirestore()
  const entriesRef = () => collection(db(), namespace, itemId, 'entries')
  const entryRef = (uid) => doc(db(), namespace, itemId, 'entries', uid)

  async function load() {
    loading.value = true
    try {
      const snapshot = await getDocs(entriesRef())
      let sum = 0
      snapshot.forEach((entry) => {
        sum += entry.data().rating
      })
      count.value = snapshot.size
      average.value = snapshot.size ? sum / snapshot.size : 0

      if (user.value) {
        const mine = await getDoc(entryRef(user.value.uid))
        userRating.value = mine.exists() ? mine.data().rating : 0
      }
    } finally {
      loading.value = false
    }
  }

  async function submit(rating) {
    if (!user.value || submitting.value) {
      return
    }

    const previousRating = userRating.value
    const previousAverage = average.value
    const previousCount = count.value

    submitting.value = true
    userRating.value = rating
    count.value = previousRating ? previousCount : previousCount + 1
    average.value = previousRating
      ? (previousAverage * previousCount - previousRating + rating) / previousCount
      : (previousAverage * previousCount + rating) / count.value

    try {
      await setDoc(entryRef(user.value.uid), { rating, updatedAt: serverTimestamp() })
      feedback.value = previousRating ? 'Rating updated.' : 'Thanks for rating!'
    } catch {
      average.value = previousAverage
      count.value = previousCount
      userRating.value = previousRating
      feedback.value = 'Could not save your rating - please try again.'
    } finally {
      submitting.value = false
      setTimeout(() => {
        feedback.value = ''
      }, 3000)
    }
  }

  load()

  return { average, count, userRating, loading, submitting, feedback, submit }
}
