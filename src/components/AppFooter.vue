<script setup>
const year = new Date().getFullYear()
</script>

<template>
  <footer class="site-footer border-top mt-auto">
    <div class="container py-4">
      <div class="row gy-3 align-items-center">
        <div class="col-12 col-md">
          <span class="small text-muted">Designed to meet WCAG 2.1 AA</span>
        </div>
        <div class="col-12 col-md-auto text-md-end text-muted small">
          EcoStride Melbourne · NFP · {{ year }}
        </div>
      </div>
    </div>
  </footer>
</template>
