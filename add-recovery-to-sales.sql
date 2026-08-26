-- ==========================================================================
-- JUALAN PULIH MASUK KE JUALAN MAISARAH
--
-- Setiap kes recovery yang berjaya dipulihkan dimasukkan sebagai jualan
-- Maisarah secara automatik — supaya ia muncul dalam leaderboard jualan,
-- Dashboard Utama dia, dan Laporan Mingguan PDF.
--
-- Lajur `source_ref` menjadi kunci unik supaya penyegerakan berulang kali
-- TIDAK menghasilkan jualan berganda. Satu kes recovery = satu baris jualan,
-- dikemas kini kalau jumlahnya berubah.
--
-- Cara guna: Supabase SQL Editor -> New query -> tampal SEMUA -> Run
-- Selamat di-run berulang kali.
-- ==========================================================================

alter table sales
  add column if not exists source_ref text;

-- Unik HANYA bila source_ref ada nilai. Jualan yang dikey-in manual
-- (source_ref null) tidak terjejas sama sekali.
create unique index if not exists uq_sales_source_ref
  on sales (source_ref)
  where source_ref is not null;

-- ---------------------------------------------------------------- semak
-- Adakah Maisarah dapat dikenal pasti? Penyegerakan memerlukan ini.
select
  id,
  full_name,
  handler_code,
  position_code,
  active
from profiles
where handler_code = 'MAI'
   or full_name ilike '%maisarah%';

select
  'JUALAN DARI RECOVERY' as peringkat,
  count(*) as bilangan,
  coalesce(sum(amount_rm), 0) as jumlah_rm
from sales
where source_ref like 'recovery-%';
