-- ==========================================================================
-- CIPTA INVITE UNTUK 9 STAFF
-- Cara guna: Supabase Dashboard -> SQL Editor -> New query -> tampal -> Run
-- Selamat di-run semula (idempotent, guna ON CONFLICT (code) DO NOTHING).
-- ==========================================================================

insert into pending_invites (name, email, position_code, dept_code, role, code, temp_password, created_by) values
  ('Qistina', 'qistina@masdora.com',  'CC',         'CONTENT', 'member', 'INV-QISTINA-2026', 'Qistina2026!', '88dfac9c-6bfc-4b3a-afa0-1f53c45de41f'),
  ('Irsyad',  'irsyad@masdora.com',   'VID_TT',     'VIDEO',   'member', 'INV-IRSYAD-2026',  'Irsyad2026!',  '88dfac9c-6bfc-4b3a-afa0-1f53c45de41f'),
  ('Harith',  'harith@masdora.com',   'VID_PROD',   'VIDEO',   'member', 'INV-HARITH-2026',  'Harith2026!',  '88dfac9c-6bfc-4b3a-afa0-1f53c45de41f'),
  ('Maisarah','maisarah@masdora.com', 'CS_WEB',     'CS',      'member', 'INV-MAISARAH-2026','Maisarah2026!','88dfac9c-6bfc-4b3a-afa0-1f53c45de41f'),
  ('Najjati', 'najjati@masdora.com',  'CS_SHOPEE',  'CS',      'member', 'INV-NAJJATI-2026', 'Najjati2026!', '88dfac9c-6bfc-4b3a-afa0-1f53c45de41f'),
  ('Natasha', 'natasha@masdora.com',  'CS_TIKTOK',  'CS',      'member', 'INV-NATASHA-2026', 'Natasha2026!', '88dfac9c-6bfc-4b3a-afa0-1f53c45de41f'),
  ('Megat',   'megat@masdora.com',    'GD_SOCIAL',  'DESIGN',  'member', 'INV-MEGAT-2026',   'Megat2026!',   '88dfac9c-6bfc-4b3a-afa0-1f53c45de41f'),
  ('Esha',    'esha@masdora.com',     'GD_CATALOG', 'DESIGN',  'member', 'INV-ESHA-2026',    'Esha2026!',    '88dfac9c-6bfc-4b3a-afa0-1f53c45de41f'),
  ('Faiz',    'faiz@masdora.com',     'GD_SHOPEE',  'DESIGN',  'member', 'INV-FAIZ-2026',    'Faiz2026!',    '88dfac9c-6bfc-4b3a-afa0-1f53c45de41f')
on conflict (code) do nothing;

-- Semak hasil (invite yang belum digunakan)
select name, email, position_code, code, temp_password, used_at
from pending_invites
order by created_at desc
limit 20;
