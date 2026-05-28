import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// 동기화 백엔드는 선택 사항이다. env 가 없으면 supabase=null → 앱은 로컬 전용으로 동작.
// URL·키 모두 브라우저에 공개되는 public 값이라 번들 노출돼도 안전하다.
// 진짜 보안은 "동기화 코드"(고엔트로피) + DB의 SECURITY DEFINER RPC 가 담당한다.
const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const supabaseConfigured = Boolean(url && key)

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url as string, key as string, {
      // 우리는 Supabase Auth 를 쓰지 않으므로 세션 저장/갱신을 끈다.
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null
