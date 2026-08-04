-- ==========================================================================
-- KEMASKINI KPI: Customer Service (Web, Shopee, TikTok)
-- Maisarah = CS_WEB, Najjati = CS_SHOPEE (uruskan OS & HQ), Natasha = CS_TIKTOK (uruskan OS & MY)
-- Cara guna: Supabase Dashboard -> SQL Editor -> tampal semua -> Run
-- Selamat di-run semula (idempotent).
-- ==========================================================================

-- 1) Nyahaktifkan KPI generik lama untuk 3 jawatan CS ni
update kpi_definitions
set active = false
where position_code in ('CS_WEB', 'CS_SHOPEE', 'CS_TIKTOK');

-- 2) KPI sebenar — sama struktur untuk ketiga-tiga jawatan CS
insert into kpi_definitions (id, position_code, kpi_group, name, unit, default_target, weight, direction, active, status, approved_at, sort_order) values
  ('CW101','CS_WEB','Servis Pelanggan','Chat reply per week','num',700,3,'up',true,'active',now(),1),
  ('CW102','CS_WEB','Servis Pelanggan','Response chat rate','pct',95,3,'up',true,'active',now(),2),
  ('CS101','CS_SHOPEE','Servis Pelanggan','Chat reply per week','num',400,3,'up',true,'active',now(),1),
  ('CS102','CS_SHOPEE','Servis Pelanggan','Response chat rate','pct',95,3,'up',true,'active',now(),2),
  ('CT101','CS_TIKTOK','Servis Pelanggan','Chat reply per week','num',300,3,'up',true,'active',now(),1),
  ('CT102','CS_TIKTOK','Servis Pelanggan','Response chat rate','pct',95,3,'up',true,'active',now(),2)
on conflict (id) do update set
  kpi_group = excluded.kpi_group, name = excluded.name, unit = excluded.unit,
  default_target = excluded.default_target, weight = excluded.weight,
  direction = excluded.direction, active = true, status = 'active', sort_order = excluded.sort_order;

-- ==========================================================================
-- NOTA — Sasaran jualan RM10,000/bulan TIDAK diletak di sini.
-- Ia guna jadual `sales_targets` (bukan kpi_definitions) sebab jualan
-- direkod harian & dikira bulanan secara native dalam app, bukan mingguan
-- macam KPI biasa. Ia perlu dikaitkan dengan user_id (bukan position_code),
-- jadi kena tunggu Maisarah/Najjati/Natasha ada akaun dulu (lepas invite).
-- Saya akan sediakan SQL/borang untuk ni selepas mereka daftar.
-- ==========================================================================
