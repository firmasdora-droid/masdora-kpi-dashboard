-- ==========================================================================
-- LAPORAN WHATSAPP — mesej dari group WhatsApp team
--
-- Bridge WhatsApp yang berjalan di komputer akan hantar (webhook) setiap
-- mesej group ke dashboard, dan mesej itu disimpan di sini.
--
-- Cara guna: Supabase SQL Editor -> New query -> tampal -> Run
-- Selamat di-run berulang kali.
-- ==========================================================================

create table if not exists whatsapp_messages (
  id           bigserial primary key,
  -- ID unik mesej dari WhatsApp. Kalau mesej sama dihantar semula,
  -- ia dikemas kini (bukan jadi dua).
  message_id   text unique not null,
  chat_id      text not null,
  chat_name    text,
  sender_name  text,
  sender_id    text,
  body         text,
  sent_at      timestamptz,
  is_group     boolean not null default true,
  received_at  timestamptz not null default now()
);

create index if not exists idx_wa_sent_at on whatsapp_messages (sent_at desc);
create index if not exists idx_wa_chat on whatsapp_messages (chat_id);

alter table whatsapp_messages enable row level security;

-- Semua staff yang log masuk boleh baca.
-- Penulisan hanya melalui API dashboard (service-role key, memintas RLS).
drop policy if exists wa_read on whatsapp_messages;
create policy wa_read on whatsapp_messages
  for select using (auth.uid() is not null);

-- Semak
select count(*) as jumlah_mesej from whatsapp_messages;
