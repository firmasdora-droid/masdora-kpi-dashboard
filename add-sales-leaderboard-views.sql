-- ==========================================================================
-- LEADERBOARD JUALAN — harian, mingguan, bulanan
-- Cara guna: Supabase Dashboard -> SQL Editor -> tampal semua -> Run
-- Selamat di-run semula (create or replace view).
-- ==========================================================================

-- Base: satu baris jualan + nama/jabatan, dengan year/month/week (minggu 1-4
-- dikira sama macam KPI: ceil(hari/7), klamp 1-4) supaya konsisten dengan
-- seluruh app.
create or replace view v_sales_leaderboard as
select
  s.id, s.user_id, p.full_name, p.dept_code, p.position_code,
  s.date,
  extract(year from s.date)::int as year,
  extract(month from s.date)::int as month,
  least(4, ceil(extract(day from s.date) / 7.0))::int as week,
  s.amount_rm, s.platform, s.team, s.host_name, s.live_account
from sales s
join profiles p on p.id = s.user_id;

-- Ranking harian
create or replace view v_sales_rank_daily as
select
  date, user_id, full_name, dept_code,
  sum(amount_rm) as total_rm,
  count(*) as entries,
  rank() over (partition by date order by sum(amount_rm) desc) as rank
from v_sales_leaderboard
group by date, user_id, full_name, dept_code;

-- Ranking mingguan (ikut definisi minggu 1-4 yang sama macam KPI)
create or replace view v_sales_rank_weekly as
select
  year, month, week, user_id, full_name, dept_code,
  sum(amount_rm) as total_rm,
  count(*) as entries,
  rank() over (partition by year, month, week order by sum(amount_rm) desc) as rank
from v_sales_leaderboard
group by year, month, week, user_id, full_name, dept_code;

-- Ranking bulanan, sekali dengan % pencapaian sasaran RM (dari sales_targets)
create or replace view v_sales_rank_monthly as
select
  v.year, v.month, v.user_id, v.full_name, v.dept_code,
  sum(v.amount_rm) as total_rm,
  count(*) as entries,
  t.target_rm,
  case when t.target_rm > 0
    then round((sum(v.amount_rm) / t.target_rm) * 100, 1)
    else null
  end as pct_target,
  rank() over (partition by v.year, v.month order by sum(v.amount_rm) desc) as rank
from v_sales_leaderboard v
left join sales_targets t
  on t.user_id = v.user_id and t.year = v.year and t.month = v.month
group by v.year, v.month, v.user_id, v.full_name, v.dept_code, t.target_rm;

-- Note: view ini dicipta melalui SQL Editor (superuser), jadi ia boleh dibaca
-- oleh SEMUA pengguna log masuk walaupun jadual asal `sales` hadkan
-- ahli hanya nampak rekod sendiri (sale_read policy) — sama macam
-- v_leaderboard sedia ada untuk KPI. Ini sengaja, supaya leaderboard jualan
-- boleh dilihat semua orang.
