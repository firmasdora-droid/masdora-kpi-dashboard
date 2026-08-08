-- ==========================================================================
-- BETULKAN PENGHANTARAN YANG TERSALAH MINGGU
--
-- MASALAH:
--   Tarikh akhir ialah Jumaat 5 petang. Tetapi sistem lama mengira minggu
--   sebagai ceil(hari / 7). Jadi pada hari SABTU & AHAD, penghantaran
--   difailkan ke minggu BERIKUTNYA — sedangkan kerja itu milik minggu yang
--   baru sahaja tamat.
--
--   Contoh: Natasya hantar pada Sabtu 8 Ogos. Kerjanya di Minggu 1
--   (tarikh akhir Jumaat 7 Ogos), tetapi ia tersimpan sebagai Minggu 2 —
--   jadi Minggu 1 kekal "Belum hantar".
--
--   Kod dashboard sudah dibetulkan supaya ini tidak berulang.
--   Fail ini pula membetulkan rekod yang SUDAH tersalah simpan.
--
-- Cara guna: Supabase SQL Editor -> New query -> tampal SEMUA -> Run
-- Selamat di-run berulang kali (tiada kesan kalau sudah betul).
-- ==========================================================================

-- ---------- 1) SEBELUM: lihat keadaan semasa ----------
select
  'SEBELUM' as peringkat,
  p.full_name,
  ws.year, ws.month, ws.week,
  ws.submitted_at,
  ws.on_time
from weekly_submissions ws
join profiles p on p.id = ws.user_id
where ws.year = 2026 and ws.month = 8
order by p.full_name, ws.week;

-- ---------- 2) PEMBETULAN ----------
-- Pindahkan penghantaran yang tersalah ke minggu sebelumnya, HANYA jika:
--   (a) ia dihantar pada hari Sabtu atau Ahad, DAN
--   (b) pengguna itu ADA tugasan pada minggu sebelumnya, DAN
--   (c) pengguna itu BELUM ada penghantaran untuk minggu sebelumnya
--       (elak pertindihan dengan kekangan unik)
update weekly_submissions ws
set week = ws.week - 1
where ws.week > 1
  and extract(dow from ws.submitted_at at time zone 'Asia/Kuala_Lumpur') in (0, 6)
  and exists (
    select 1 from todos t
    where t.user_id = ws.user_id
      and t.year = ws.year and t.month = ws.month
      and t.week = ws.week - 1
  )
  and not exists (
    select 1 from weekly_submissions w2
    where w2.user_id = ws.user_id
      and w2.year = ws.year and w2.month = ws.month
      and w2.week = ws.week - 1
  );

-- ---------- 3) SELEPAS: sahkan pembetulan ----------
select
  'SELEPAS' as peringkat,
  p.full_name,
  ws.year, ws.month, ws.week,
  ws.submitted_at,
  ws.on_time
from weekly_submissions ws
join profiles p on p.id = ws.user_id
where ws.year = 2026 and ws.month = 8
order by p.full_name, ws.week;

-- ---------- 4) SIAPA MASIH BELUM HANTAR (Ogos, Minggu 1) ----------
select
  p.full_name,
  p.position_code,
  count(t.id) as bilangan_tugasan,
  case when ws.submitted_at is null then 'BELUM HANTAR' else 'Sudah hantar' end as status
from profiles p
left join todos t
  on t.user_id = p.id and t.year = 2026 and t.month = 8 and t.week = 1
left join weekly_submissions ws
  on ws.user_id = p.id and ws.year = 2026 and ws.month = 8 and ws.week = 1
where p.active = true
  and p.role not in ('manager', 'ceo')
group by p.full_name, p.position_code, ws.submitted_at
order by status desc, p.full_name;
