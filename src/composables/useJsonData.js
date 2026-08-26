import { onMounted, ref } from 'vue'
import { fetchAppData } from '../data/ecostrideData'

export function useJsonData(sourceKey) {
  const data = ref(null)
  const loading = ref(true)
  const error = ref('')

  onMounted(async () => {
    try {
      data.value = await fetchAppData(sourceKey)
    } catch {
      error.value = 'Unable to load data right now.'
    } finally {
      loading.value = false
    }
  })

  return { data, loading, error }
}
