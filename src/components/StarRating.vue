<script setup>
import { ref, computed } from 'vue'

// Read-only: an image of the average ("4.2 out of 5 stars").
// Interactive: a labelled group of five buttons; the chosen one is pressed.
// (A role="img" wrapper would hide the buttons from screen readers, so the two
// modes render differently.) Filled and empty stars differ in shape as well as
// colour, and both colours meet the 3:1 contrast needed for graphics.
const props = defineProps({
  value: { type: Number, default: 0 },
  readonly: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  // Names the interactive group, e.g. "Your rating for Bike basics".
  label: { type: String, default: 'Your rating' },
})
const emit = defineEmits(['rate'])

const hovered = ref(0)
const displayValue = computed(() => hovered.value || props.value)

function starLabel(i) {
  return `${i} star${i > 1 ? 's' : ''}`
}
</script>

<template>
  <div v-if="readonly" class="star-rating" role="img" :aria-label="`${value.toFixed(1)} out of 5 stars`">
    <span v-for="i in 5" :key="i" class="star" :class="{ filled: i <= Math.round(value) }" aria-hidden="true">
      {{ i <= Math.round(value) ? '★' : '☆' }}
    </span>
  </div>

  <div v-else class="star-rating" role="group" :aria-label="label">
    <button
      v-for="i in 5"
      :key="i"
      type="button"
      class="star star-btn"
      :class="{ filled: i <= Math.round(displayValue) }"
      :disabled="disabled"
      :aria-label="starLabel(i)"
      :aria-pressed="i === Math.round(value) ? 'true' : 'false'"
      @click="emit('rate', i)"
      @mouseenter="hovered = i"
      @mouseleave="hovered = 0"
    >
      <span aria-hidden="true">{{ i <= Math.round(displayValue) ? '★' : '☆' }}</span>
    </button>
  </div>
</template>

<style scoped>
.star-rating {
  display: inline-flex;
  gap: 2px;
}

.star {
  font-size: 1.15rem;
  line-height: 1;
  /* Empty star: 4.7:1 on white. */
  color: #6c757d;
}

.star.filled {
  /* Filled star: 5.6:1 on white. */
  color: #a35200;
}

.star-btn {
  background: none;
  border: none;
  padding: 0 1px;
  margin: 0;
  cursor: pointer;
  border-radius: 4px;
}

.star-btn:disabled {
  cursor: default;
}
</style>
