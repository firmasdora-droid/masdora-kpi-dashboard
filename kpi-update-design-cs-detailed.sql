-- ==========================================================================
-- KEMASKINI KPI: Graphic Designer (per-orang, tugasan berbeza) + Customer
-- Service (versi terperinci, gantikan versi ringkas sebelum ni)
-- Cara guna: Supabase Dashboard -> SQL Editor -> tampal semua -> Run
-- Selamat di-run semula (idempotent).
--
-- NOTA PENTING — Sasaran BULANAN ditukar ke SASARAN MINGGUAN (÷4):
-- App ni skor KPI setiap MINGGU (Minggu 1-4), bukan bulanan terus. Supaya
-- skor mingguan tak nampak teruk (cth: 0/500 sepanjang minggu 1-3 baru
-- capai 500 di minggu 4), setiap sasaran bulanan yang anda bagi saya bahagi
-- 4 jadi sasaran mingguan. Angka BULANAN asal disimpan dalam ruangan
-- "description" setiap KPI supaya tak hilang rujukan asal.
-- ==========================================================================

-- ============ JAWATAN BARU — Designer, ikut tugasan sebenar setiap orang ============
insert into positions (code, name, dept_code) values
  ('GD_SOCIAL',  'Graphic Designer — Sosial & Gold Bar Card', 'DESIGN'),
  ('GD_CATALOG', 'Graphic Designer — Katalog & DIY Gold Bar', 'DESIGN'),
  ('GD_SHOPEE',  'Graphic Designer — Shopee & Katalog',        'DESIGN')
on conflict (code) do nothing;

-- Nyahaktifkan KPI generik lama 'GD' (tiada siapa guna lagi selepas ni)
update kpi_definitions set active = false where position_code = 'GD';

-- ============ MEGAT — GD_SOCIAL ============
insert into kpi_definitions (id, position_code, kpi_group, name, unit, default_target, weight, direction, description, active, status, approved_at, sort_order) values
  ('GDS01','GD_SOCIAL','Kreatif','Banner & poster TikTok','num',4,3,'up','Sasaran asal: 15 design/bulan',true,'active',now(),1),
  ('GDS02','GD_SOCIAL','Kreatif','Frame product ads','num',1,2,'up','Sasaran asal: 3 design/bulan',true,'active',now(),2),
  ('GDS03','GD_SOCIAL','Kreatif','Product sticker','num',1,2,'up','Sasaran asal: 3 design/bulan',true,'active',now(),3),
  ('GDS04','GD_SOCIAL','Kreatif','Live host sticker','num',1,2,'up','Sasaran asal: 3 design/bulan',true,'active',now(),4),
  ('GDS05','GD_SOCIAL','Produk','Product design','num',5,3,'up','Sasaran asal: 20 design/bulan',true,'active',now(),5),
  ('GDS06','GD_SOCIAL','Percetakan','Gold Bar card printing','num',125,2,'up','Sasaran asal: 500 pcs/bulan',true,'active',now(),6)
on conflict (id) do update set
  kpi_group=excluded.kpi_group, name=excluded.name, unit=excluded.unit,
  default_target=excluded.default_target, weight=excluded.weight,
  direction=excluded.direction, description=excluded.description,
  active=true, status='active', sort_order=excluded.sort_order;

-- ============ ESHA — GD_CATALOG ============
insert into kpi_definitions (id, position_code, kpi_group, name, unit, default_target, weight, direction, description, active, status, approved_at, sort_order) values
  ('GDC01','GD_CATALOG','Kreatif','Product poster','num',1,2,'up','Sasaran asal: 3 design/bulan',true,'active',now(),1),
  ('GDC02','GD_CATALOG','Katalog','New product catalog update','num',10,3,'up','Sasaran asal: 40 produk/bulan',true,'active',now(),2),
  ('GDC03','GD_CATALOG','Katalog','Old product catalog update','num',10,3,'up','Sasaran asal: 40 produk/bulan',true,'active',now(),3),
  ('GDC04','GD_CATALOG','Gold Bar','DIY gold bar printing & design','num',1,2,'up','Sasaran asal: 5 design (0.25g)/bulan',true,'active',now(),4),
  ('GDC05','GD_CATALOG','Kreatif','Merchandise design','num',1,1,'up','Sasaran asal: 2 design/bulan',true,'active',now(),5)
on conflict (id) do update set
  kpi_group=excluded.kpi_group, name=excluded.name, unit=excluded.unit,
  default_target=excluded.default_target, weight=excluded.weight,
  direction=excluded.direction, description=excluded.description,
  active=true, status='active', sort_order=excluded.sort_order;

-- ============ FAIZ — GD_SHOPEE ============
insert into kpi_definitions (id, position_code, kpi_group, name, unit, default_target, weight, direction, description, active, status, approved_at, sort_order) values
  ('GDF01','GD_SHOPEE','Kreatif','Shopee poster & banner','num',8,3,'up','Sasaran asal: 30 design/bulan',true,'active',now(),1),
  ('GDF02','GD_SHOPEE','Katalog','Catalog product design','num',5,3,'up','Sasaran asal: 20 design/bulan',true,'active',now(),2),
  ('GDF03','GD_SHOPEE','Gold Bar','Gold Bar design','num',1,2,'up','Sasaran asal: 2 design/bulan',true,'active',now(),3),
  ('GDF04','GD_SHOPEE','Gold Bar','DIY Gold bar printing & design','num',1,2,'up','Sasaran asal: 5 design, 5 kali, 20g/bulan',true,'active',now(),4)
on conflict (id) do update set
  kpi_group=excluded.kpi_group, name=excluded.name, unit=excluded.unit,
  default_target=excluded.default_target, weight=excluded.weight,
  direction=excluded.direction, description=excluded.description,
  active=true, status='active', sort_order=excluded.sort_order;

-- ==========================================================================
-- CUSTOMER SERVICE — versi terperinci, GANTIKAN versi ringkas
-- (chat reply/response rate) yang saya letak sebelum ni.
-- ==========================================================================
update kpi_definitions
set active = false
where id in ('CW101','CW102','CS101','CS102','CT101','CT102');

-- ============ MAISARAH — CS_WEB ============
insert into kpi_definitions (id, position_code, kpi_group, name, unit, default_target, weight, direction, description, active, status, approved_at, sort_order) values
  ('CW201','CS_WEB','Talent','Talent story IG & TikTok','num',2,2,'up','Sasaran asal: 6 kali/bulan',true,'active',now(),1),
  ('CW202','CS_WEB','Servis','Review & customer update (Website & Instagram)','num',50,3,'up','Sasaran asal: 200 cust/bulan',true,'active',now(),2),
  ('CW203','CS_WEB','Servis','Customer problem solving','num',3,2,'up','Sasaran asal: 10 cust/bulan',true,'active',now(),3),
  ('CW204','CS_WEB','Talent','TikTok content talent','num',3,2,'up','Sasaran asal: 10/bulan',true,'active',now(),4),
  ('CW205','CS_WEB','Servis','Customer walk-in assist','num',4,2,'up','Sasaran asal: 15 cust/bulan',true,'active',now(),5),
  ('CW206','CS_WEB','Gold Bar','DIY gold bar customer assist','num',1,1,'up','Sasaran asal: 5 cust/bulan',true,'active',now(),6)
on conflict (id) do update set
  kpi_group=excluded.kpi_group, name=excluded.name, unit=excluded.unit,
  default_target=excluded.default_target, weight=excluded.weight,
  direction=excluded.direction, description=excluded.description,
  active=true, status='active', sort_order=excluded.sort_order;

-- ============ NAJJATI — CS_SHOPEE ============
insert into kpi_definitions (id, position_code, kpi_group, name, unit, default_target, weight, direction, description, active, status, approved_at, sort_order) values
  ('CS201','CS_SHOPEE','Talent','Talent story IG & TikTok','num',2,2,'up','Sasaran asal: 6 kali/bulan',true,'active',now(),1),
  ('CS202','CS_SHOPEE','Servis','Review & customer update (Shopee)','num',50,3,'up','Sasaran asal: 200 cust/bulan',true,'active',now(),2),
  ('CS203','CS_SHOPEE','Servis','Customer problem solving','num',3,2,'up','Sasaran asal: 10 cust/bulan',true,'active',now(),3),
  ('CS204','CS_SHOPEE','Talent','TikTok content talent','num',3,2,'up','Sasaran asal: 10/bulan',true,'active',now(),4),
  ('CS205','CS_SHOPEE','Servis','Customer walk-in assist','num',4,2,'up','Sasaran asal: 15 cust/bulan',true,'active',now(),5),
  ('CS206','CS_SHOPEE','Gold Bar','DIY gold bar customer assist','num',1,1,'up','Sasaran asal: 5 cust/bulan',true,'active',now(),6)
on conflict (id) do update set
  kpi_group=excluded.kpi_group, name=excluded.name, unit=excluded.unit,
  default_target=excluded.default_target, weight=excluded.weight,
  direction=excluded.direction, description=excluded.description,
  active=true, status='active', sort_order=excluded.sort_order;

-- ============ NATASHA — CS_TIKTOK ============
-- NOTA: baris asal anda tulis "review & customer update SHOPEE" untuk Natasha,
-- tapi Natasha = CS TikTok. Saya andaikan ini silap taip dan tukar ke
-- "(TikTok)" -- sila betulkan kalau saya silap anggap.
insert into kpi_definitions (id, position_code, kpi_group, name, unit, default_target, weight, direction, description, active, status, approved_at, sort_order) values
  ('CT201','CS_TIKTOK','Talent','Talent story IG & TikTok','num',2,2,'up','Sasaran asal: 6 kali/bulan',true,'active',now(),1),
  ('CT202','CS_TIKTOK','Servis','Review & customer update (TikTok)','num',50,3,'up','Sasaran asal: 200 cust/bulan — ANDAIAN: asal tulis Shopee, ditukar ke TikTok',true,'active',now(),2),
  ('CT203','CS_TIKTOK','Servis','Customer problem solving','num',3,2,'up','Sasaran asal: 10 cust/bulan',true,'active',now(),3),
  ('CT204','CS_TIKTOK','Talent','TikTok content talent','num',3,2,'up','Sasaran asal: 10/bulan',true,'active',now(),4),
  ('CT205','CS_TIKTOK','Servis','Customer walk-in assist','num',4,2,'up','Sasaran asal: 15 cust/bulan',true,'active',now(),5),
  ('CT206','CS_TIKTOK','Gold Bar','DIY gold bar customer assist','num',1,1,'up','Sasaran asal: 5 cust/bulan',true,'active',now(),6)
on conflict (id) do update set
  kpi_group=excluded.kpi_group, name=excluded.name, unit=excluded.unit,
  default_target=excluded.default_target, weight=excluded.weight,
  direction=excluded.direction, description=excluded.description,
  active=true, status='active', sort_order=excluded.sort_order;

-- ==========================================================================
-- NOTA — Jualan RM100,000/bulan (Maisarah, Najjati, Natasha)
-- Ini BUKAN letak sebagai KPI di atas (sengaja) — guna jadual sales_targets
-- yang dah sedia (dan Leaderboard Jualan yang baru dibina). Sasaran ini naik
-- daripada RM10,000 -> RM100,000 berbanding permintaan asal anda. Lepas
-- Maisarah/Najjati/Natasha ada akaun, saya akan set target_rm = 100000
-- untuk ketiga-tiga melalui halaman "Tetapkan Sasaran" atau SQL.
-- ==========================================================================
