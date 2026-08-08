# Cara sambungkan Recovery CRM ke Dashboard

Dashboard sudah sedia menerima data. Yang tinggal ialah **sistem Recovery CRM
(masdora.zo.space) perlu hantar data** ke dashboard.

---

## Untuk anda (Firdaus) — 1 langkah

Run fail `add-recovery-crm.sql` di Supabase SQL Editor (New query → tampal → Run).
Itu sahaja. Selepas itu halaman "Recovery CRM" dalam dashboard akan berfungsi.

---

## Untuk sistem CRM — arahan teknikal

Berikan arahan di bawah kepada sesiapa (atau AI builder) yang uruskan
masdora.zo.space.

### Apa yang perlu dibuat

Setiap kali rekod recovery dicipta atau dikemas kini, hantar HTTP POST ke:

```
https://masdora-kpi-dashboard.vercel.app/api/ingest/recovery
```

**Header:** `Content-Type: application/json`

**Body:**

```json
{
  "secret": "96ec6d03610a4915739f9e450670ffa5544274846c150d06",
  "rows": [
    {
      "source_id": "rec-1024",
      "customer_name": "Siti Aminah",
      "customer_contact": "60123456789",
      "status": "pulih",
      "amount_rm": 250.00,
      "contacted_at": "2026-08-07",
      "handler": "MAI",
      "note": "follow up kedua, customer setuju beli semula"
    }
  ]
}
```

### Penjelasan medan

| Medan | Wajib? | Keterangan |
|---|---|---|
| `source_id` | **Ya** | ID unik rekod dalam CRM. Kalau rekod sama dihantar semula, ia dikemas kini (tidak jadi dua). |
| `customer_name` | Tidak | Nama pelanggan |
| `customer_contact` | Tidak | Nombor telefon / emel |
| `status` | Tidak | Status bebas — lihat pemetaan di bawah |
| `amount_rm` | Tidak | Nilai jualan yang dipulihkan (nombor sahaja, tanpa "RM") |
| `contacted_at` | Tidak | `YYYY-MM-DD` atau `D/M/YYYY` |
| `handler` | Tidak | `MAI` untuk Maisarah |
| `note` | Tidak | Catatan bebas |

### Pemetaan status

Taip apa-apa perkataan — dashboard akan faham:

| Perkataan | Dipaparkan sebagai |
|---|---|
| `pulih`, `recover`, `berjaya`, `paid`, `won` | ✅ Berjaya Pulih |
| `proses`, `hubung`, `follow`, `pending` | ⏳ Sedang Dihubungi |
| `gagal`, `fail`, `lost`, `batal` | ❌ Tidak Berjaya |
| `baru`, `new`, `open` | 🆕 Baru |

### Nota penting

- **Boleh hantar berulang kali** dengan `source_id` yang sama — rekod akan
  dikemas kini, bukan diduplikasi. Jadi selamat untuk hantar semula
  keseluruhan senarai bila-bila masa.
- **Boleh hantar banyak rekod sekali gus** — masukkan beberapa objek dalam
  array `rows` (cadangan: maksimum 200 setiap hantaran).
- Jika `secret` salah, server balas `401 Unauthorized`.
- Jika berjaya, server balas `{ "ok": true, "upserted": N }`.

### Contoh kod (JavaScript)

```js
await fetch("https://masdora-kpi-dashboard.vercel.app/api/ingest/recovery", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    secret: "96ec6d03610a4915739f9e450670ffa5544274846c150d06",
    rows: [
      {
        source_id: record.id,
        customer_name: record.name,
        customer_contact: record.phone,
        status: record.status,
        amount_rm: record.recoveredAmount,
        contacted_at: record.contactedDate,
        handler: "MAI",
        note: record.notes,
      },
    ],
  }),
});
```

### Contoh arahan untuk AI builder

Jika masdora.zo.space dibina guna AI website builder, salin dan tampal
arahan ini:

> Setiap kali rekod dalam Recovery CRM disimpan atau dikemas kini, hantar
> HTTP POST ke `https://masdora-kpi-dashboard.vercel.app/api/ingest/recovery`
> dengan header `Content-Type: application/json` dan body JSON:
> `{ "secret": "96ec6d03610a4915739f9e450670ffa5544274846c150d06", "rows": [ { "source_id": "<id unik rekod>", "customer_name": "<nama>", "customer_contact": "<telefon>", "status": "<status>", "amount_rm": <nombor>, "contacted_at": "<YYYY-MM-DD>", "handler": "MAI", "note": "<catatan>" } ] }`
> Hantar juga keseluruhan senarai sekali sehari sebagai sandaran (guna
> `source_id` yang sama supaya tidak berlaku pertindihan).

---

## Rahsia (jangan kongsi awam)

`96ec6d03610a4915739f9e450670ffa5544274846c150d06`

Rahsia ini sama seperti yang digunakan untuk sync Google Sheet/Doc.
Jika perlu ditukar, kemas kini `INGEST_SECRET` dalam Vercel dan semua
skrip yang menggunakannya.
