-- ==========================================================================
-- SYNC SCHEMA: jadual + kolum untuk auto-sync "Daily Chat Report" (Google Doc)
-- dan "Customer Issue Report" (Google Sheet) ke KPI CSA02 / CSA03.
-- Cara guna: Supabase SQL Editor -> New query -> tampal -> Run.
-- Selamat di-run semula (idempotent).
-- ==========================================================================

-- 1) Kolum untuk resolve handler code (MAI/TI/HAWA) -> user_id
alter table profiles add column if not exists handler_code text;

-- Best-effort auto-match ikut nama (double-check/betulkan manual kalau tak match)
update profiles set handler_code = 'MAI'  where full_name ilike '%maisarah%';
update profiles set handler_code = 'TI'   where full_name ilike '%najjati%';
update profiles set handler_code = 'HAWA' where full_name ilike '%natasha%';

-- 2) Log mentah "Daily Chat Report" (satu row = satu handler, satu tarikh)
create table if not exists cs_chat_log (
  id              bigserial primary key,
  log_date        date not null,
  handler_code    text not null,
  whatsapp_open   int not null default 0,
  whatsapp_close  int not null default 0,
  telegram_open   int not null default 0,
  telegram_close  int not null default 0,
  instagram_open  int not null default 0,
  instagram_close int not null default 0,
  tiktok_open     int not null default 0,
  tiktok_close    int not null default 0,
  web_open        int not null default 0,
  web_close       int not null default 0,
  synced_at       timestamptz not null default now(),
  unique (log_date, handler_code)
);

-- 3) Log mentah "Customer Issue Report" (satu row = satu isu)
create table if not exists cs_issue_log (
  id             bigserial primary key,
  source_row_id  text unique not null,
  reported_at    date,
  username       text,
  platform       text,
  description    text,
  solution       text,
  handler_code   text,
  synced_at      timestamptz not null default now()
);

-- 4) RLS — boleh baca oleh mana-mana pengguna log masuk (padan corak
--    departments/positions sedia ada). Tiada policy insert/update/delete
--    sebab hanya service-role key (route API, bypass RLS) yang menulis.
alter table cs_chat_log  enable row level security;
alter table cs_issue_log enable row level security;

drop policy if exists chat_log_read_all on cs_chat_log;
create policy chat_log_read_all on cs_chat_log for select using (auth.uid() is not null);

drop policy if exists issue_log_read_all on cs_issue_log;
create policy issue_log_read_all on cs_issue_log for select using (auth.uid() is not null);

-- 5) Helper: minggu dalam bulan, sepadan dengan lib/period.ts (getCurrentWeekOfMonth)
--    dan pengiraan minggu dalam app/api/ingest/*/route.ts — kekalkan kedua-duanya sama.
create or replace function week_of(d date) returns int
language sql immutable as $$
  select least(4, ceil(extract(day from d) / 7.0))::int
$$;
