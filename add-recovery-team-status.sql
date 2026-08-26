-- ==========================================================================
-- STATUS PASUKAN UNTUK RECOVERY CRM
--
-- Kes ditarik automatik dari CRM. Tetapi "sudah dihubungi" ialah fakta yang
-- hanya manusia tahu — jadi ia perlu direkodkan. Lajur di bawah menyimpan
-- rekod itu DI DALAM dashboard, berasingan daripada status Shopify supaya
-- penyegerakan automatik tidak menimpanya.
--
-- Cara guna: Supabase SQL Editor -> New query -> tampal SEMUA -> Run
-- Selamat di-run berulang kali.
-- ==========================================================================

alter table recovery_records
  add column if not exists team_status text,
  add column if not exists team_note text,
  add column if not exists team_updated_at timestamptz,
  add column if not exists team_updated_by uuid references profiles (id);

create index if not exists idx_recovery_team_status
  on recovery_records (team_status);

-- ---------------------------------------------------------------- keselamatan
-- Sesiapa yang log masuk boleh MENANDAKAN status. Recovery ialah kerja
-- pasukan — Maisarah menghubungi, manager & CEO memantau, dan sesiapa
-- boleh membantu menyusuli.
drop policy if exists recovery_update_team on recovery_records;
create policy recovery_update_team on recovery_records
  for update using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- ---------------------------------------------------------------- semak
select
  'SIAP' as peringkat,
  count(*) as jumlah_kes,
  count(team_status) as ada_status_pasukan
from recovery_records;

select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'recovery_records'
order by cmd;
