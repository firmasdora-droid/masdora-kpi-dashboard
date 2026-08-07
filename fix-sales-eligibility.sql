-- ==========================================================================
-- FIX PENTING: Key-in Jualan tak simpan untuk team CS
--
-- PUNCA: Bila jawatan CS direstruktur ke 'CS_AGENT', fungsi is_sale_eligible()
-- di database masih hanya benarkan jawatan lama (CS_WEB/CS_SHOPEE/CS_TIKTOK).
-- Jadi RLS policy menolak setiap INSERT ke jadual `sales` daripada team CS —
-- borang nampak berjaya di skrin tapi data tak pernah masuk.
--
-- Cara guna: Supabase SQL Editor -> New query -> tampal -> Run
-- ==========================================================================

create or replace function is_sale_eligible() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    my_position() in ('CS_AGENT', 'CS_WEB', 'CS_SHOPEE', 'CS_TIKTOK', 'VID_PROD'),
    false
  )
$$;

-- Semak: patut pulangkan 'true' untuk mana-mana staff CS/videographer produk
select p.full_name, p.position_code,
  p.position_code in ('CS_AGENT','CS_WEB','CS_SHOPEE','CS_TIKTOK','VID_PROD') as boleh_keyin_jualan
from profiles p
where p.active = true
order by p.position_code;
