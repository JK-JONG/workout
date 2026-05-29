<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useProfileStore } from '@/stores/profile'

const profile = useProfileStore()
const { activeProfile } = storeToRefs(profile)

const tabs = [
  { to: '/', label: '기록', icon: '✎' },
  { to: '/today', label: '오늘', icon: '◉' },
  { to: '/stats', label: '통계', icon: '▦' },
  { to: '/settings', label: '설정', icon: '⚙' },
]
</script>

<template>
  <header class="nav">
    <div class="nav-inner">
      <div class="nav-brand">
        <span class="nav-dot"></span>
        <span class="nav-name">Workout</span>
      </div>
      <nav class="nav-tabs">
        <RouterLink
          v-for="t in tabs"
          :key="t.to"
          :to="t.to"
          class="nav-tab"
          exact-active-class="active"
        >
          <span class="nav-tab-icon">{{ t.icon }}</span>
          <span class="nav-tab-label">{{ t.label }}</span>
        </RouterLink>
      </nav>
      <div class="nav-profile">
        <span class="nav-profile-name">{{ activeProfile }}</span>
      </div>
    </div>
  </header>
</template>

<style scoped>
.nav {
  position: sticky; top: 0; z-index: 50;
  background: rgba(255,255,255,0.92);
  backdrop-filter: saturate(180%) blur(8px);
  -webkit-backdrop-filter: saturate(180%) blur(8px);
  border-bottom: 1px solid var(--c-border);
}
.nav-inner {
  max-width: 1240px;
  margin: 0 auto;
  padding: 8px 18px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
}
.nav-brand { display: flex; align-items: center; gap: 6px; }
.nav-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--c-accent);
  box-shadow: 0 0 0 2px var(--c-accent-soft);
}
.nav-name {
  font-size: var(--fs-md);
  font-weight: 600;
  letter-spacing: -0.01em;
}
.nav-tabs {
  display: flex; gap: 2px;
  justify-content: center;
}
.nav-tab {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 12px;
  border-radius: var(--radius-md);
  font-size: var(--fs-sm);
  color: var(--c-text-soft);
  transition: background 0.15s, color 0.15s;
}
.nav-tab:hover { background: var(--c-surface-2); color: var(--c-text); }
.nav-tab.active {
  background: var(--c-accent-soft);
  color: var(--c-accent-ink);
  font-weight: 500;
}
.nav-tab-icon { font-size: 12px; opacity: 0.8; }
.nav-profile {
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
}
.nav-profile-name { font-weight: 500; color: var(--c-text-soft); }

@media (max-width: 600px) {
  .nav-inner { padding: 8px 12px; }
  .nav-tab-label { display: none; }
  .nav-tab { padding: 6px 10px; }
  .nav-tab-icon { font-size: 14px; }
}
</style>
