-- ==========================================================================
-- DIAGNOSTIK — Kenapa jualan CS tak simpan/tak kelihatan
-- Run di SQL Editor, screenshot/copy hasil kat sini.
-- ==========================================================================

-- 1) Profile CS — semak position_code betul ke tidak
select id, full_name, email, role, position_code, dept_code, active
from profiles
where position_code in ('CS_WEB','CS_SHOPEE','CS_TIKTOK')
   or full_name ilike any (array['%maisarah%','%najjati%','%natasha%','%natasya%']);

-- 2) Berapa banyak rekod jualan wujud dalam jadual sales (semua orang)
select count(*) as jumlah_rekod_sales from sales;

-- 3) Rekod jualan terkini (jika ada)
select s.*, p.full_name
from sales s
join profiles p on p.id = s.user_id
order by s.created_at desc
limit 20;
