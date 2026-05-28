-- workout-tracker 동기화 백엔드 (sync-code 방식)
--
-- 모델: "동기화 코드" 1개 = vault 1개 = 앱 전체 데이터(모든 프로필).
-- 코드는 고엔트로피 랜덤 문자열이며, 서버엔 sha256 해시만 저장한다.
-- anon 키가 브라우저 번들에 노출돼도, 코드를 모르면 어떤 데이터도 읽거나 쓸 수 없다.
--
-- 보안 설계:
--   1) vaults 테이블은 RLS ON + 정책 0개 → anon/authenticated 직접 접근 전면 차단.
--   2) 데이터 접근은 SECURITY DEFINER 함수(sync_pull/sync_push)로만 가능.
--   3) 모든 DEFINER 함수에 `SET search_path = public, pg_temp` 고정 (search_path 하이재킹 방지).
--   4) 해시는 Postgres 내장 sha256()(pg_catalog) 사용 → pgcrypto 확장 불필요.
--
-- 적용 방법: Supabase 대시보드 → SQL Editor 에 이 파일 전체를 붙여넣고 RUN.

-- ── 테이블 ──────────────────────────────────────────────
create table if not exists public.vaults (
  code_hash  text primary key,          -- sha256(code) hex
  data       jsonb       not null,       -- 앱 전체 스냅샷
  version    integer     not null default 1,
  updated_at timestamptz not null default now()
);

-- 직접 접근 전면 차단: RLS 켜되 정책은 하나도 만들지 않는다.
alter table public.vaults enable row level security;
revoke all on table public.vaults from anon, authenticated;

-- ── 코드 → 해시 (내부 헬퍼) ────────────────────────────
-- sha256 / convert_to 는 pg_catalog 내장 함수라 확장 설치가 필요 없다.
create or replace function public.sync_hash(p_code text)
returns text
language sql
immutable
security definer
set search_path = public, pg_temp
as $$
  select encode(sha256(convert_to(coalesce(p_code, ''), 'UTF8')), 'hex');
$$;

-- ── PULL: 코드로 vault 조회 ────────────────────────────
create or replace function public.sync_pull(p_code text)
returns table (data jsonb, version integer, updated_at timestamptz)
language sql
security definer
set search_path = public, pg_temp
as $$
  select v.data, v.version, v.updated_at
  from public.vaults v
  where v.code_hash = public.sync_hash(p_code);
$$;

-- ── PUSH: 낙관적 잠금으로 저장 ─────────────────────────
-- p_expected_version: 클라이언트가 마지막으로 본 버전(신규면 0).
--   - row 없음        → 신규 생성, version=1
--   - 버전 일치        → 갱신, version+1
--   - 버전 불일치(충돌) → conflict=true + 현재 서버 데이터 반환 (클라가 재병합)
create or replace function public.sync_push(
  p_code             text,
  p_data             jsonb,
  p_expected_version integer
)
returns table (version integer, conflict boolean, data jsonb)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text := public.sync_hash(p_code);
  v_cur  public.vaults%rowtype;
begin
  if p_code is null or length(p_code) < 16 then
    raise exception 'invalid sync code';
  end if;

  select * into v_cur from public.vaults where code_hash = v_hash for update;

  if not found then
    -- row 가 없으면 expected_version 과 무관하게 새로 생성한다(의도된 복구 동작:
    -- vault 가 외부에서 삭제됐거나 클라가 stale 한 경우에도 다시 만들 수 있게).
    insert into public.vaults (code_hash, data, version, updated_at)
    values (v_hash, p_data, 1, now());
    return query select 1, false, null::jsonb;
    return;
  end if;

  if v_cur.version <> p_expected_version then
    return query select v_cur.version, true, v_cur.data;
    return;
  end if;

  update public.vaults
  set data = p_data, version = v_cur.version + 1, updated_at = now()
  where code_hash = v_hash;

  return query select v_cur.version + 1, false, null::jsonb;
end;
$$;

-- ── 권한: anon(미인증 anon키)에 RPC 실행만 허용 ────────
revoke all on function public.sync_hash(text) from public;
grant execute on function public.sync_pull(text) to anon, authenticated;
grant execute on function public.sync_push(text, jsonb, integer) to anon, authenticated;
