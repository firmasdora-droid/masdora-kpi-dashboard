# Panduan: Hidupkan Fungsi Reset Kata Laluan Team

Butang **Reset** sudah ada di *Pengurusan Pengguna*, tetapi ia perlu satu kunci
rahsia sebelum boleh berfungsi. Ikut 2 langkah di bawah — sekali sahaja, lepas
itu ia berfungsi selamanya.

Butang itu akan keluar mesej *"SUPABASE_SERVICE_ROLE_KEY belum ditetapkan"*
sampai langkah ini selesai.

---

## Langkah 1 — Ambil kunci dari Supabase

1. Buka https://supabase.com/dashboard/project/uajmdjiezudaedjotqdl/settings/api-keys
2. Cari bahagian **`service_role`** (BUKAN `anon`).
3. Tekan **Reveal** kemudian **Copy**.

> ⚠️ Kunci `service_role` ini boleh membuka SEMUA data database tanpa had.
> Jangan hantar kepada sesiapa, jangan letak dalam WhatsApp, jangan simpan
> dalam Google Sheet. Ia hanya untuk ditampal di Vercel pada Langkah 2.

---

## Langkah 2 — Tampal di Vercel

1. Buka https://vercel.com/dashboard → pilih projek **masdora-kpi-dashboard**
2. **Settings** → **Environment Variables**
3. Tekan **Add Another** / **Add New** dan isi:

   | Ruangan      | Isi                                       |
   |--------------|-------------------------------------------|
   | Key / Name   | `SUPABASE_SERVICE_ROLE_KEY`               |
   | Value        | *(tampal kunci dari Langkah 1)*           |
   | Environments | tanda **Production**, **Preview**, **Development** |

4. Tekan **Save**.
5. Pergi ke tab **Deployments** → deployment paling atas → menu **⋯** →
   **Redeploy**. (Env var baru hanya aktif selepas redeploy.)

Siap. Tunggu ~1 minit, kemudian butang Reset sudah berfungsi.

---

## Cara guna

1. Sidebar → **Pengurusan Pengguna**
2. Turun ke jadual **Senarai Pengguna**
3. Tekan **Reset** pada baris orang berkenaan
4. Tekan **Ya, Reset** untuk sahkan
5. Kata laluan baru akan keluar — tekan **Salin emel & kata laluan**, hantar
   kepada dia melalui WhatsApp
6. Tekan **Sudah saya hantar**

Dia terus boleh log masuk dengan kata laluan baru itu.

---

## Perkara penting

- **Kata laluan baru dipapar SEKALI sahaja.** Kalau tertutup sebelum disalin,
  tekan Reset semula — tiada masalah, cuma kata laluan baru dijana lagi.
- **Kata laluan lama terus mati** sebaik sahaja reset dibuat. Kalau reset
  tersilap orang, hantar kata laluan baru itu kepadanya.
- **Kata laluan tidak boleh dilihat.** Tiada siapa — termasuk saya atau
  Supabase — boleh melihat kata laluan asal seseorang. Reset adalah satu-satunya
  cara.

## Had keselamatan yang sengaja dipasang

| Siapa   | Boleh reset                        | Tidak boleh reset            |
|---------|------------------------------------|------------------------------|
| Manager | ahli team (member) sahaja          | manager lain, CEO, diri sendiri |
| CEO     | ahli team & manager                | akaun CEO, diri sendiri      |

Sebab manager tidak boleh reset manager lain atau CEO: kalau akaun manager
ditawan orang luar, dia tidak boleh gunakan fungsi ini untuk merampas akaun
yang lebih tinggi.

Untuk tukar kata laluan **sendiri**, guna halaman **Profil Saya** — bukan
butang Reset ini.
