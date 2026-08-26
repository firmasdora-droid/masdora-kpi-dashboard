# Panduan: Dashboard Tarik Data Recovery CRM Secara Automatik

Maisarah kemas kini rekod dalam CRM seperti biasa → dashboard log masuk
sendiri ke CRM, tarik data, dan papar bilangan dihubungi / berjaya pulih /
tidak berjaya / jumlah RM.

**Tiada apa yang perlu diubah pada sistem CRM.**

---

## Satu langkah sahaja dari kamu

Dashboard perlu tahu kata laluan team CRM supaya ia boleh log masuk sendiri.
Kata laluan itu disimpan di Vercel — ia tidak pernah dihantar ke pelayar
sesiapa, dan tidak kelihatan dalam dashboard.

1. Buka https://vercel.com/dashboard → projek **masdora-kpi-dashboard**
2. **Settings** → **Environment Variables** → **Add New**

   | Ruangan | Isi |
   |---|---|
   | Key | `CRM_TEAM_PASSWORD` |
   | Value | kata laluan team CRM |
   | Environments | tanda **Production**, **Preview**, **Development** |
   | Sensitive | hidupkan |

3. **Save**
4. Tab **Deployments** → deployment paling atas → **⋯** → **Redeploy**

Selesai. Buka halaman **Recovery CRM** — data akan masuk sendiri.

---

## Bagaimana ia berfungsi

```
Maisarah kemas kini CRM
        │
        ▼
masdora.zo.space/team/recovery-crm
        │
        │  dashboard log masuk (POST pw=...) dan baca jadual
        ▼
/api/crm-sync  ──►  jadual recovery_records  ──►  halaman Recovery CRM
                                              └►  Laporan Mingguan PDF
```

Penyegerakan berlaku:

- **Setiap kali sesiapa membuka halaman Recovery CRM** (paling kerap sekali
  setiap 5 minit, supaya CRM tidak dibebani)
- **Bila butang "Tarik Data CRM" ditekan** — segera, tanpa menunggu
- Boleh juga dipanggil oleh automasi luar:
  `GET /api/crm-sync?secret=<INGEST_SECRET>`

### Kenapa ada had 5 minit

Kalau tiga orang membuka halaman itu serentak, tanpa had ini CRM akan
menerima tiga permintaan log masuk sekali gus. Tekan **Tarik Data CRM**
untuk memintas had itu bila kamu perlukan data terkini serta-merta.

---

## Rekod tidak akan jadi dua

Setiap rekod dipadankan melalui `source_id`:

- Kalau jadual CRM ada lajur ID → `crm-<id>`
- Kalau tiada → `crm-<nama><telefon>`

Jadi menarik data 100 kali tetap menghasilkan satu baris bagi setiap
customer — cuma dikemas kini.

---

## Status — tidak perlu ejaan tepat

Dashboard padankan sendiri apa sahaja istilah yang CRM guna:

| Kategori dashboard | Perkataan yang dikenali |
|---|---|
| **Berjaya Pulih** | pulih, recover, berjaya, success, closed won, won, bayar, paid |
| **Tidak Berjaya** | gagal, fail, lost, tolak, reject, tak jadi, batal |
| **Sedang Dihubungi** | proses, hubung, contact, follow, pending, ongoing, progress |
| **Baru** | baru, new, open |

Maisarah tidak perlu mengubah cara dia bekerja.

---

## Lajur dikesan melalui tajuk, bukan kedudukan

| Data | Tajuk lajur yang dikenali |
|---|---|
| ID | ID, NO, BIL, REF |
| Nama | NAMA, NAME, CUSTOMER, PELANGGAN |
| Telefon | PHONE, TELEFON, CONTACT, NOMBOR, WHATSAPP |
| Status | STATUS, KEADAAN |
| Jumlah | AMOUNT, JUMLAH, RM, NILAI, HARGA, VALUE |
| Tarikh | TARIKH, DATE, CONTACTED, DIHUBUNGI, FOLLOW |
| Handler | HANDLER, AGENT, PIC, OLEH, CS |
| Catatan | NOTE, NOTA, CATATAN, REMARK |

Menambah lajur baru atau menyusun semula lajur dalam CRM **tidak akan**
merosakkan penyegerakan.

---

## Kalau data tidak masuk

Buka halaman Recovery CRM — mesejnya akan menyatakan puncanya.

| Mesej | Maksud | Tindakan |
|---|---|---|
| `CRM_TEAM_PASSWORD belum ditetapkan` | Langkah di atas belum dibuat | Tetapkan env var, kemudian Redeploy |
| `Kata laluan CRM ditolak` | Kata laluan salah atau sudah ditukar | Kemas kini nilai di Vercel |
| `Tiada baris data dikenali` | Log masuk berjaya, tetapi jadual berbeza daripada jangkaan | Lihat bawah |
| `CRM membalas HTTP 5xx` | CRM sedang tidak berfungsi | Cuba semula kemudian |

### Kalau "tiada baris data dikenali"

Ini bermakna dashboard berjaya masuk tetapi tidak mengenali bentuk
jadualnya. Sebagai manager, buka pautan ini dalam pelayar (kamu perlu sudah
log masuk ke dashboard):

```
https://masdora-kpi-dashboard.vercel.app/api/crm-sync?debug=1
```

Ia akan memaparkan tajuk lajur sebenar CRM dan 3 baris pertama, **tanpa
menyimpan apa-apa**. Hantar hasil itu kepada saya dan saya laraskan pembaca
supaya padan. Halaman ini terhad kepada Marketing Manager & CEO sahaja.

---

## Nota keselamatan

- Kata laluan CRM disimpan sebagai secret Vercel, dibaca di sebelah pelayan
  sahaja. Ia tidak pernah dihantar ke pelayar dan tidak kelihatan dalam
  mana-mana halaman dashboard.
- Aliran data **satu hala**: CRM → dashboard. Dashboard tidak boleh
  mengubah apa-apa dalam CRM.
- Mod `?debug=1` memaparkan data customer, jadi ia dihadkan kepada
  Marketing Manager & CEO.
