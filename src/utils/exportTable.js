import { toCsv } from '../../shared/csv.js'
import { formatDateTime, toMelbourneInputs } from './format.js'

// Exports what a useTable() table currently holds: every row that passes the
// searches, in the current sort order, across all pages - not just the page
// on screen. Cells use each column's display text, so the file matches the
// table. Columns without text (action buttons) are left out.
export function tableExportData(table) {
  const columns = table.columns.filter((column) => column.text)
  return {
    headers: columns.map((column) => column.label),
    rows: table.filteredRows.value.map((row) => columns.map((column) => column.text(row) ?? '')),
  }
}

// "ecostride-roster-bike-basics-2026-09-24.csv" (date in Melbourne).
export function exportFileName(name, extension, now = new Date()) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `ecostride-${slug || 'export'}-${toMelbourneInputs(now).date}.${extension}`
}

function saveFile(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function downloadCsv(table, { name }) {
  const { headers, rows } = tableExportData(table)
  const fileName = exportFileName(name, 'csv')
  saveFile(new Blob([toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' }), fileName)
  return { fileName, count: rows.length }
}

// jsPDF is large, so it is only downloaded the first time someone exports a PDF.
// Note: jsPDF's built-in fonts cover Western European characters only.
export async function downloadPdf(table, { name, title }) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const { headers, rows } = tableExportData(table)
  const fileName = exportFileName(name, 'pdf')

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  doc.setProperties({ title })
  doc.setFontSize(16)
  doc.text(title, 40, 48)
  doc.setFontSize(10)
  doc.setTextColor(90)
  doc.text(
    `Exported ${formatDateTime(new Date())} (Melbourne time) · ${rows.length} row${rows.length === 1 ? '' : 's'}`,
    40,
    66,
  )
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 80,
    margin: { left: 40, right: 40 },
    styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [25, 105, 60] },
    didDrawPage: () => {
      const page = doc.getNumberOfPages()
      doc.setFontSize(8)
      doc.text(`EcoStride · page ${page}`, 40, doc.internal.pageSize.getHeight() - 20)
    },
  })
  doc.save(fileName)
  return { fileName, count: rows.length }
}
