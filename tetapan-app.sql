-- ==========================================================================
-- TETAPAN DASHBOARD (app_settings)
--
-- Satu jadual kecil yang menyimpan tetapan keseluruhan dashboard supaya
-- Marketing Manager boleh mengubahnya dari halaman "Master Setting" tanpa
-- menulis kod atau SQL:
--
--   paparan  — tajuk sidebar & pengumuman kepada team
--   masa     — jam akhir hantar To-Do, hari kerja seminggu / sebulan
--   akses    — menu mana yang setiap JAWATAN boleh lihat
--
-- Hanya Marketing Manager boleh menulis. Semua staf boleh membaca
-- (dashboard perlu membacanya untuk memaparkan menu yang betul).
--
-- Cara guna: Supabase -> SQL Editor -> New query -> tampal SEMUA -> Run
-- Selamat di-run berulang kali.
-- ==========================================================================

create table if not exists app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles (id)
);

alter table app_settings enable row level security;

drop policy if exists as_read on app_settings;
create policy as_read on app_settings
  for select using (auth.uid() is not null);

drop policy if exists as_insert on app_settings;
create policy as_insert on app_settings
  for insert with check (my_role() = 'manager');

drop policy if exists as_update on app_settings;
create policy as_update on app_settings
  for update using (my_role() = 'manager')
  with check (my_role() = 'manager');

drop policy if exists as_delete on app_settings;
create policy as_delete on app_settings
  for delete using (my_role() = 'manager');

-- Nilai asal. "do nothing" supaya tetapan yang manager sudah ubah tidak
-- ditimpa apabila fail ini di-run semula.
insert into app_settings (key, value) values
  ('paparan', '{"tajuk":"Team Dashboard","pengumuman":""}'::jsonb),
  ('masa',    '{"jam_akhir_hantar":17,"hari_kerja_seminggu":6,"hari_kerja_sebulan":26}'::jsonb),
  ('akses',   '{}'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------- semak
select key, value, updated_at from app_settings order by key;
