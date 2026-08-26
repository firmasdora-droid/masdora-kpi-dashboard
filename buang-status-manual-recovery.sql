-- ==========================================================================
-- BUANG STATUS MANUAL RECOVERY
--
-- Status kini datang dari CRM sepenuhnya. Maisarah kemas kini di CRM sahaja.
-- Fail ini mengemas kesan lajur manual yang tidak lagi digunakan:
--
--   1. Kosongkan nilai team_status yang tertinggal (supaya tiada nilai lama
--      mengelirukan kalau lajur itu dibaca semula pada masa hadapan)
--   2. Tarik balik kebenaran UPDATE yang dibuka untuk dropdown itu —
--      dashboard tidak lagi perlu menulis ke jadual ini
--
-- Lajur itu sendiri DIKEKALKAN. Membuangnya tiada faedah dan berisiko;
-- lajur kosong yang tidak dibaca tidak memudaratkan apa-apa.
--
-- Cara guna: Supabase SQL Editor -> New query -> tampal SEMUA -> Run
-- Selamat di-run berulang kali.
-- ==========================================================================

-- ---------- 1) Kosongkan nilai yang tertinggal ----------
update recovery_records
set team_status = null,
    team_note = null,
    team_updated_at = null,
    team_updated_by = null
where team_status is not null
   or team_note is not null;

-- ---------- 2) Tarik balik kebenaran menulis ----------
-- Aliran data kini satu hala: CRM -> dashboard. Penulisan hanya berlaku
-- melalui service-role key dalam /api/crm-sync, yang memintas RLS.
drop policy if exists recovery_update_team on recovery_records;

-- ---------- 3) Semak ----------
select
  'SIAP' as peringkat,
  count(*) as jumlah_kes,
  count(team_status) as status_manual_tinggal
from recovery_records;

select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'recovery_records'
order by cmd;
