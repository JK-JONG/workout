<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import AppGate from '@/components/AppGate.vue'
import AppNav from '@/components/AppNav.vue'
import BodyReminderBanner from '@/components/BodyReminderBanner.vue'
import { useSyncStore } from '@/stores/sync'

// 동기화: 코드가 있으면 앱 진입 시 한 번 pull→병합→push, 이후 변경분 자동 push.
// env(Supabase) 미설정이면 init 내부에서 no-op.
onMounted(() => useSyncStore().init())
</script>

<template>
  <AppGate>
    <AppNav />
    <main class="page">
      <BodyReminderBanner />
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
