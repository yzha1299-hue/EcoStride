<script setup>
import { computed, useId } from 'vue'

// Draws a table from useTable() state: sortable column headers (aria-sort), a
// labelled search box per column, 10-row pages and a "showing X-Y of Z"
// summary. Custom cells go in `cell-<key>` slots, which receive { row };
// without one, a cell shows the column's text(row). A column with
// `hideLabel: true` (e.g. action buttons) keeps its header for screen readers only.
const props = defineProps({
  table: { type: Object, required: true },
  // Describes the table for screen readers, e.g. "Your events".
  caption: { type: String, required: true },
  rowKey: { type: String, default: 'id' },
})

const id = useId()
const t = props.table

const ARIA_SORT = { asc: 'ascending', desc: 'descending' }

function ariaSort(column) {
  if (!t.isSortable(column)) return undefined
  return t.sortKey.value === column.key ? ARIA_SORT[t.sortDir.value] : 'none'
}

const sortSummary = computed(() => {
  const column = t.columns.find((c) => c.key === t.sortKey.value)
  return column ? `Sorted by ${column.label}, ${ARIA_SORT[t.sortDir.value]}.` : ''
})

// Every page when there are few; otherwise first, last and the neighbours of
// the current page, with gaps marked by null.
const pageItems = computed(() => {
  const count = t.pageCount.value
  const current = t.page.value
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  const shown = [...new Set([1, current - 1, current, current + 1, count])]
    .filter((n) => n >= 1 && n <= count)
    .sort((a, b) => a - b)
  return shown.flatMap((n, i) => (i > 0 && n - shown[i - 1] > 1 ? [null, n] : [n]))
})
</script>

<template>
  <div>
    <div class="table-responsive">
      <table class="table align-middle mb-2">
        <caption class="visually-hidden">
          {{ caption }}. Column headers with buttons can be sorted.
        </caption>
        <thead>
          <tr>
            <th v-for="column in t.columns" :key="column.key" scope="col" :aria-sort="ariaSort(column)" class="text-nowrap">
              <button
                v-if="t.isSortable(column)"
                type="button"
                class="btn btn-link sort-button p-0 fw-semibold text-decoration-none"
                @click="t.sortBy(column.key)"
              >
                {{ column.label }}
                <span aria-hidden="true" class="sort-icon">
                  {{ t.sortKey.value !== column.key ? '↕' : t.sortDir.value === 'asc' ? '▲' : '▼' }}
                </span>
              </button>
              <span v-else :class="{ 'visually-hidden': column.hideLabel }">{{ column.label }}</span>
            </th>
          </tr>
          <tr class="search-row">
            <td v-for="column in t.columns" :key="column.key">
              <template v-if="t.isSearchable(column)">
                <label class="visually-hidden" :for="`${id}-search-${column.key}`">Search {{ column.label }}</label>
                <input
                  :id="`${id}-search-${column.key}`"
                  v-model="t.search[column.key]"
                  type="search"
                  class="form-control form-control-sm"
                  :placeholder="`Search ${column.label.toLowerCase()}`"
                />
              </template>
            </td>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in t.pageRows.value" :key="row[rowKey]">
            <td v-for="column in t.columns" :key="column.key">
              <slot :name="`cell-${column.key}`" :row="row">{{ column.text?.(row) }}</slot>
            </td>
          </tr>
          <tr v-if="!t.total.value">
            <td :colspan="t.columns.length" class="text-center text-muted py-4">No matching rows. Try clearing a search.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
      <p class="small text-muted mb-0" aria-live="polite">
        Showing {{ t.rangeStart.value }}-{{ t.rangeEnd.value }} of {{ t.total.value }}
        <span class="visually-hidden">{{ sortSummary }}</span>
      </p>

      <nav v-if="t.pageCount.value > 1" :aria-label="`${caption} pages`">
        <ul class="pagination mb-0">
          <li class="page-item" :class="{ disabled: t.page.value === 1 }">
            <button type="button" class="page-link" :disabled="t.page.value === 1" @click="t.setPage(t.page.value - 1)">
              Previous<span class="visually-hidden"> page</span>
            </button>
          </li>
          <template v-for="(item, index) in pageItems" :key="item ?? `gap-${index}`">
            <li v-if="item === null" class="page-item disabled" aria-hidden="true">
              <span class="page-link">…</span>
            </li>
            <li v-else class="page-item" :class="{ active: item === t.page.value }">
              <button
                type="button"
                class="page-link"
                :aria-current="item === t.page.value ? 'page' : undefined"
                @click="t.setPage(item)"
              >
                <span class="visually-hidden">Page </span>{{ item }}
              </button>
            </li>
          </template>
          <li class="page-item" :class="{ disabled: t.page.value === t.pageCount.value }">
            <button
              type="button"
              class="page-link"
              :disabled="t.page.value === t.pageCount.value"
              @click="t.setPage(t.page.value + 1)"
            >
              Next<span class="visually-hidden"> page</span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.sort-button {
  color: inherit;
}

.sort-icon {
  font-size: 0.75em;
  opacity: 0.7;
}

/* Separate page buttons (Bootstrap overlaps their borders by 1 px), so each
   is its own full-size touch target. */
.pagination {
  gap: 0.25rem;
}

.pagination .page-link {
  margin-left: 0;
  border-radius: var(--bs-border-radius);
}

.search-row td {
  border-bottom-width: 2px;
  min-width: 8rem;
}
</style>
