-- ==========================================================================
-- KEMASKINI KPI: Content Creator, Videographer TikTok, Videographer Produk & Shopee
-- Sumber: Masdora_VideoTeam_Weekly_FINAL (Google Sheet team video)
-- Cara guna: Supabase Dashboard -> SQL Editor -> tampal semua -> Run
-- Selamat di-run semula (idempotent) — guna ON CONFLICT DO UPDATE.
-- ==========================================================================

-- 1) Nyahaktifkan KPI generik lama untuk 3 jawatan ni (bukan padam, supaya
--    sejarah kpi_entries lama kekal). Ia akan hilang dari borang KPI ahli
--    serta-merta sebab app hanya papar KPI dengan active = true.
update kpi_definitions
set active = false
where position_code in ('CC', 'VID_TT', 'VID_PROD');

-- 2) KPI sebenar — Content Creator (Qistina)
insert into kpi_definitions (id, position_code, kpi_group, name, unit, default_target, weight, direction, active, status, approved_at, sort_order) values
  ('CC101','CC','Perancangan Kandungan + Model','Storyline / skrip siap vs pelan','num',10,3,'up',true,'active',now(),1),
  ('CC102','CC','Perancangan Kandungan + Model','Senarai shooting minggu depan siap','pct',100,2,'up',true,'active',now(),2),
  ('CC103','CC','Perancangan Kandungan + Model','Sesi shooting sebagai model','num',2,1,'up',true,'active',now(),3),
  ('CC104','CC','Output','Baki bank kandungan (skrip siap belum shoot)','num',3,1,'down',true,'active',now(),4),
  ('CC105','CC','Prestasi','Video capai 100,000 views','pct',100,3,'up',true,'active',now(),5)
on conflict (id) do update set
  kpi_group = excluded.kpi_group, name = excluded.name, unit = excluded.unit,
  default_target = excluded.default_target, weight = excluded.weight,
  direction = excluded.direction, active = true, status = 'active', sort_order = excluded.sort_order;

-- 3) KPI sebenar — Videographer TikTok (Irsyad) — akaun MY & OS berasingan
insert into kpi_definitions (id, position_code, kpi_group, name, unit, default_target, weight, direction, active, status, approved_at, sort_order) values
  ('VT101','VID_TT','TikTok Masdora MY','Video diposkan (MY)','num',7,3,'up',true,'active',now(),1),
  ('VT102','VID_TT','TikTok Masdora MY','Video capai 100k views (MY)','pct',100,3,'up',true,'active',now(),2),
  ('VT103','VID_TT','TikTok Masdora MY','Jumlah tontonan (MY)','num',700000,2,'up',true,'active',now(),3),
  ('VT104','VID_TT','TikTok Masdora MY','Pertumbuhan followers (MY)','num',500,2,'up',true,'active',now(),4),
  ('VT105','VID_TT','TikTok Masdora MY','Purata engagement setiap video (MY)','pct',5,1,'up',true,'active',now(),5),
  ('VT201','VID_TT','TikTok Masdora OS','Video diposkan (OS)','num',7,3,'up',true,'active',now(),6),
  ('VT202','VID_TT','TikTok Masdora OS','% video capai 100k (OS)','pct',100,3,'up',true,'active',now(),7),
  ('VT203','VID_TT','TikTok Masdora OS','Jumlah tontonan (OS)','num',700000,2,'up',true,'active',now(),8),
  ('VT204','VID_TT','TikTok Masdora OS','Pertumbuhan followers (OS)','num',300,2,'up',true,'active',now(),9),
  ('VT205','VID_TT','TikTok Masdora OS','Purata engagement setiap video (OS)','pct',5,1,'up',true,'active',now(),10)
on conflict (id) do update set
  kpi_group = excluded.kpi_group, name = excluded.name, unit = excluded.unit,
  default_target = excluded.default_target, weight = excluded.weight,
  direction = excluded.direction, active = true, status = 'active', sort_order = excluded.sort_order;

-- 4) KPI sebenar — Videographer Produk & Shopee (Harith) — Shopee OS & HQ berasingan
insert into kpi_definitions (id, position_code, kpi_group, name, unit, default_target, weight, direction, active, status, approved_at, sort_order) values
  ('VP101','VID_PROD','Shopee Masdora OS','Video wall diposkan (OS)','num',7,3,'up',true,'active',now(),1),
  ('VP102','VID_PROD','Shopee Masdora OS','Video wall capai 1,000 views (OS)','pct',100,2,'up',true,'active',now(),2),
  ('VP103','VID_PROD','Shopee Masdora OS','Video katalog — item baru (OS)','num',10,3,'up',true,'active',now(),3),
  ('VP104','VID_PROD','Shopee Masdora OS','Video katalog — backlog produk lama siap (OS)','num',5,2,'up',true,'active',now(),4),
  ('VP105','VID_PROD','Shopee Masdora OS','Baki backlog produk tiada video (OS)','num',0,2,'down',true,'active',now(),5),
  ('VP106','VID_PROD','Shopee Masdora OS','Jumlah tontonan wall (OS)','num',7000,1,'up',true,'active',now(),6),
  ('VP107','VID_PROD','Shopee Masdora OS','Pertumbuhan followers (OS)','num',300,1,'up',true,'active',now(),7),
  ('VP201','VID_PROD','Shopee Masdora HQ','Video wall diposkan (HQ)','num',7,3,'up',true,'active',now(),8),
  ('VP202','VID_PROD','Shopee Masdora HQ','Video wall capai 1,000 views (HQ)','pct',100,2,'up',true,'active',now(),9),
  ('VP203','VID_PROD','Shopee Masdora HQ','Video katalog — item baru (HQ)','num',10,3,'up',true,'active',now(),10),
  ('VP204','VID_PROD','Shopee Masdora HQ','Video katalog — backlog produk lama siap (HQ)','num',5,2,'up',true,'active',now(),11),
  ('VP205','VID_PROD','Shopee Masdora HQ','Baki backlog produk tiada video (HQ)','num',0,2,'down',true,'active',now(),12),
  ('VP206','VID_PROD','Shopee Masdora HQ','Jumlah tontonan wall (HQ)','num',7000,1,'up',true,'active',now(),13),
  ('VP207','VID_PROD','Shopee Masdora HQ','Pertumbuhan followers (HQ)','num',300,1,'up',true,'active',now(),14)
on conflict (id) do update set
  kpi_group = excluded.kpi_group, name = excluded.name, unit = excluded.unit,
  default_target = excluded.default_target, weight = excluded.weight,
  direction = excluded.direction, active = true, status = 'active', sort_order = excluded.sort_order;
