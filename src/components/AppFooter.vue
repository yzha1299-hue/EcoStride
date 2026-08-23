<script setup>
const year = new Date().getFullYear()
</script>

<template>
  <footer class="site-footer border-top mt-auto">
    <div class="container py-4">
      <div class="row gy-3 align-items-center">
        <div class="col-12 col-md">
          <a href="#" class="footer-link me-3">About</a>
          <a href="#" class="footer-link me-3">Privacy</a>
          <a href="#" class="footer-link me-3">Accessibility (WCAG 2.1 AA)</a>
          <a href="#" class="footer-link">Contact</a>
        </div>
        <div class="col-12 col-md-auto text-md-end text-muted small">
          EcoStride Melbourne · NFP · {{ year }}
        </div>
      </div>
    </div>
  </footer>
</template>
