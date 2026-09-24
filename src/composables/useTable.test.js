import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { PAGE_SIZE, useTable } from './useTable'

const SUBURBS = ['Carlton', 'Brunswick', 'Fitzroy']

// 23 people: 3 pages of 10, 10 and 3. Ages are chosen so numeric and text
// order differ (9 sorts before 10 numerically, after it as text).
function people(count = 23) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    name: `Person ${String(i).padStart(2, '0')}`,
    suburb: SUBURBS[i % 3],
    age: (i * 7) % 40,
  }))
}

const columns = [
  { key: 'name', label: 'Name', text: (row) => row.name },
  { key: 'suburb', label: 'Suburb', text: (row) => row.suburb },
  { key: 'age', label: 'Age', text: (row) => String(row.age), sortValue: (row) => row.age },
]

const names = (rows) => rows.map((row) => row.name)

describe('pagination', () => {
  it('shows exactly 10 rows per page, with the remainder on the last page', () => {
    const table = useTable(ref(people()), columns)

    expect(PAGE_SIZE).toBe(10)
    expect(table.total.value).toBe(23)
    expect(table.pageCount.value).toBe(3)
    expect(table.pageRows.value).toHaveLength(10)

    table.setPage(2)
    expect(table.pageRows.value).toHaveLength(10)
    expect(table.pageRows.value[0].name).toBe('Person 10')

    table.setPage(3)
    expect(names(table.pageRows.value)).toEqual(['Person 20', 'Person 21', 'Person 22'])
    expect(table.rangeStart.value).toBe(21)
    expect(table.rangeEnd.value).toBe(23)
  })

  it('keeps the page within range', () => {
    const table = useTable(ref(people()), columns)

    table.setPage(99)
    expect(table.page.value).toBe(3)
    table.setPage(0)
    expect(table.page.value).toBe(1)
  })

  it('has one empty page and a 0-0 range when there are no rows', () => {
    const table = useTable(ref([]), columns)

    expect(table.pageCount.value).toBe(1)
    expect(table.pageRows.value).toEqual([])
    expect(table.rangeStart.value).toBe(0)
    expect(table.rangeEnd.value).toBe(0)
  })

  it('follows the source rows when they change', () => {
    const rows = ref(people())
    const table = useTable(rows, columns)
    table.setPage(3)

    rows.value = people(12)

    expect(table.total.value).toBe(12)
    expect(table.page.value).toBe(2)
    expect(table.pageRows.value).toHaveLength(2)
  })
})

describe('sorting', () => {
  it('sorts ascending on first click and descending on the second', () => {
    const table = useTable(ref(people()), columns)

    table.sortBy('name')
    expect(table.sortKey.value).toBe('name')
    expect(table.sortDir.value).toBe('asc')
    expect(table.filteredRows.value[0].name).toBe('Person 00')

    table.sortBy('name')
    expect(table.sortDir.value).toBe('desc')
    expect(table.filteredRows.value[0].name).toBe('Person 22')
  })

  it('starts ascending again when switching to another column', () => {
    const table = useTable(ref(people()), columns)
    table.sortBy('name')
    table.sortBy('name')

    table.sortBy('suburb')

    expect(table.sortDir.value).toBe('asc')
    expect(table.filteredRows.value[0].suburb).toBe('Brunswick')
    expect(table.filteredRows.value.at(-1).suburb).toBe('Fitzroy')
  })

  it('sorts by the column sort value, so numbers sort numerically', () => {
    const table = useTable(ref(people()), columns)

    table.sortBy('age')
    const ages = table.filteredRows.value.map((row) => row.age)
    expect(ages).toEqual([...ages].sort((a, b) => a - b))

    table.sortBy('age')
    expect(table.filteredRows.value[0].age).toBe(Math.max(...ages))
  })

  it('sorts text case-insensitively', () => {
    const rows = ref([{ name: 'banana' }, { name: 'Cherry' }, { name: 'apple' }])
    const table = useTable(rows, [{ key: 'name', label: 'Name', text: (row) => row.name }])

    table.sortBy('name')

    expect(names(table.filteredRows.value)).toEqual(['apple', 'banana', 'Cherry'])
  })

  it('sorts dates chronologically', () => {
    const rows = ref([
      { name: 'b', at: new Date('2026-10-02') },
      { name: 'c', at: new Date('2026-12-25') },
      { name: 'a', at: new Date('2026-01-15') },
    ])
    const table = useTable(rows, [
      { key: 'at', label: 'When', text: (row) => row.at.toDateString(), sortValue: (row) => row.at },
    ])

    table.sortBy('at')

    expect(names(table.filteredRows.value)).toEqual(['a', 'b', 'c'])
  })

  it('can start sorted', () => {
    const table = useTable(ref(people()), columns, { initialSort: { key: 'name', dir: 'desc' } })

    expect(table.filteredRows.value[0].name).toBe('Person 22')
  })

  it('ignores columns that are not sortable', () => {
    const table = useTable(ref(people()), [...columns, { key: 'actions', label: 'Actions', sortable: false }])

    table.sortBy('actions')

    expect(table.sortKey.value).toBe(null)
  })
})

describe('per-column search', () => {
  it('matches a case-insensitive substring within that column only', () => {
    const table = useTable(ref(people()), columns)

    table.search.suburb = 'fitz'

    expect(table.total.value).toBe(7)
    expect(table.filteredRows.value.every((row) => row.suburb === 'Fitzroy')).toBe(true)

    table.search.suburb = ''
    table.search.name = 'fitz'
    expect(table.total.value).toBe(0)
  })

  it('combines searches across columns', () => {
    const table = useTable(ref(people()), columns)

    table.search.suburb = 'carlton'
    table.search.name = 'person 1'

    // Carlton is every third person; of 10-19 that is 12, 15 and 18.
    expect(names(table.filteredRows.value)).toEqual(['Person 12', 'Person 15', 'Person 18'])
  })

  it('ignores surrounding spaces in a search term', () => {
    const table = useTable(ref(people()), columns)

    table.search.suburb = '  Brunswick '

    expect(table.total.value).toBe(8)
  })

  it('sorts the filtered rows', () => {
    const table = useTable(ref(people()), columns)
    table.search.suburb = 'carlton'

    table.sortBy('name')
    table.sortBy('name')

    expect(table.filteredRows.value[0].name).toBe('Person 21')
    expect(table.total.value).toBe(8)
  })

  it('goes back to page 1 whenever a search changes', () => {
    const table = useTable(ref(people()), columns)
    table.setPage(3)

    table.search.name = 'person'

    expect(table.page.value).toBe(1)

    table.setPage(2)
    table.search.suburb = 'b'
    expect(table.page.value).toBe(1)
  })

  it('pages through the filtered rows, not the source rows', () => {
    const table = useTable(ref(people()), columns)

    table.search.suburb = 'carlton'

    expect(table.pageCount.value).toBe(1)
    expect(table.pageRows.value).toHaveLength(8)
    expect(table.rangeEnd.value).toBe(8)
  })

  it('exposes every filtered row, not just the visible page, for export', () => {
    const table = useTable(ref(people()), columns)

    table.search.name = 'person'

    expect(table.filteredRows.value).toHaveLength(23)
    expect(table.pageRows.value).toHaveLength(10)
  })
})
