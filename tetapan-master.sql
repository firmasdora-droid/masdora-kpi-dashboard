-- ==========================================================================
-- MASTER SETTING — kebenaran untuk Marketing Manager
--
-- Membolehkan Marketing Manager mengubah SEMUA tetapan dashboard melalui
-- halaman "Master Setting", tanpa perlu menulis SQL lagi:
--   * sasaran & senarai kerja To-Do setiap ahli
--   * kuantiti harian yang dilaporkan ahli (pembetulan)
--   * sasaran jualan bulanan (RM)
--   * definisi & sasaran KPI mengikut jawatan
--
-- Ahli biasa tetap TIDAK boleh mengubah sasaran mereka sendiri.
--
-- Cara guna: Supabase -> SQL Editor -> New query -> tampal SEMUA -> Run
-- Selamat di-run berulang kali.
-- ==========================================================================

-- ---------- 1) Pembetulan: Card printing Megat 500 -> 50 sebulan ----------
update task_templates
set target_monthly = 50
where title ilike 'card printing%'
  and target_monthly = 500;

-- ---------- 2) Sasaran jualan: manager boleh ubah dari dashboard ----------
alter table sales_targets enable row level security;

drop policy if exists st_read on sales_targets;
create policy st_read on sales_targets
  for select using (auth.uid() is not null);

drop policy if exists st_insert on sales_targets;
create policy st_insert on sales_targets
  for insert with check (my_role() = 'manager');

drop policy if exists st_update on sales_targets;
create policy st_update on sales_targets
  for update using (my_role() = 'manager')
  with check (my_role() = 'manager');

drop policy if exists st_delete on sales_targets;
create policy st_delete on sales_targets
  for delete using (my_role() = 'manager');

-- Diperlukan oleh "simpan" di halaman Master Setting.
create unique index if not exists uq_sales_targets_user_month
  on sales_targets (user_id, year, month);

-- ---------- 3) KPI: manager boleh ubah sasaran asas ----------
alter table kpi_definitions enable row level security;

drop policy if exists kd_read on kpi_definitions;
create policy kd_read on kpi_definitions
  for select using (auth.uid() is not null);

drop policy if exists kd_insert on kpi_definitions;
create policy kd_insert on kpi_definitions
  for insert with check (my_role() = 'manager');

drop policy if exists kd_update on kpi_definitions;
create policy kd_update on kpi_definitions
  for update using (my_role() = 'manager')
  with check (my_role() = 'manager');

-- ---------- 4) Semak ----------
select 'Card printing' as tetapan,
       title, unit, target_monthly
from task_templates
where title ilike 'card printing%';
