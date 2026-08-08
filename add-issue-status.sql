-- ==========================================================================
-- STATUS ISU PELANGGAN
--
-- Google Sheet kekal sebagai sumber maklumat isu (tarikh, pelanggan, masalah,
-- penyelesaian). Jadual ini pula menyimpan STATUS setiap isu, supaya team
-- boleh tanda "Sedang Diuruskan" / "Selesai" terus dari dashboard tanpa perlu
-- edit Google Sheet.
--
-- Pautan antara dua-dua: source_key = "<NAMA_TAB>-<NOMBOR_BARIS>"
-- (cth "JULAI-3"), jadi ia kekal walaupun sheet dimuat semula.
--
-- Cara guna: Supabase SQL Editor -> New query -> tampal -> Run
-- Selamat di-run berulang kali.
-- ==========================================================================

create table if not exists cs_issue_status (
  source_key  text primary key,
  status      text not null default 'baru',
  updated_by  uuid references profiles(id) on delete set null,
  updated_at  timestamptz not null default now()
);

alter table cs_issue_status enable row level security;

-- Semua staff yang log masuk boleh lihat status
drop policy if exists issue_status_read on cs_issue_status;
create policy issue_status_read on cs_issue_status
  for select using (auth.uid() is not null);

-- Semua staff yang log masuk boleh tanda/kemaskini status
-- (ini kerja operasi harian CS, bukan data sensitif)
drop policy if exists issue_status_insert on cs_issue_status;
create policy issue_status_insert on cs_issue_status
  for insert with check (auth.uid() is not null);

drop policy if exists issue_status_update on cs_issue_status;
create policy issue_status_update on cs_issue_status
  for update using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- Semak
select * from cs_issue_status order by updated_at desc limit 10;
