# Panduan: Sambungkan Recovery CRM ke Dashboard

Matlamat: Maisarah kemas kini rekod dalam CRM → dashboard terus tunjuk
bilangan dihubungi, berjaya pulih, tidak berjaya, dan jumlah RM dipulihkan.
Tiada kerja manual, tiada salin-tampal.

---

## Keadaan sekarang

| Bahagian | Status |
|---|---|
| Dashboard papar data | ✅ Sudah siap |
| Dashboard terima data | ✅ Sudah siap (`/api/ingest/recovery`) |
| Jadual database | ✅ Sudah siap (`recovery_records`) |
| Kunci rahsia di Vercel | ✅ Sudah ada (`INGEST_SECRET`) |
| **CRM hantar data** | ❌ **Belum dibuat — ini satu-satunya yang tinggal** |

Dashboard sudah sedia menunggu. Sistem CRM di `masdora.zo.space` belum
pernah menghantar apa-apa kepadanya. Halaman Recovery CRM dalam dashboard
kosong kerana sebab ini, bukan kerana tiada customer.

---

## Apa yang perlu dibuat pada CRM

Setiap kali rekod dikemas kini (atau sekali setiap 15 minit), CRM perlu
hantar satu permintaan HTTP POST ke:

```
https://masdora-kpi-dashboard.vercel.app/api/ingest/recovery
```

Dengan body JSON seperti ini:

```json
{
  "secret": "<nilai INGEST_SECRET dari Vercel>",
  "rows": [
    {
      "source_id": "rec-1024",
      "customer_name": "Siti",
      "customer_contact": "60123456789",
      "status": "pulih",
      "amount_rm": 250.00,
      "contacted_at": "2026-08-07",
      "handler": "MAI",
      "note": "follow up kedua"
    }
  ]
}
```

### Ruangan

| Ruangan | Wajib | Keterangan |
|---|---|---|
| `source_id` | **Ya** | ID unik rekod dalam CRM. Kalau rekod sama dihantar semula, dashboard **kemas kini** rekod itu — tidak jadi dua. Jadi selamat hantar berulang kali. |
| `status` | Ya | Teks bebas. Dashboard padankan sendiri (lihat bawah). |
| `contacted_at` | Ya | `"2026-08-07"` atau `"7/8/2026"` |
| `amount_rm` | — | Nombor. Kosong dianggap 0. |
| `customer_name` | — | |
| `customer_contact` | — | |
| `handler` | — | Kod handler, contoh `MAI` |
| `note` | — | |

### Status — tidak perlu ikut ejaan tepat

Dashboard padankan status secara automatik kepada 4 kategori:

| Kategori dashboard | Perkataan yang dikenali |
|---|---|
| **Berjaya Pulih** | pulih, recover, berjaya, success, closed won, won, bayar, paid |
| **Tidak Berjaya** | gagal, fail, lost, tolak, reject, tak jadi, batal |
| **Sedang Dihubungi** | proses, hubung, contact, follow, pending, ongoing, progress |
| **Baru** | baru, new, open |

Jadi CRM boleh guna istilahnya sendiri — tidak perlu diubah.

---

## Contoh kod

### Kalau CRM ada bahagian pelayan (Cloudflare Worker / Pages Function)

```js
// Hantar semua rekod recovery ke dashboard.
// Letak INGEST_SECRET sebagai secret pada projek CRM — jangan tulis
// kata rahsia itu terus dalam kod.
async function hantarKeDashboard(env, rekod) {
  const res = await fetch(
    "https://masdora-kpi-dashboard.vercel.app/api/ingest/recovery",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: env.INGEST_SECRET,
        rows: rekod.map((r) => ({
          source_id: String(r.id),
          customer_name: r.nama,
          customer_contact: r.telefon,
          status: r.status,
          amount_rm: r.jumlah,
          contacted_at: r.tarikh_hubung,
          handler: r.handler,
          note: r.nota,
        })),
      }),
    }
  );
  return res.json(); // { ok: true, upserted: N, skipped: M }
}
```

### Jalankan automatik setiap 15 minit (Cloudflare Worker cron)

Dalam `wrangler.toml`:

```toml
[triggers]
crons = ["*/15 * * * *"]
```

Dalam worker:

```js
export default {
  async scheduled(event, env) {
    const { results } = await env.DB.prepare(
      "SELECT * FROM recovery_records"
    ).all();
    await hantarKeDashboard(env, results);
  },
};
```

---

## Cara uji tanpa menyentuh CRM

Ini membuktikan saluran itu berfungsi sebelum sesiapa mengubah CRM.
Ganti `<SECRET>` dengan nilai `INGEST_SECRET` dari Vercel
(Settings → Environment Variables).

```bash
curl -X POST https://masdora-kpi-dashboard.vercel.app/api/ingest/recovery -H "Content-Type: application/json" -d '{"secret":"<SECRET>","rows":[{"source_id":"UJIAN-001","customer_name":"UJIAN - boleh padam","status":"proses","amount_rm":1,"contacted_at":"2026-08-25","handler":"MAI","note":"rekod ujian"}]}'
```

Jangkaan: `{"ok":true,"upserted":1,"skipped":0}`

Kemudian buka halaman **Recovery CRM** dalam dashboard — rekod "UJIAN"
sepatutnya keluar. Selepas itu buang rekod ujian itu dalam Supabase:

```sql
delete from recovery_records where source_id = 'UJIAN-001';
```

### Kalau ujian gagal

| Balasan | Maksud | Tindakan |
|---|---|---|
| `401 Unauthorized` | Secret tidak sama | Semak nilai `INGEST_SECRET` di Vercel |
| `500 Server belum dikonfigurasi` | `INGEST_SECRET` tiada di Vercel | Tambah env var itu, kemudian Redeploy |
| `500 Gagal menyimpan rekod` | `SUPABASE_SERVICE_ROLE_KEY` salah, atau jadual tiada | Run `add-recovery-crm.sql` di Supabase |
| `400 Medan 'rows' mesti array` | Bentuk JSON salah | `rows` mesti array, walaupun satu rekod |

---

## Siapa boleh buat kerja ini

Sesiapa yang boleh mengubah kod sistem CRM di `masdora.zo.space`. Ia kerja
sekali sahaja — kira-kira 20 baris kod.

Kata rahsia `INGEST_SECRET` perlu dimasukkan sebagai **secret pada projek
CRM**, bukan ditulis dalam kod dan bukan dihantar melalui WhatsApp.

---

## Nota penting

- **Selamat hantar berulang kali.** Rekod dipadankan melalui `source_id`,
  jadi menghantar rekod yang sama 100 kali tetap menghasilkan satu baris.
- **Dashboard tidak menolak data ke CRM.** Alirannya satu hala sahaja:
  CRM → dashboard. Mengubah data dalam dashboard tidak mengubah CRM.
- **Laporan Mingguan PDF** sudah ada seksyen Recovery CRM. Sebaik data
  masuk, ia terus keluar dalam laporan kepada CEO tanpa kerja tambahan.
