<script setup>
import { ref, useId } from 'vue'

// Frame for a chart: title, a one-sentence summary that also describes the
// canvas to screen readers, a "Show as table" alternative with the same data,
// and a message when there is nothing to plot yet. The chart itself goes in
// the default slot, which receives `describedBy` for its aria-describedby.
defineProps({
  title: { type: String, required: true },
  summary: { type: String, required: true },
  // [{ key, label }] and plain row objects, for the table alternative.
  columns: { type: Array, required: true },
  rows: { type: Array, required: true },
  empty: { type: Boolean, default: false },
  emptyText: { type: String, default: 'No data to show yet.' },
})

const id = useId()
const showTable = ref(false)
</script>

<template>
  <section class="stat-card p-3 h-100 d-flex flex-column" :aria-labelledby="`${id}-title`">
    <h3 :id="`${id}-title`" class="h6 fw-bold mb-1">{{ title }}</h3>
    <p :id="`${id}-summary`" class="small text-muted mb-2">{{ summary }}</p>

    <p v-if="empty" class="small text-muted mb-0">{{ emptyText }}</p>
    <template v-else>
      <div class="chart-box flex-grow-1">
        <slot :described-by="`${id}-summary`" />
      </div>
      <button
        class="btn btn-link btn-sm px-0 align-self-start"
        type="button"
        :aria-expanded="showTable ? 'true' : 'false'"
        :aria-controls="`${id}-table`"
        @click="showTable = !showTable"
      >
        {{ showTable ? 'Hide table' : 'Show as table' }}
      </button>
      <div v-show="showTable" :id="`${id}-table`" class="table-responsive">
        <table class="table table-sm mb-0">
          <caption class="visually-hidden">{{ title }}</caption>
          <thead>
            <tr>
              <th v-for="column in columns" :key="column.key" scope="col">{{ column.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in rows" :key="index">
              <template v-for="(column, columnIndex) in columns" :key="column.key">
                <th v-if="columnIndex === 0" scope="row">{{ row[column.key] }}</th>
                <td v-else>{{ row[column.key] }}</td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>

<style scoped>
.chart-box {
  position: relative;
  height: 16rem;
}
</style>
