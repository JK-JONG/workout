<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppGate from '@/components/AppGate.vue'
import AppNav from '@/components/AppNav.vue'
</script>

<template>
  <AppGate>
    <AppNav />
    <main class="page">
      <RouterView />
    </main>
  </AppGate>
</template>

<style scoped>
.page {
  max-width: 1240px;
  margin: 0 auto;
  padding: 16px 18px 64px;
}
@media (max-width: 600px) {
  .page { padding: 12px 12px 56px; }
}
</style>
