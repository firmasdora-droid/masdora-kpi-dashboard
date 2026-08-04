# Masdora KPI Dashboard

Dashboard KPI, To-Do mingguan, Leaderboard, Key-in Jualan, Kempen & Admin untuk
pasukan marketing Masdora. Dibina dengan Next.js 14 (App Router), TypeScript,
Tailwind CSS, dan Supabase (@supabase/ssr + @supabase/supabase-js).

## Menjalankan secara tempatan

```bash
npm install
npm run dev
```

Buka http://localhost:3000. Pastikan fail `.env.local` mengandungi:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

(kedua-dua nilai ini sudah disediakan dalam projek ini, sepadan dengan
projek Supabase yang sedia wujud).

## Langkah manual sekali sahaja: bootstrap akaun manager pertama

Skema database ini menggunakan Row Level Security — akaun pertama yang
mendaftar akan menjadi `member` secara lalai (tiada siapa boleh jadi
`manager` melalui UI kerana ia memerlukan seorang manager untuk menjemput
ahli lain). Untuk memulakan:

1. Daftar akaun pertama anda melalui Supabase (guna Supabase Dashboard ->
   Authentication -> Add user, ATAU insert baris ke `pending_invites` terus
   melalui SQL Editor dengan `role = 'manager'`, kemudian gunakan skrin
   "Kali pertama log masuk" di aplikasi ini untuk melengkapkan pendaftaran).
2. Selepas akaun & profil dicipta, buka Supabase Dashboard -> Table Editor ->
   jadual `profiles` -> cari baris pengguna tersebut -> tukar kolum `role`
   kepada `manager` secara manual.
3. Log keluar & log masuk semula. Anda kini mempunyai akses penuh Manager,
   termasuk ruangan Admin untuk menjemput ahli-ahli lain.

## Deploy ke Vercel

1. Import repo ini ke Vercel (https://vercel.com/new).
2. Dalam tetapan Environment Variables projek Vercel, tambah:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy. Vercel akan menjalankan `npm run build` secara automatik.

## Struktur ringkas

- `lib/supabase/` — client Supabase untuk browser, server component, dan
  middleware (refresh sesi auth).
- `lib/period.ts` — helper tahun/bulan/minggu semasa.
- `lib/roles.ts` — jenis peranan & helper kelayakan key-in jualan.
- `types/database.ts` — jenis TypeScript untuk setiap jadual & view mengikut
  skema SQL sumber tunggal (`schema-untuk-supabase.sql`).
- `app/dashboard/` — semua laman utama (Ringkasan, KPI, To-Do, Leaderboard,
  Jualan, Kempen, Admin).
- Semua kawalan akses sebenar dikuatkuasakan oleh Row Level Security di
  Supabase — UI hanya menyembunyikan pautan/butang yang tidak relevan.

## Nota

- Tiada backend/API berasingan — semua data dibaca/ditulis terus ke Supabase
  dari client & server component Next.js.
- Tiada perpustakaan komponen UI luaran digunakan — hanya Tailwind CSS.
