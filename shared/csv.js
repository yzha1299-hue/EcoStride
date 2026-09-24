// The one CSV serialiser, shared by the web app (table exports) and the API
// Worker (roster emails), so both produce identical files.
//
// Follows RFC 4180: CRLF between records; a field containing a comma, quote or
// line break is wrapped in quotes, with embedded quotes doubled.

// Excel assumes a legacy code page unless a UTF-8 file starts with this mark,
// which would garble names like "Zoë" or "李明".
export const CSV_BOM = '﻿'

// Text starting with one of these is run as a formula by spreadsheet apps.
// Names and needs are typed by registrants, so a leading quote mark keeps them
// as plain text (the OWASP "CSV injection" advice).
const FORMULA_START = /^[=+\-@\t\r]/

function field(value) {
  if (value === null || value === undefined) {
    return ''
  }
  let text = String(value)
  if (typeof value === 'string' && FORMULA_START.test(text)) {
    text = `'${text}`
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

// `headers`: column titles. `rows`: arrays of values in the same order;
// missing trailing values become empty fields.
export function toCsv(headers, rows) {
  const record = (values) => headers.map((_, i) => field(values[i])).join(',')
  return CSV_BOM + [headers, ...rows].map(record).join('\r\n')
}
