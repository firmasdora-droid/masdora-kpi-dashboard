-- ==========================================================================
-- TO-DO LIST HARIAN + SASARAN KERJA
--
-- Manager menetapkan kerja tetap dan sasarannya. Ahli hanya memasukkan
-- KUANTITI kerja yang mereka siapkan setiap hari — mereka tidak boleh
-- mengubah sasaran. Dashboard mengira sendiri pencapaian harian, mingguan
-- dan bulanan.
--
-- Cara guna: Supabase SQL Editor -> New query -> tampal SEMUA -> Run
-- Selamat di-run berulang kali.
-- ==========================================================================

-- ---------------------------------------------------------------- 1) Jadual

-- Kerja tetap + sasarannya. Satu baris = satu jenis kerja bagi satu orang.
create table if not exists task_templates (
  id          bigserial primary key,
  user_id     uuid not null references profiles (id) on delete cascade,
  title       text not null,
  /** Unit kerja: "chat", "design", "video", "RM" ... */
  unit        text not null default 'unit',
  /* Sasaran. Mana-mana boleh null — dashboard mengira yang selebihnya. */
  target_daily    numeric,
  target_weekly   numeric,
  target_monthly  numeric,
  /* Kerja yang ditetapkan manager dikunci: ahli tidak boleh ubah/padam.
     Kerja yang ahli tambah sendiri tidak dikunci. */
  locked      boolean not null default true,
  active      boolean not null default true,
  sort_order  int not null default 0,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_task_templates_user
  on task_templates (user_id, active, sort_order);

-- Kuantiti kerja yang dilaporkan setiap hari.
create table if not exists task_logs (
  id          bigserial primary key,
  user_id     uuid not null references profiles (id) on delete cascade,
  template_id bigint not null references task_templates (id) on delete cascade,
  log_date    date not null,
  qty         numeric not null default 0,
  note        text,
  updated_at  timestamptz not null default now()
);

-- Satu baris sahaja bagi setiap kerja setiap hari.
create unique index if not exists uq_task_logs_hari
  on task_logs (user_id, template_id, log_date);
create index if not exists idx_task_logs_tarikh
  on task_logs (log_date);

-- Penghantaran laporan HARIAN (menggantikan penghantaran mingguan).
create table if not exists daily_submissions (
  id           bigserial primary key,
  user_id      uuid not null references profiles (id) on delete cascade,
  log_date     date not null,
  submitted_at timestamptz not null default now(),
  note         text
);

create unique index if not exists uq_daily_submissions
  on daily_submissions (user_id, log_date);

-- ---------------------------------------------------------------- 2) Keselamatan
alter table task_templates enable row level security;
alter table task_logs enable row level security;
alter table daily_submissions enable row level security;

-- BACA: semua staff yang log masuk boleh lihat — supaya manager & CEO
-- boleh memantau, dan pasukan nampak kerja satu sama lain.
drop policy if exists tt_read on task_templates;
create policy tt_read on task_templates
  for select using (auth.uid() is not null);

drop policy if exists tl_read on task_logs;
create policy tl_read on task_logs
  for select using (auth.uid() is not null);

drop policy if exists ds_read on daily_submissions;
create policy ds_read on daily_submissions
  for select using (auth.uid() is not null);

-- TAMBAH kerja: ahli boleh tambah kerja SENDIRI sahaja, dan kerja yang
-- ditambah ahli mesti tidak berkunci. Manager boleh tambah untuk sesiapa.
drop policy if exists tt_insert on task_templates;
create policy tt_insert on task_templates
  for insert with check (
    my_role() = 'manager'
    or (user_id = auth.uid() and locked = false)
  );

-- UBAH/PADAM kerja: manager bebas; ahli hanya kerja sendiri yang TIDAK
-- berkunci. Inilah yang menghalang ahli mengubah sasaran yang ditetapkan.
drop policy if exists tt_update on task_templates;
create policy tt_update on task_templates
  for update using (
    my_role() = 'manager'
    or (user_id = auth.uid() and locked = false)
  )
  with check (
    my_role() = 'manager'
    or (user_id = auth.uid() and locked = false)
  );

drop policy if exists tt_delete on task_templates;
create policy tt_delete on task_templates
  for delete using (
    my_role() = 'manager'
    or (user_id = auth.uid() and locked = false)
  );

-- KUANTITI: ahli isi sendiri; manager boleh betulkan.
drop policy if exists tl_write on task_logs;
create policy tl_write on task_logs
  for insert with check (my_role() = 'manager' or user_id = auth.uid());

drop policy if exists tl_update on task_logs;
create policy tl_update on task_logs
  for update using (my_role() = 'manager' or user_id = auth.uid());

drop policy if exists tl_delete on task_logs;
create policy tl_delete on task_logs
  for delete using (my_role() = 'manager' or user_id = auth.uid());

-- PENGHANTARAN harian
drop policy if exists ds_insert on daily_submissions;
create policy ds_insert on daily_submissions
  for insert with check (my_role() = 'manager' or user_id = auth.uid());

drop policy if exists ds_update on daily_submissions;
create policy ds_update on daily_submissions
  for update using (my_role() = 'manager' or user_id = auth.uid());

-- ---------------------------------------------------------------- 3) Isi kerja

-- Padam dahulu kerja BERKUNCI sedia ada supaya fail ini boleh di-run
-- berulang kali tanpa menghasilkan pendua. Kerja yang ahli tambah sendiri
-- (locked = false) TIDAK disentuh.
delete from task_templates where locked = true;

-- Pembantu: masukkan satu kerja untuk seorang ahli, dicari melalui nama.
create or replace function seed_task(
  nama_cari text,
  t_title text,
  t_unit text,
  d numeric,
  w numeric,
  m numeric,
  urutan int,
  t_note text default null
) returns void
language plpgsql
as $$
declare
  uid uuid;
begin
  select id into uid
  from profiles
  where active = true and full_name ilike nama_cari
  limit 1;

  if uid is null then
    raise notice 'LANGKAU: tiada profil sepadan dengan %', nama_cari;
    return;
  end if;

  insert into task_templates
    (user_id, title, unit, target_daily, target_weekly, target_monthly,
     locked, active, sort_order, note)
  values (uid, t_title, t_unit, d, w, m, true, true, urutan, t_note);
end;
$$;

-- ============ MAISARAH — Customer Service ============
select seed_task('%maisarah%', 'Kira & susun stock in/out',      'kali',   2,    null, null, 1, 'Pagi 1x, petang 1x');
select seed_task('%maisarah%', 'Buka chat plus AI',              'chat',   30,   null, null, 2, 'Minimum 10 chat clear satu masa');
select seed_task('%maisarah%', 'Settle chat WhatsApp',           'chat',   20,   null, null, 3, null);
select seed_task('%maisarah%', 'Unboxing parcel return',         'parcel', 3,    null, null, 4, null);
select seed_task('%maisarah%', 'Update customer issue report',   'report', 10,   null, null, 5, null);
select seed_task('%maisarah%', 'Sasaran jualan',                 'RM',     4000, null, 100000, 6, null);
select seed_task('%maisarah%', 'Reply review Shopee',            'review', 100,  null, null, 7, null);

-- ============ NAJJATI — Customer Service ============
select seed_task('%najjati%', 'Kira & susun stock in/out',      'kali',   2,    null, null, 1, 'Pagi 1x, petang 1x');
select seed_task('%najjati%', 'Buka chat plus AI',              'chat',   30,   null, null, 2, 'Minimum 10 chat clear satu masa');
select seed_task('%najjati%', 'Settle chat WhatsApp',           'chat',   20,   null, null, 3, null);
select seed_task('%najjati%', 'Unboxing parcel return',         'parcel', 3,    null, null, 4, null);
select seed_task('%najjati%', 'Update customer issue report',   'report', 10,   null, null, 5, null);
select seed_task('%najjati%', 'Sasaran jualan',                 'RM',     4000, null, 100000, 6, null);
select seed_task('%najjati%', 'CRM update',                     'chat',   10,   null, 260,  7, null);
select seed_task('%najjati%', 'CRM issue',                      'issue',  20,   null, null, 8, null);
select seed_task('%najjati%', 'Google review',                  'review', 10,   null, null, 9, null);

-- ============ SHA / NATASYA — Customer Service ============
-- "Sha" dipadankan kepada Natasya (kod handler SHA -> HAWA -> Natasya).
select seed_task('%natasya%', 'Kira & susun stock in/out',      'kali',   2,    null, null, 1, 'Pagi 1x, petang 1x');
select seed_task('%natasya%', 'Buka chat plus AI',              'chat',   30,   null, null, 2, 'Minimum 10 chat clear satu masa');
select seed_task('%natasya%', 'Settle chat WhatsApp',           'chat',   20,   null, null, 3, null);
select seed_task('%natasya%', 'Unboxing parcel return',         'parcel', 3,    null, null, 4, null);
select seed_task('%natasya%', 'Update customer issue report',   'report', 10,   null, null, 5, null);
select seed_task('%natasya%', 'Sasaran jualan',                 'RM',     4000, null, 100000, 6, null);
select seed_task('%natasya%', 'Reply review TikTok',            'review', 100,  null, null, 7, null);

-- ============ QISTINA — Content Creator ============
select seed_task('%qistina%', 'Cari content',                   'content', null, 14, null, 1, null);
select seed_task('%qistina%', 'Shoot content OS',               'content', 7,    null, null, 2, null);
select seed_task('%qistina%', 'Product video talent',           'video',   6,    null, null, 3, null);
select seed_task('%qistina%', 'Model gambar product',           'gambar',  6,    null, null, 4, null);
select seed_task('%qistina%', 'Content result',                 'content', 2,    null, null, 5, null);
select seed_task('%qistina%', 'Reply comment',                  'comment', 10,   null, null, 6, 'Asal: 10 comment/akaun');
select seed_task('%qistina%', 'Postmortem report',              'video',   2,    null, null, 7, null);

-- ============ FAIZ — Graphic Designer ============
select seed_task('%faiz%', 'Design banner Shopee HQ & OS',      'design', 16,   null, 48,  1, 'Sasaran harian & bulanan tidak selari — sila sahkan');
select seed_task('%faiz%', 'Draft design Gold Bar 1g',          'draft',  null, null, 9,   2, null);
select seed_task('%faiz%', 'Draft design 1 Dinar',              'draft',  null, null, 9,   3, null);
select seed_task('%faiz%', 'Product listing Shopee HQ & OS',    'design', null, null, 12,  4, null);
select seed_task('%faiz%', 'New product listing photo',         'photo',  15,   null, null, 5, null);
select seed_task('%faiz%', 'Old product listing update',        'photo',  20,   null, null, 6, null);

-- ============ ESYA — Graphic Designer ============
select seed_task('%esya%', 'Design banner & poster brand/search ads', 'design',  null, null, 16, 1, null);
select seed_task('%esya%', 'Draft design Gold Bar 2.5g',              'draft',   null, null, 3,  2, null);
select seed_task('%esya%', 'New product listing',                     'photo',   15,   null, null, 3, null);
select seed_task('%esya%', 'Old product listing update',              'listing', 20,   null, null, 4, null);

-- ============ IRSYAD — Videographer TikTok ============
select seed_task('%irsyad%', 'Shoot content TikTok OS & MY',    'content', null, 14, null, 1, null);
select seed_task('%irsyad%', 'Edit content TikTok OS & MY',     'content', null, 14, null, 2, null);
select seed_task('%irsyad%', 'Update link content TikTok MY',   'content', null, 7,  null, 3, null);
select seed_task('%irsyad%', 'Shoot & edit story IG + TikTok',  'story',   null, null, 12, 4, null);

-- ============ HARITH — Videographer Shopee ============
select seed_task('%harith%', 'Shopee wall video (shoot/edit/update)',       'video', null, 7,  null, 1, null);
select seed_task('%harith%', 'Shopee product catalogue video',              'video', null, 30, null, 2, null);
select seed_task('%harith%', 'Shoot & edit story IG + TikTok',              'story', null, null, 12, 3, null);

-- ============ MEGAT — Graphic Designer ============
select seed_task('%megat%', 'Design banner TikTok',        'design', null, null, 30,  1, null);
select seed_task('%megat%', 'Card printing',               'pcs',    null, null, 500, 2, null);
select seed_task('%megat%', 'Design frame TikTok Live',    'design', null, null, 3,   3, null);
select seed_task('%megat%', 'Design sticker TikTok Live',  'design', null, null, 3,   4, null);
select seed_task('%megat%', 'Draft design 1/2 Dinar',      'draft',  null, null, 3,   5, null);
select seed_task('%megat%', 'New product listing',         'photo',  15,   null, null, 6, null);

drop function if exists seed_task(text, text, text, numeric, numeric, numeric, int, text);

-- ---------------------------------------------------------------- 4) Semak
-- Siapa dapat berapa kerja? Kalau ada nama yang TIADA di sini, bermakna
-- profilnya tidak dijumpai dan kerjanya tidak dimasukkan.
select
  p.full_name,
  p.position_code,
  count(t.id) as bilangan_kerja,
  count(t.target_daily) as ada_sasaran_harian,
  count(t.target_weekly) as ada_sasaran_mingguan,
  count(t.target_monthly) as ada_sasaran_bulanan
from profiles p
left join task_templates t on t.user_id = p.id and t.active = true
where p.active = true and p.role not in ('manager', 'ceo')
group by p.full_name, p.position_code
order by bilangan_kerja desc, p.full_name;
