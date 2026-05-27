import { createRouter, createWebHashHistory } from 'vue-router'
import RecordView from '@/views/RecordView.vue'
import StatsView from '@/views/StatsView.vue'
import SettingsView from '@/views/SettingsView.vue'

// GitHub Pages 호환을 위해 hash history 사용 (서브경로·404 회피)
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'record', component: RecordView },
    { path: '/stats', name: 'stats', component: StatsView },
    { path: '/settings', name: 'settings', component: SettingsView },
  ],
})

export default router
