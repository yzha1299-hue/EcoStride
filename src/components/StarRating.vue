<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  value: { type: Number, default: 0 },
  readonly: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['rate'])

const hovered = ref(0)
const displayValue = computed(() => hovered.value || props.value)

function starLabel(i) {
  return `Rate ${i} star${i > 1 ? 's' : ''}`
}
</script>

<template>
  <div
    class="star-rating"
    :class="{ 'is-readonly': readonly }"
    role="img"
    :aria-label="`${value.toFixed(1)} out of 5 stars`"
  >
    <button
      v-for="i in 5"
      :key="i"
      type="button"
      class="star-btn"
      :class="{ filled: i <= Math.round(displayValue) }"
      :disabled="readonly || disabled"
      :aria-label="starLabel(i)"
      @click="!readonly && emit('rate', i)"
      @mouseenter="!readonly && (hovered = i)"
      @mouseleave="!readonly && (hovered = 0)"
    >
      ★
    </button>
  </div>
</template>

<style scoped>
.star-rating {
  display: inline-flex;
  gap: 2px;
}

.star-btn {
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  font-size: 1.15rem;
  line-height: 1;
  color: #d0d5dd;
  cursor: pointer;
  transition: color 0.15s ease;
}

.star-rating.is-readonly .star-btn,
.star-btn:disabled {
  cursor: default;
}

.star-btn.filled {
  color: #f5a623;
}
</style>
