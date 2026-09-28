import { BarElement, CategoryScale, Chart, Legend, LinearScale, Tooltip } from 'chart.js'

// Register only what the app's bar charts use, so the rest of Chart.js is
// left out of the bundle.
Chart.register(BarElement, CategoryScale, LinearScale, Legend, Tooltip)

// Chart colours: each at least 3:1 against white (WCAG 1.4.11), and series
// that sit side by side also differ in lightness, not just hue.
export const CHART_COLORS = {
  green: '#1b7a4e',
  blue: '#0b5ed7',
  grey: '#6c757d',
}

const reducedMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Shared options: whole-number axes, tooltips that show every series for the
// hovered bar, and no animation for people who asked for reduced motion.
// `horizontal`: bars run left to right (better for long category labels).
export function barOptions({ stacked = false, legend = false, horizontal = false } = {}) {
  return {
    indexAxis: horizontal ? 'y' : 'x',
    responsive: true,
    maintainAspectRatio: false,
    animation: reducedMotion ? false : undefined,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: legend, position: 'bottom' },
      tooltip: { enabled: true },
    },
    scales: {
      x: { stacked, beginAtZero: true, ticks: { precision: 0, color: '#495057' }, grid: { display: horizontal } },
      y: { stacked, beginAtZero: true, ticks: { precision: 0, color: '#495057' }, grid: { display: !horizontal } },
    },
  }
}
