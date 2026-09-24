<script setup>
import { ref } from 'vue'
import { formatDistance, formatDuration } from '../utils/geo'

// The text side of directions: distance, time and every step as an ordered
// list, so screen-reader and keyboard users get what the map line shows.
defineProps({
  // From useDirections(): { toLabel, fromLabel, toDescription, mode, distance, duration, steps }
  trip: { type: Object, required: true },
})
defineEmits(['clear'])

const heading = ref(null)
// Lets the page move focus here once new directions arrive.
defineExpose({ focus: () => heading.value?.focus() })
</script>

<template>
  <section class="border rounded-3 p-3" aria-labelledby="trip-heading">
    <div class="d-flex justify-content-between align-items-start gap-2">
      <h2 id="trip-heading" ref="heading" class="h5 fw-bold mb-1" tabindex="-1">Directions to {{ trip.toLabel }}</h2>
      <button class="btn btn-sm btn-outline-secondary" type="button" @click="$emit('clear')">
        Clear<span class="visually-hidden"> directions</span>
      </button>
    </div>
    <p class="small text-muted mb-2">
      {{ trip.mode === 'Walk' ? 'Walking' : 'Cycling' }} from {{ trip.fromLabel }} to {{ trip.toDescription }}.
    </p>
    <p class="mb-2">
      <strong>{{ formatDistance(trip.distance) }}</strong>, about <strong>{{ formatDuration(trip.duration) }}</strong>
    </p>
    <p v-if="trip.mode === 'Micro-mobility'" class="small alert alert-info py-2 mb-2">
      Scooters and other micro-mobility use cycling directions, so the time is an estimate for a bicycle.
    </p>
    <ol class="small mb-0 ps-3">
      <li v-for="(step, index) in trip.steps" :key="index" class="mb-1">
        {{ step.instruction }}
        <span v-if="step.distance" class="text-muted">({{ formatDistance(step.distance) }})</span>
      </li>
    </ol>
  </section>
</template>
