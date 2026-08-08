-- ==========================================================================
-- RECOVERY CRM — tempat simpan data yang dihantar dari masdora.zo.space
--
-- Sistem Recovery CRM akan hantar (POST) rekod ke dashboard, dan rekod itu
-- disimpan di sini. Dashboard kemudian paparkan kepada Maisarah & Manager.
--
-- Cara guna: Supabase SQL Editor -> New query -> tampal -> Run
-- Selamat di-run berulang kali.
-- ==========================================================================

create table if not exists recovery_records (
  id                bigserial primary key,
  -- ID unik dari CRM. Kalau rekod sama dihantar semula, ia dikemas kini
  -- (bukan jadi dua) — jadi CRM boleh hantar berulang kali dengan selamat.
  source_id         text unique not null,
  customer_name     text,
  customer_contact  text,
  status            text,
  amount_rm         numeric not null default 0,
  contacted_at      date,
  handler_code      text,
  note              text,
  updated_at        timestamptz not null default now(),
  synced_at         timestamptz not null default now()
);

create index if not exists idx_recovery_contacted_at
  on recovery_records (contacted_at desc);
create index if not exists idx_recovery_handler
  on recovery_records (handler_code);

alter table recovery_records enable row level security;

-- Semua staff yang log masuk boleh baca.
-- (Penulisan hanya melalui API dashboard yang guna service-role key,
--  yang memintas RLS — jadi tiada polisi tulis diperlukan di sini.)
drop policy if exists recovery_read on recovery_records;
create policy recovery_read on recovery_records
  for select using (auth.uid() is not null);

-- Semak
select count(*) as jumlah_rekod from recovery_records;
