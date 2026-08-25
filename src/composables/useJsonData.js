import { onMounted, ref } from 'vue'

export function useJsonData(url) {
  const data = ref(null)
  const loading = ref(true)
  const error = ref('')

  onMounted(async () => {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`)
      }
      data.value = await response.json()
    } catch {
      error.value = 'Unable to load data right now.'
    } finally {
      loading.value = false
    }
  })

  return { data, loading, error }
}
