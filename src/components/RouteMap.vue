<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MELBOURNE_CENTRE } from '../utils/geo'

// Interactive map of routes: a marker at each route's start (focusable, and
// Enter selects it) and the trail drawn as a line. Leaflet manages its own
// DOM, so this component drives it from props imperatively and keeps the
// Leaflet objects out of Vue's reactivity.
const props = defineProps({
  // [{ id, name, start: { lat, lng }, line: [[lat, lng], ...] | null, approximate }]
  routes: { type: Array, required: true },
  selectedId: { type: String, default: '' },
  // The searched place or the user's location: { lat, lng, label }.
  origin: { type: Object, default: null },
  label: { type: String, required: true },
  // Directions to show on top of the routes: [[lat, lng], ...] or null.
  directionsLine: { type: Array, default: null },
})
const emit = defineEmits(['select'])

const container = ref(null)
let map = null
let routeLayer = null
let originMarker = null
let directionsLayer = null
const layersById = new Map()

const LINE_STYLE = { color: '#198754', weight: 4, opacity: 0.8 }
const SELECTED_LINE_STYLE = { color: '#0b5ed7', weight: 6, opacity: 1 }

const markerIcon = L.divIcon({
  className: 'route-marker',
  html: '<span aria-hidden="true"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

function drawRoutes() {
  routeLayer.clearLayers()
  layersById.clear()
  for (const route of props.routes) {
    const marker = L.marker([route.start.lat, route.start.lng], {
      icon: markerIcon,
      keyboard: true,
      title: route.name,
      riseOnHover: true,
    })
    marker.on('click', () => emit('select', route.id))
    marker.addTo(routeLayer)
    const element = marker.getElement()
    element.setAttribute('role', 'button')
    // Leaflet makes markers focusable but only treats Enter as a click when a
    // popup is bound; behave like a button for Enter and Space.
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        emit('select', route.id)
      }
    })

    let line = null
    if (route.line?.length > 1) {
      line = L.polyline(route.line, { ...LINE_STYLE, dashArray: route.approximate ? '6 8' : null })
      line.on('click', () => emit('select', route.id))
      line.addTo(routeLayer)
    }
    layersById.set(route.id, { route, marker, line })
  }
  showSelection()
}

// Updates the existing marker in place rather than redrawing it, so a
// keyboard user who selected it with Enter keeps focus on it.
function showSelection() {
  for (const [id, { route, marker, line }] of layersById) {
    const selected = id === props.selectedId
    const element = marker.getElement()
    element.classList.toggle('is-selected', selected)
    element.setAttribute('aria-pressed', String(selected))
    element.setAttribute('aria-label', `Start of ${route.name}`)
    marker.setZIndexOffset(selected ? 1000 : 0)
    line?.setStyle(selected ? SELECTED_LINE_STYLE : LINE_STYLE)
    if (selected) line?.bringToFront()
  }
}

function focusSelected() {
  const layers = layersById.get(props.selectedId)
  if (!layers) return
  if (layers.line) {
    map.fitBounds(layers.line.getBounds(), { padding: [40, 40], maxZoom: 15 })
  } else {
    map.setView(layers.marker.getLatLng(), Math.max(map.getZoom(), 15))
  }
}

// Frame the origin together with the routes listed for it.
function fitToOrigin() {
  if (!props.origin) return
  const points = [[props.origin.lat, props.origin.lng], ...props.routes.map((r) => [r.start.lat, r.start.lng])]
  if (points.length === 1) {
    map.setView(points[0], 14)
  } else {
    map.fitBounds(points, { padding: [40, 40], maxZoom: 14 })
  }
}

function drawOrigin() {
  originMarker?.remove()
  originMarker = null
  if (!props.origin) return
  originMarker = L.circleMarker([props.origin.lat, props.origin.lng], {
    radius: 8,
    color: '#fff',
    weight: 3,
    fillColor: '#0d6efd',
    fillOpacity: 1,
  })
    .bindTooltip(props.origin.label)
    .addTo(map)
}

function drawDirections() {
  directionsLayer?.remove()
  directionsLayer = null
  if (!props.directionsLine?.length) return
  directionsLayer = L.polyline(props.directionsLine, { color: '#6f42c1', weight: 5, opacity: 0.9 }).addTo(map)
  map.fitBounds(directionsLayer.getBounds(), { padding: [40, 40], maxZoom: 16 })
}

onMounted(() => {
  map = L.map(container.value, { zoomControl: true }).setView([MELBOURNE_CENTRE.lat, MELBOURNE_CENTRE.lng], 11)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map)
  routeLayer = L.layerGroup().addTo(map)
  drawRoutes()
  drawOrigin()
  fitToOrigin()
  drawDirections()
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
})

// New filters or trail shapes arriving: redraw, but don't move the view.
watch(() => props.routes, drawRoutes)
watch(
  () => props.selectedId,
  () => {
    showSelection()
    focusSelected()
  },
)
watch(() => props.directionsLine, drawDirections)
watch(
  () => props.origin,
  () => {
    drawOrigin()
    fitToOrigin()
  },
)
</script>

<template>
  <div class="route-map-wrapper" role="region" :aria-label="label">
    <div ref="container" class="route-map rounded-4"></div>
  </div>
</template>

<style scoped>
.route-map {
  height: 28rem;
  width: 100%;
}

@media (max-width: 575.98px) {
  .route-map {
    height: 20rem;
  }
}

/* Leaflet creates the markers outside this component's template. */
:deep(.route-marker span) {
  display: block;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #198754;
  border: 3px solid #fff;
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.4);
}

:deep(.route-marker.is-selected span) {
  background: #0b5ed7;
  transform: scale(1.25);
}

:deep(.route-marker:focus-visible) {
  outline: 3px solid #0b5ed7;
  outline-offset: 3px;
  border-radius: 50%;
}
</style>
