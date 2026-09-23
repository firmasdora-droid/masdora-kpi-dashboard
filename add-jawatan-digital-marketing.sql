-- ==========================================================================
-- JAWATAN BARU: DIGITAL MARKETING
--
-- Akses jawatan ini (dikawal oleh dashboard, bukan SQL):
--   BOLEH   : Content Planner, Prestasi Konten, Leaderboard jualan,
--             Dashboard Utama, Profil Saya
--   TIDAK   : To-Do List harian, Key-in Jualan, Laporan WhatsApp,
--             Tugasan Grafik, Isu Pelanggan, Laporan Chat, Recovery CRM
--
-- Mereka TIDAK dikira dalam laporan "belum hantar To-Do List".
--
-- Cara guna: Supabase -> SQL Editor -> New query -> tampal -> Run
-- Selamat di-run berulang kali (idempotent).
-- ==========================================================================

-- 1) Jabatan Digital Marketing
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'departments' and column_name = 'color'
  ) then
    insert into departments (code, name, short_name, color, sort_order)
    values ('DIGITAL', 'Digital Marketing', 'Digital', '#F26122', 60)
    on conflict (code) do nothing;
  else
    insert into departments (code, name)
    values ('DIGITAL', 'Digital Marketing')
    on conflict (code) do nothing;
  end if;
end $$;

-- 2) Jawatan Digital Marketing
insert into positions (code, name, dept_code) values
  ('DM', 'Digital Marketing', 'DIGITAL')
on conflict (code) do nothing;

-- ---------------------------------------------------------------- semak
select code, name, dept_code from positions where code = 'DM';
