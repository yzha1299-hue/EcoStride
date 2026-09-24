import { describe, expect, it } from 'vitest'
import { CSV_BOM, toCsv } from './csv.js'

// The CSV text without its leading byte-order mark, split into lines.
function lines(csv) {
  return csv.slice(CSV_BOM.length).split('\r\n')
}

describe('toCsv', () => {
  it('starts with a UTF-8 byte-order mark so Excel reads it as UTF-8', () => {
    const csv = toCsv(['Name'], [['Ana']])

    expect(CSV_BOM).toBe('﻿')
    expect(csv.startsWith('﻿')).toBe(true)
    expect(new TextEncoder().encode(csv).slice(0, 3)).toEqual(new Uint8Array([0xef, 0xbb, 0xbf]))
  })

  it('writes a header row then one row per record, separated by CRLF', () => {
    const csv = toCsv(['Name', 'Suburb'], [['Ana', 'Carlton'], ['Ben', 'Fitzroy']])

    expect(lines(csv)).toEqual(['Name,Suburb', 'Ana,Carlton', 'Ben,Fitzroy'])
  })

  it('writes just the header row when there are no records', () => {
    expect(lines(toCsv(['Name', 'Email'], []))).toEqual(['Name,Email'])
  })

  it('quotes fields that contain commas', () => {
    const csv = toCsv(['Venue'], [['Town Hall, Brunswick']])

    expect(lines(csv)[1]).toBe('"Town Hall, Brunswick"')
  })

  it('quotes fields that contain quotes and doubles the embedded quotes', () => {
    const csv = toCsv(['Note'], [['Bring a "spare" tube']])

    expect(lines(csv)[1]).toBe('"Bring a ""spare"" tube"')
  })

  it('quotes fields that contain line breaks, keeping the break inside the field', () => {
    const csv = toCsv(['Needs', 'Name'], [['Wheelchair\nNo nuts', 'Ana'], ['Line\r\nbreak', 'Ben']])

    expect(csv.slice(CSV_BOM.length)).toBe('Needs,Name\r\n"Wheelchair\nNo nuts",Ana\r\n"Line\r\nbreak",Ben')
  })

  it('quotes headers by the same rules', () => {
    expect(lines(toCsv(['Registered, Melbourne time'], []))[0]).toBe('"Registered, Melbourne time"')
  })

  it('writes empty, null and undefined values as empty fields', () => {
    const csv = toCsv(['A', 'B', 'C', 'D'], [['', null, undefined, 'x']])

    expect(lines(csv)[1]).toBe(',,,x')
  })

  it('pads short rows so every row has a field for every header', () => {
    expect(lines(toCsv(['A', 'B', 'C'], [['x']]))[1]).toBe('x,,')
  })

  it('writes numbers and booleans as plain text', () => {
    expect(lines(toCsv(['Count', 'Open', 'Zero'], [[12, true, 0]]))[1]).toBe('12,true,0')
  })

  it('keeps non-ASCII characters intact', () => {
    const csv = toCsv(['Name'], [['Zoë Nguyễn'], ['李明'], ['José 🚲']])

    expect(lines(csv).slice(1)).toEqual(['Zoë Nguyễn', '李明', 'José 🚲'])
  })

  it('stops text that looks like a spreadsheet formula from being run', () => {
    const csv = toCsv(['Name'], [['=HYPERLINK("http://x")'], ['+61 400'], ['-sum'], ['@cmd'], ['\tTab']])

    expect(lines(csv).slice(1)).toEqual([`"'=HYPERLINK(""http://x"")"`, "'+61 400", "'-sum", "'@cmd", "'\tTab"])
  })

  it('leaves negative numbers alone', () => {
    expect(lines(toCsv(['Delta'], [[-3]]))[1]).toBe('-3')
  })
})
