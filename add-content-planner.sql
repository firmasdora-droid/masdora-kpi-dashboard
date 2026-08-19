-- ==========================================================================
-- CONTENT PLANNER — perancangan konten untuk Content Creator & Videographer
--
-- Cara guna: Supabase SQL Editor -> New query -> tampal SEMUA -> Run
-- Selamat di-run berulang kali (tiada kesan kalau sudah ada).
-- ==========================================================================

create table if not exists content_plans (
  id          bigserial primary key,
  -- Pemilik rancangan. Setiap orang urus rancangan sendiri.
  user_id     uuid not null references profiles (id) on delete cascade,
  title       text not null,
  -- Tarikh & masa siaran dirancang. Masa boleh kosong kalau belum ditetapkan.
  post_date   date not null,
  post_time   time,
  -- Akaun tempat siaran: TIKTOK OS / TIKTOK MY / INSTAGRAM /
  -- SHOPEE HQ / SHOPEE OS. Disimpan sebagai teks (bukan enum) supaya
  -- akaun baru boleh ditambah kemudian tanpa mengubah database.
  account     text not null,
  status      text not null default 'dirancang',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_content_plans_date
  on content_plans (post_date);
create index if not exists idx_content_plans_user
  on content_plans (user_id, post_date);

-- Kemas kini updated_at secara automatik setiap kali baris diubah.
create or replace function touch_content_plans()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_content_plans on content_plans;
create trigger trg_touch_content_plans
  before update on content_plans
  for each row execute function touch_content_plans();

-- ---------------------------------------------------------------- keselamatan
alter table content_plans enable row level security;

-- BACA: semua staff yang log masuk boleh lihat rancangan konten pasukan,
-- supaya tiada dua orang tersilap siar pada slot yang sama.
drop policy if exists cp_read on content_plans;
create policy cp_read on content_plans
  for select using (auth.uid() is not null);

-- TAMBAH: hanya untuk diri sendiri (atau manager bagi pihak team).
drop policy if exists cp_insert on content_plans;
create policy cp_insert on content_plans
  for insert with check (
    my_role() = 'manager' or user_id = auth.uid()
  );

-- UBAH: hanya rancangan sendiri (atau manager).
drop policy if exists cp_update on content_plans;
create policy cp_update on content_plans
  for update using (
    my_role() = 'manager' or user_id = auth.uid()
  );

-- PADAM: hanya rancangan sendiri (atau manager).
drop policy if exists cp_delete on content_plans;
create policy cp_delete on content_plans
  for delete using (
    my_role() = 'manager' or user_id = auth.uid()
  );

-- ---------------------------------------------------------------- semak
select
  'SIAP' as peringkat,
  count(*) as jumlah_rancangan
from content_plans;

select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'content_plans'
order by cmd;
