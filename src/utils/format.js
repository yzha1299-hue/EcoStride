export function formatNumber(value) {
  return new Intl.NumberFormat('en-AU').format(value)
}
