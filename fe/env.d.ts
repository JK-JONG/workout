/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Supabase 프로젝트 URL (선택). 비우면 동기화 비활성. */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase publishable/anon 공개 키 (선택). 비우면 동기화 비활성. */
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** 배포 base 경로. GitHub Pages 워크플로우가 `/<repo>/` 주입. 기본 '/'. */
  readonly VITE_BASE?: string
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}
