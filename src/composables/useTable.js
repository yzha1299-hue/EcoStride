import { computed, reactive, ref, toValue, watch } from 'vue'

export const PAGE_SIZE = 10

// Table state for sorting, per-column search and pagination, independent of
// how the table is drawn (see DataTable.vue).
//
// `rows` is a ref or getter of plain objects. Each column is
//   { key, label, text(row), sortValue?(row), sortable?, searchable? }
// `text` is what the cell shows and what its search box matches;
// `sortValue` (defaults to `text`) lets dates and numbers sort as such.
// Columns without `text` (e.g. action buttons) can't be sorted or searched.
//
// Rows flow: source -> filtered by every column search -> sorted -> paged.
// `filteredRows` is everything after search and sort (what an export should
// contain); `pageRows` is the 10 on screen.
export function useTable(rows, columns, { initialSort } = {}) {
  const byKey = Object.fromEntries(columns.map((column) => [column.key, column]))
  const isSortable = (column) => Boolean(column?.text) && column.sortable !== false
  const isSearchable = (column) => Boolean(column?.text) && column.searchable !== false

  const search = reactive(
    Object.fromEntries(columns.filter(isSearchable).map((column) => [column.key, ''])),
  )
  const sortKey = ref(initialSort?.key ?? null)
  const sortDir = ref(initialSort?.dir ?? 'asc')
  const requestedPage = ref(1)

  const filteredRows = computed(() => {
    const terms = Object.entries(search)
      .map(([key, term]) => [byKey[key], term.trim().toLowerCase()])
      .filter(([, term]) => term)

    const matching = toValue(rows).filter((row) =>
      terms.every(([column, term]) => String(column.text(row) ?? '').toLowerCase().includes(term)),
    )

    const column = byKey[sortKey.value]
    if (!isSortable(column)) {
      return matching
    }
    const valueOf = column.sortValue ?? column.text
    const direction = sortDir.value === 'desc' ? -1 : 1
    // Array.prototype.sort is stable, so equal values keep their source order.
    return [...matching].sort((a, b) => direction * compareValues(valueOf(a), valueOf(b)))
  })

  const total = computed(() => filteredRows.value.length)
  const pageCount = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
  // Clamped on read, so shrinking rows (a search, a reload) never strands the
  // user on a page that no longer exists.
  const page = computed(() => Math.min(Math.max(1, requestedPage.value), pageCount.value))

  const pageRows = computed(() => {
    const start = (page.value - 1) * PAGE_SIZE
    return filteredRows.value.slice(start, start + PAGE_SIZE)
  })
  const rangeStart = computed(() => (total.value ? (page.value - 1) * PAGE_SIZE + 1 : 0))
  const rangeEnd = computed(() => Math.min(page.value * PAGE_SIZE, total.value))

  // A new search means a new result set: start from its first page. Sync, so
  // the reset happens in the same tick as the keystroke.
  watch(search, () => setPage(1), { flush: 'sync' })

  function setPage(value) {
    requestedPage.value = Math.min(Math.max(1, value), pageCount.value)
  }

  // First click on a column sorts ascending; clicking it again flips direction.
  function sortBy(key) {
    if (!isSortable(byKey[key])) {
      return
    }
    if (sortKey.value === key) {
      sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortKey.value = key
      sortDir.value = 'asc'
    }
  }

  return {
    columns,
    search,
    sortKey,
    sortDir,
    sortBy,
    isSortable,
    isSearchable,
    page,
    setPage,
    pageCount,
    total,
    rangeStart,
    rangeEnd,
    pageRows,
    filteredRows,
  }
}

// Empty values sort last in ascending order; dates and numbers by value; text
// case-insensitively with numbers inside it in natural order ("Item 2" < "Item 10").
function compareValues(a, b) {
  const aEmpty = a === null || a === undefined || a === ''
  const bEmpty = b === null || b === undefined || b === ''
  if (aEmpty || bEmpty) {
    return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1
  }
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime()
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}
