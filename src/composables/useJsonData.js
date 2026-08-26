import { onMounted, ref } from 'vue'
<<<<<<< HEAD
import { fetchAppData } from '../data/ecostrideData'

export function useJsonData(sourceKey) {
=======

export function useJsonData(url) {
>>>>>>> 78d6a04e71bc50a9e0158cb76be0e9df46279b21
  const data = ref(null)
  const loading = ref(true)
  const error = ref('')

  onMounted(async () => {
    try {
<<<<<<< HEAD
      data.value = await fetchAppData(sourceKey)
=======
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`)
      }
      data.value = await response.json()
>>>>>>> 78d6a04e71bc50a9e0158cb76be0e9df46279b21
    } catch {
      error.value = 'Unable to load data right now.'
    } finally {
      loading.value = false
    }
  })

  return { data, loading, error }
}
