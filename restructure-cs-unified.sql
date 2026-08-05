-- ==========================================================================
-- RESTRUCTURE CS: satu jawatan kongsi (CS_AGENT) untuk Maisarah/Najjati/Natasha
-- sebab realitinya setiap orang jawab SEMUA platform (WhatsApp/Telegram/
-- Instagram/TikTok/Web), bukan satu orang satu platform.
-- Cara guna: Supabase SQL Editor -> New query -> tampal -> Run
-- Selamat di-run semula (idempotent).
-- ==========================================================================

-- 1) Jawatan baru
insert into positions (code, name, dept_code) values
  ('CS_AGENT', 'Customer Service Agent (semua platform)', 'CS')
on conflict (code) do nothing;

-- 2) Pindahkan profil sedia ada (kalau Maisarah/Najjati/Natasha dah ada akaun)
update profiles set position_code = 'CS_AGENT'
where position_code in ('CS_WEB', 'CS_SHOPEE', 'CS_TIKTOK');

-- 3) Kemaskini invite yang belum digunakan (kalau ada)
update pending_invites set position_code = 'CS_AGENT'
where position_code in ('CS_WEB', 'CS_SHOPEE', 'CS_TIKTOK') and used_at is null;

-- 4) Nyahaktifkan KPI lama yang berasingan ikut platform (CW2xx/CS2xx/CT2xx)
update kpi_definitions
set active = false
where position_code in ('CS_WEB', 'CS_SHOPEE', 'CS_TIKTOK');

-- 5) KPI kongsi baru untuk CS_AGENT (sama macam sebelum ni, id baru)
insert into kpi_definitions (id, position_code, kpi_group, name, unit, default_target, weight, direction, description, active, status, approved_at, sort_order) values
  ('CSA01','CS_AGENT','Talent','Talent story IG & TikTok','num',2,2,'up','Sasaran asal: 6 kali/bulan',true,'active',now(),1),
  ('CSA02','CS_AGENT','Servis','Chat dibalas (semua platform)','num',50,3,'up','Auto dari log chat harian — WhatsApp/Telegram/Instagram/TikTok/Web',true,'active',now(),2),
  ('CSA03','CS_AGENT','Servis','Customer problem solving','num',3,2,'up','Auto dari Customer Issue Report',true,'active',now(),3),
  ('CSA04','CS_AGENT','Talent','TikTok content talent','num',3,2,'up','Sasaran asal: 10/bulan',true,'active',now(),4),
  ('CSA05','CS_AGENT','Servis','Customer walk-in assist','num',4,2,'up','Sasaran asal: 15 cust/bulan',true,'active',now(),5),
  ('CSA06','CS_AGENT','Gold Bar','DIY gold bar customer assist','num',1,1,'up','Sasaran asal: 5 cust/bulan',true,'active',now(),6)
on conflict (id) do update set
  kpi_group=excluded.kpi_group, name=excluded.name, unit=excluded.unit,
  default_target=excluded.default_target, weight=excluded.weight,
  direction=excluded.direction, description=excluded.description,
  active=true, status='active', sort_order=excluded.sort_order;

-- ==========================================================================
-- NOTA: 'CSA02' (Chat dibalas) dan 'CSA03' (Customer problem solving) akan
-- diisi AUTOMATIK oleh sistem sync (langkah seterusnya), bukan key-in manual.
-- Handler mapping: MAI=Maisarah, TI=Najjati, HAWA=Natasha.
-- ==========================================================================
