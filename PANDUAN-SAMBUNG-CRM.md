# Panduan: Dashboard Tarik Data CRM Secara Automatik

CRM: **https://masdora-crm-masdora.zocomputer.io**

Maisarah kemas kini rekod dalam CRM seperti biasa → dashboard log masuk
sendiri, tarik data, dan papar bilangan dihubungi / berjaya pulih / tidak
berjaya / jumlah RM.

**Tiada apa yang perlu diubah pada sistem CRM.**

---

## Langkah dari kamu (sekali sahaja)

CRM ini menggunakan **akaun individu** (emel + kata laluan), bukan satu kata
laluan kongsi seperti CRM lama. Jadi dashboard perlu akaunnya sendiri.

### 1. Buat akaun CRM untuk dashboard

Dalam CRM, cipta satu akaun khas — contohnya:

```
dashboard@masdora.com
```

Gunakan akaun berasingan, **bukan akaun Maisarah**. Sebabnya:
- Kalau Maisarah tukar kata laluan, penyegerakan tidak terhenti
- Log CRM menunjukkan dengan jelas mana capaian dashboard dan mana capaian manusia
- Akaun itu boleh dimatikan tanpa menjejaskan sesiapa

Akaun itu perlu keizinan **membaca** sahaja — dashboard tidak pernah menulis
ke CRM.

### 2. Masukkan akaun itu di Vercel

1. https://vercel.com/dashboard → projek **masdora-kpi-dashboard**
2. **Settings** → **Environment Variables** → **Add New**

   | Key | Value |
   |---|---|
   | `CRM_EMAIL` | emel akaun dashboard |
   | `CRM_PASSWORD` | kata laluan akaun itu |

   Environments: tandakan **Production** dan **Preview**.

3. **Save**
4. **Deployments** → deployment paling atas → **⋯** → **Redeploy**

Selesai. Buka halaman **Recovery CRM** — data akan masuk sendiri.

---

## Bagaimana ia berfungsi

```
Maisarah kemas kini CRM
        │
        ▼
masdora-crm-masdora.zocomputer.io
        │
        │  dashboard POST /api/auth/login, simpan cookie sesi, baca data
        ▼
/api/crm-sync  ──►  jadual recovery_records  ──►  halaman Recovery CRM
                                              ├►  Laporan PDF
                                              └►  Jualan pulih -> jualan Maisarah
```

Penyegerakan berlaku:

- **Setiap kali sesiapa membuka halaman Recovery CRM** (paling kerap sekali
  setiap 5 minit, supaya CRM tidak dibebani)
- **Bila butang "Tarik Data CRM" ditekan** — segera
- Boleh juga dipanggil oleh automasi luar:
  `GET /api/crm-sync?secret=<INGEST_SECRET>`

---

## Rekod tidak akan jadi dua

Setiap rekod dipadankan melalui `source_id` yang stabil (nombor pesanan).
Menarik data 100 kali tetap menghasilkan satu baris bagi setiap customer.

---

## Status — tidak perlu ejaan tepat

| Kategori dashboard | Perkataan yang dikenali |
|---|---|
| **Berjaya Pulih** | paid, recover, won, pulih, berjaya, bayar, success |
| **Tidak Berjaya** | void, refund, cancel, lost, gagal, tolak, batal |
| **Sedang Dihubungi** | contact, hubung, follow, progress, ongoing, proses |
| **Baru** | abandon, expire, unpaid, pending, open, new, baru |

---

## Kalau data tidak masuk

Buka halaman Recovery CRM dan tekan **Periksa**. Panel itu memaparkan apa
yang CRM sebenarnya balas.

| Mesej | Maksud | Tindakan |
|---|---|---|
| `CRM_EMAIL dan CRM_PASSWORD belum ditetapkan` | Langkah 2 belum dibuat | Tetapkan env var, kemudian Redeploy |
| Log masuk gagal | Emel/kata laluan salah, atau akaun dinyahaktifkan | Semak akaun itu boleh log masuk sendiri di CRM |
| `Tiada baris data dikenali` | Log masuk berjaya, tetapi bentuk data berbeza | Hantar tangkapan skrin panel Periksa |

Panel Periksa terhad kepada Marketing Manager & CEO kerana ia memaparkan
data customer.

---

## Nota keselamatan

- Akaun CRM disimpan sebagai env var Vercel, dibaca di sebelah pelayan
  sahaja. Ia tidak pernah dihantar ke pelayar dan tidak kelihatan dalam
  mana-mana halaman dashboard.
- Aliran data **satu hala**: CRM → dashboard. Dashboard tidak boleh
  mengubah apa-apa dalam CRM.
