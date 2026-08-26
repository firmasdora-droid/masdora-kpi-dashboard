-- ==========================================================================
-- SASARAN JUALAN RM100,000 SEBULAN
--
-- Untuk semua Customer Service + Harith (videographer produk).
-- Ditetapkan untuk SEMUA bulan 2026 & 2027, jadi tiada kerja bulanan.
--
-- Sasaran mingguan = RM100,000 / 4 = RM25,000 (dikira oleh dashboard,
-- tidak disimpan berasingan supaya hanya ada SATU sumber kebenaran).
--
-- Cara guna: Supabase SQL Editor -> New query -> tampal SEMUA -> Run
-- Selamat di-run berulang kali. Run semula selepas menambah staf CS baharu.
-- ==========================================================================

-- ---------- 0) Pastikan kekangan unik ada ----------
-- ON CONFLICT di bawah memerlukannya. Kalau skema asal sudah ada kekangan
-- ini, baris ini tidak melakukan apa-apa.
create unique index if not exists uq_sales_targets_user_month
  on sales_targets (user_id, year, month);

-- ---------- 1) Siapa yang layak ----------
-- Dipilih melalui position_code, bukan nama — supaya staf CS baharu
-- automatik termasuk bila fail ini di-run semula.
with layak as (
  select id, full_name, position_code
  from profiles
  where active = true
    and (
      position_code in ('CS_AGENT', 'CS_WEB', 'CS_SHOPEE', 'CS_TIKTOK')
      or position_code = 'VID_PROD'          -- Harith
    )
),
bulan as (
  select y.tahun, m.bulan
  from (values (2026), (2027)) as y(tahun)
  cross join generate_series(1, 12) as m(bulan)
)
insert into sales_targets (user_id, year, month, target_rm)
select l.id, b.tahun, b.bulan, 100000
from layak l
cross join bulan b
on conflict (user_id, year, month)
do update set target_rm = excluded.target_rm,
              updated_at = now();

-- ---------- 2) Semak siapa yang dapat sasaran ----------
select
  p.full_name,
  p.position_code,
  count(t.id) as bulan_disasarkan,
  max(t.target_rm) as sasaran_sebulan,
  round(max(t.target_rm) / 4.0) as sasaran_seminggu
from profiles p
join sales_targets t on t.user_id = p.id
where p.active = true
group by p.full_name, p.position_code
order by p.full_name;
