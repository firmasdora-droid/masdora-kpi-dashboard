-- ==========================================================================
-- BENARKAN STAFF PADAM REKOD JUALAN SENDIRI
--
-- Sebelum ini: hanya Manager boleh padam rekod jualan. Jadi bila staff
-- tersalah key-in (cth rekod bertindih / silap jumlah), mereka terpaksa
-- tunggu manager untuk betulkan.
--
-- Selepas ini:
--   - Staff boleh padam rekod JUALAN MEREKA SENDIRI sahaja
--   - Manager kekal boleh padam mana-mana rekod
--   - Staff TETAP tidak boleh padam rekod orang lain
--
-- Cara guna: Supabase SQL Editor -> New query -> tampal -> Run
-- Selamat di-run berulang kali.
-- ==========================================================================

drop policy if exists sale_delete on sales;

create policy sale_delete on sales for delete using (
  my_role() = 'manager' or user_id = auth.uid()
);

-- Semak polisi yang aktif untuk jadual sales
select policyname, cmd, qual
from pg_policies
where tablename = 'sales'
order by policyname;
