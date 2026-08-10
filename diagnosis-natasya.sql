-- ==========================================================================
-- DIAGNOSIS: kenapa Natasya masih "BELUM HANTAR"?
--
-- Run SEMUA sekali. Akan keluar 4 jadual hasil. Hantar screenshot
-- KEEMPAT-EMPATNYA kepada saya.
--
-- Selamat sepenuhnya — fail ini HANYA BACA, tiada apa yang diubah.
-- ==========================================================================

-- ---------- A) Semua rekod penghantaran Natasya (semua minggu, semua bulan) --
select
  'A. PENGHANTARAN NATASYA' as bahagian,
  ws.year,
  ws.month,
  ws.week,
  ws.submitted_at,
  to_char(ws.submitted_at at time zone 'Asia/Kuala_Lumpur', 'Dy DD-Mon-YYYY HH24:MI')
    as masa_malaysia,
  ws.on_time
from weekly_submissions ws
join profiles p on p.id = ws.user_id
where p.full_name ilike '%natas%'
order by ws.year, ws.month, ws.week;

-- ---------- B) Semua tugasan Natasya, dikumpulkan ikut minggu ---------------
select
  'B. TUGASAN NATASYA' as bahagian,
  t.year,
  t.month,
  t.week,
  count(*) as bilangan_tugasan,
  round(avg(t.pct)) as purata_peratus,
  min(t.created_at) as tugasan_pertama_dibuat,
  max(t.updated_at) as kali_terakhir_diubah
from todos t
join profiles p on p.id = t.user_id
where p.full_name ilike '%natas%'
group by t.year, t.month, t.week
order by t.year, t.month, t.week;

-- ---------- C) Senarai penuh tugasan Natasya bulan Ogos 2026 ---------------
select
  'C. BUTIRAN TUGASAN OGOS' as bahagian,
  t.week,
  t.title,
  t.pct,
  t.status,
  t.priority
from todos t
join profiles p on p.id = t.user_id
where p.full_name ilike '%natas%'
  and t.year = 2026
  and t.month = 8
order by t.week, t.title;

-- ---------- D) Bandingkan dengan orang yang BERJAYA hantar -----------------
-- Ini tunjuk bagaimana rekod yang betul sepatutnya kelihatan.
select
  'D. CONTOH YANG BETUL' as bahagian,
  p.full_name,
  ws.year, ws.month, ws.week,
  to_char(ws.submitted_at at time zone 'Asia/Kuala_Lumpur', 'Dy DD-Mon HH24:MI')
    as masa_malaysia,
  ws.on_time
from weekly_submissions ws
join profiles p on p.id = ws.user_id
where ws.year = 2026 and ws.month = 8
order by p.full_name, ws.week;

-- ---------- E) Adakah team DIBENARKAN menyimpan penghantaran? --------------
-- Kalau tiada baris "INSERT" di sini, itulah puncanya: butang "Hantar"
-- mereka ditolak oleh keselamatan database, jadi tiada apa yang tersimpan.
select
  'E. KEBENARAN DATABASE' as bahagian,
  policyname as nama_polisi,
  cmd as jenis,
  roles::text as untuk_siapa,
  coalesce(qual, with_check) as syarat
from pg_policies
where schemaname = 'public'
  and tablename = 'weekly_submissions'
order by cmd, policyname;
