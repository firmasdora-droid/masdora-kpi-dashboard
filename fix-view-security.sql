-- ==========================================================================
-- PENTING: TUTUP KEBOCORAN DATA
--
-- MASALAH:
--   Beberapa "view" (v_week_summary, v_sales_rank_daily, v_sales_leaderboard,
--   dll) boleh dibaca oleh sesiapa TANPA LOG MASUK.
--
--   Sebabnya: view dijalankan dengan keizinan PEMILIK view (postgres), jadi
--   ia memintas Row Level Security pada jadual asal. Supabase pula memberi
--   kebenaran SELECT kepada peranan "anon" (pelawat tanpa log masuk) secara
--   lalai untuk semua objek dalam skema public.
--
--   Kunci "anon" ada di dalam kod laman web (memang direka begitu), jadi
--   sesiapa boleh mengambilnya dan membaca data jualan & prestasi team.
--
-- PENYELESAIAN:
--   Tarik balik kebenaran daripada "anon". Pengguna yang sudah log masuk
--   (peranan "authenticated") kekal boleh membaca seperti biasa.
--
-- Cara guna: Supabase SQL Editor -> New query -> tampal -> Run
-- Selamat di-run berulang kali.
-- ==========================================================================

-- Tarik balik akses tanpa log masuk daripada SEMUA view dalam skema public
do $$
declare
  v record;
begin
  for v in
    select table_name
    from information_schema.views
    where table_schema = 'public'
  loop
    execute format('revoke all on public.%I from anon', v.table_name);
    execute format('grant select on public.%I to authenticated', v.table_name);
  end loop;
end $$;

-- Halang view baharu daripada terdedah secara automatik pada masa depan
alter default privileges in schema public revoke all on tables from anon;

-- ==========================================================================
-- SEMAKAN — senarai view dan siapa boleh baca.
-- Selepas Run, ruangan "anon_boleh_baca" mesti FALSE untuk semua baris.
-- ==========================================================================
select
  c.relname as view_name,
  has_table_privilege('anon', c.oid, 'SELECT')          as anon_boleh_baca,
  has_table_privilege('authenticated', c.oid, 'SELECT') as ahli_boleh_baca
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'v'
order by c.relname;
