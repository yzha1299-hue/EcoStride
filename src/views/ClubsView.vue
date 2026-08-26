<script setup>
import { computed, ref, watch } from 'vue'
import { useJsonData } from '../composables/useJsonData'
import { formatNumber } from '../utils/format'

const { data, loading, error } = useJsonData('clubs')
const selectedClubId = ref('')

const clubs = computed(() => data.value?.clubs ?? [])
const tools = computed(() => data.value?.tools ?? [])
const related = computed(() => data.value?.related ?? [])

watch(
  clubs,
  (list) => {
    if (list.length && !selectedClubId.value) {
      selectedClubId.value = list[0].id
    }
  },
  { immediate: true },
)

const selectedClub = computed(
  () => clubs.value.find((club) => club.id === selectedClubId.value) ?? null,
)

const clubStats = computed(() => {
  if (!selectedClub.value) {
    return []
  }

  return [
    { label: 'Audits done', value: selectedClub.value.auditsDone },
    { label: 'Carpool seats', value: selectedClub.value.carpoolSeats },
    { label: 'kg CO2', value: selectedClub.value.kgCo2 },
  ]
})
</script>

<template>
  <div>
    <section class="hero-section border-bottom">
      <div class="container py-4 py-lg-5">
        <div class="row g-4 align-items-center">
          <div class="col-12 col-lg-8">
            <h1 class="h2 fw-bold mb-2">Club sustainability hub</h1>
            <p class="text-muted mb-0">Low-barrier tools for grassroots sports clubs.</p>
          </div>
          <div class="col-12 col-lg-4">
            <div class="stat-card p-3">
              <label class="form-label small text-uppercase text-muted mb-1" for="selectedClub">
                Selected club
              </label>
              <select
                id="selectedClub"
                v-model="selectedClubId"
                class="form-select"
                :disabled="loading || !clubs.length"
              >
                <option v-for="club in clubs" :key="club.id" :value="club.id">
                  {{ club.name }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="py-4 py-lg-5">
      <div class="container">
        <p v-if="loading" class="text-muted">Loading club tools...</p>
        <p v-else-if="error" class="text-danger">{{ error }}</p>

        <template v-else>
          <h2 class="h4 fw-bold mb-3">Tools</h2>
          <div class="row g-3">
            <div v-for="tool in tools" :key="tool.id" class="col-12 col-md-6 col-lg-4">
              <article class="card h-100 shadow-sm">
                <div class="card-body d-flex flex-column">
                  <h3 class="h5 fw-bold">{{ tool.title }}</h3>
                  <p class="text-muted flex-grow-1">{{ tool.description }}</p>
                  <a class="btn btn-success btn-sm align-self-start" href="#">{{ tool.action }}</a>
                </div>
              </article>
            </div>
          </div>
        </template>
      </div>
    </section>

    <section v-if="!loading && !error" class="pb-5">
      <div class="container">
        <div class="row g-4">
          <div class="col-12 col-lg-6">
            <h2 class="h4 fw-bold mb-3">Club impact snapshot</h2>
            <div class="row g-3">
              <div v-for="stat in clubStats" :key="stat.label" class="col-12 col-sm-4">
                <div class="stat-card text-center p-3 h-100">
                  <div class="h3 fw-bold text-success mb-1">{{ formatNumber(stat.value) }}</div>
                  <div class="text-muted">{{ stat.label }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="col-12 col-lg-6">
            <h2 class="h4 fw-bold mb-3">Related</h2>
            <div class="d-flex flex-column gap-3">
              <article v-for="item in related" :key="item.id" class="card shadow-sm">
                <div class="card-body d-flex justify-content-between align-items-center gap-3">
                  <div>
                    <h3 class="h6 fw-bold mb-1">{{ item.title }}</h3>
                    <p class="small text-muted mb-0">{{ item.description }}</p>
                  </div>
                  <RouterLink
                    v-if="item.to !== '#'"
                    class="btn btn-outline-success btn-sm"
                    :to="item.to"
                  >
                    Go
                  </RouterLink>
                  <a v-else class="btn btn-outline-success btn-sm" href="#">Go</a>
                </div>
              </article>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
