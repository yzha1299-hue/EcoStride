<script setup>
import { ref } from 'vue'
import { downloadCsv, downloadPdf } from '../utils/exportTable'

// CSV and PDF download buttons for a useTable() table. Exports contain the
// rows currently matching the searches, in the current order, on every page.
const props = defineProps({
  table: { type: Object, required: true },
  // Used in the file name, e.g. "roster Bike basics".
  name: { type: String, required: true },
  // Heading printed at the top of the PDF.
  title: { type: String, required: true },
})

const busy = ref(false)
const status = ref('')

async function run(format) {
  busy.value = true
  status.value = ''
  try {
    const exporter = format === 'CSV' ? downloadCsv : downloadPdf
    const { fileName, count } = await exporter(props.table, { name: props.name, title: props.title })
    status.value = `Exported ${count} row${count === 1 ? '' : 's'} to ${fileName}.`
  } catch {
    status.value = `Couldn't create the ${format} file. Please try again.`
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="d-flex flex-wrap align-items-center gap-2">
    <span class="small text-muted">Export {{ table.total.value }} matching row{{ table.total.value === 1 ? '' : 's' }}:</span>
    <button type="button" class="btn btn-outline-secondary btn-sm" aria-label="Export as CSV" :disabled="busy || !table.total.value" @click="run('CSV')">
      CSV
    </button>
    <button type="button" class="btn btn-outline-secondary btn-sm" aria-label="Export as PDF" :disabled="busy || !table.total.value" @click="run('PDF')">
      PDF
    </button>
    <span class="small text-muted" role="status">{{ status }}</span>
  </div>
</template>
