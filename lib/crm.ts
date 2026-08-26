/**
 * Menarik data terus dari Masdora Recovery CRM (masdora.zo.space).
 *
 * CRM itu dilindungi oleh SATU kata laluan team yang dikongsi. Kata laluan
 * itu disimpan sebagai env var di Vercel (CRM_TEAM_PASSWORD) dan hanya
 * digunakan di sebelah pelayan — ia tidak pernah dihantar ke pelayar.
 *
 * Aliran:
 *   1. POST pw=<kata laluan> ke halaman CRM
 *   2. Simpan cookie sesi, ambil halaman dashboard
 *   3. Baca jadual HTML (atau JSON terbenam) menjadi rekod
 *
 * Kenapa membaca HTML dan bukan API: CRM itu tiada API. Borangnya
 * menghantar `pw` terus ke URL yang sama. Jadi kita meniru apa yang
 * pelayar buat.
 */

export const CRM_URL = "https://masdora.zo.space/team/recovery-crm";

/**
 * Status & catatan yang ditetapkan oleh pasukan (Open / Contacted /
 * Recovered / Lost) disimpan berasingan daripada data Shopify.
 *
 * Kod CRM sendiri menjelaskannya: "When hosted on Zo (or any server
 * exposing /api/masdora-status), statuses & notes are shared across the
 * whole team."
 */
export const CRM_STATUS_URL = "https://masdora.zo.space/api/masdora-status";

export interface CrmRow {
  source_id: string;
  customer_name: string | null;
  customer_contact: string | null;
  status: string | null;
  amount_rm: number;
  contacted_at: string | null;
  handler: string | null;
  note: string | null;
  /** Band keutamaan CRM (H / M / L). */
  priority?: string | null;
  /** Umur kes, contoh "2d". */
  age?: string | null;
}

export interface CrmDebug {
  /** Tajuk lajur yang dijumpai dalam jadual CRM. */
  headers: string[];
  /** Berapa baris jadual dijumpai. */
  rowCount: number;
  /** Bilangan jadual dalam halaman. */
  tableCount: number;
  /** Adakah data berbentuk JSON terbenam dan bukan jadual. */
  jsonEmbedded: boolean;
  /** Cebisan JSON pertama yang dijumpai, kalau data bukan dalam jadual. */
  jsonCebisan: string | null;
  /**
   * Cebisan di sekeliling perkataan status CRM (contacted/recovered/lost).
   * Status yang Maisarah tetapkan disimpan berasingan daripada data
   * Shopify — ini membantu mencarinya.
   */
  statusCebisan: string[];
  /**
   * URL yang dipanggil oleh JavaScript halaman. Kalau status diambil dari
   * endpoint berasingan, ia akan kelihatan di sini.
   */
  endpoints: string[];
  /**
   * Kod di sekeliling panggilan ke endpoint status — menunjukkan kaedah,
   * header dan bentuk badan yang digunakan oleh CRM sendiri.
   */
  panggilanStatus: string[];
  /** 3 baris pertama, mentah — untuk menyelaraskan pembaca. */
  sample: string[][];
}

/** Buang tag HTML dan nyahkod entiti asas. */
function teks(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, " ")
    .trim();
}

/** Cari semua <table> dan pulangkan yang paling banyak baris. */
function jadualTerbesar(html: string): string | null {
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  if (tables.length === 0) return null;
  return tables.reduce((a, b) =>
    (b.match(/<tr[\s>]/gi) ?? []).length > (a.match(/<tr[\s>]/gi) ?? []).length
      ? b
      : a
  );
}

function baris(tableHtml: string): string[][] {
  const trs = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  return trs.map((tr) => {
    const cells = tr.match(/<t[hd][\s\S]*?<\/t[hd]>/gi) ?? [];
    return cells.map(teks);
  });
}

/** Cari index lajur pertama yang tajuknya mengandungi salah satu kata kunci. */
function cariLajur(headers: string[], kunci: string[]): number {
  for (const k of kunci) {
    for (let i = 0; i < headers.length; i++) {
      if (headers[i].toUpperCase().includes(k)) return i;
    }
  }
  return -1;
}

function nombor(s: string): number {
  const n = Number(s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** "7/8/2026" atau "2026-08-07" atau "07 Aug 2026" -> ISO. */
function tarikh(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);

  const dmy = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (dmy) {
    let y = Number(dmy[3]);
    if (y < 100) y += 2000;
    const p = (n: number) => String(n).padStart(2, "0");
    return `${y}-${p(Number(dmy[2]))}-${p(Number(dmy[1]))}`;
  }

  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * Log masuk ke CRM dan pulangkan HTML dashboard.
 * Melontar ralat dengan mesej yang boleh difahami kalau gagal.
 */
/** Jejak apa yang berlaku semasa log masuk — untuk mod pemeriksaan. */
export interface JejakLogMasuk {
  statusPost: number;
  adaCookie: boolean;
  ikutPengalihan: string | null;
  statusAkhir: number;
  panjangHtml: number;
  masihBorangLogMasuk: boolean;
  /** Cebisan teks halaman, untuk melihat apa yang sebenarnya dibalas. */
  cebisan: string;
}

export interface HasilCrm {
  html: string;
  jejak: JejakLogMasuk;
  berjaya: boolean;
  /** Cookie sesi — diguna semula untuk mengambil status pasukan. */
  cookie: string;
}

export interface StatusPasukan {
  status: string | null;
  note: string | null;
}

/** Ambil semua nilai Set-Cookie dan gabungkan menjadi satu header Cookie. */
function kutipCookie(res: Response): string {
  const h = res.headers as Headers & { getSetCookie?: () => string[] };
  const senarai =
    typeof h.getSetCookie === "function"
      ? h.getSetCookie()
      : [res.headers.get("set-cookie") ?? ""].filter(Boolean);

  return senarai
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

/** Adakah HTML ini masih halaman log masuk? */
function borangLogMasuk(html: string): boolean {
  return /<input[^>]*name=["']?pw["']?/i.test(html);
}

/**
 * Log masuk ke CRM dan pulangkan HTML dashboard.
 *
 * CRM menetapkan cookie sesi selepas kata laluan diterima. `fetch` di
 * pelayan TIDAK menyimpan cookie secara automatik, jadi kalau kita biarkan
 * ia mengikut pengalihan, permintaan kedua pergi tanpa cookie dan CRM
 * memulangkan borang log masuk semula — nampak seperti kata laluan salah
 * sedangkan ia betul. Sebab itu pengalihan dikendalikan secara manual di
 * sini, dengan cookie dibawa bersama.
 */
export async function ambilHalamanCrm(kataLaluan: string): Promise<HasilCrm> {
  const kepala = {
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent":
      "Mozilla/5.0 (compatible; MasdoraDashboard/1.0; +https://masdora-kpi-dashboard.vercel.app)",
    Accept: "text/html,application/xhtml+xml",
  };

  const post = await fetch(CRM_URL, {
    method: "POST",
    headers: kepala,
    body: new URLSearchParams({ pw: kataLaluan }).toString(),
    redirect: "manual", // jangan ikut sendiri — cookie perlu dibawa
    cache: "no-store",
  });

  const cookie = kutipCookie(post);
  const lokasi = post.headers.get("location");

  let html = "";
  let statusAkhir = post.status;

  // 3xx: ikut pengalihan sambil membawa cookie sesi.
  if (post.status >= 300 && post.status < 400) {
    const url = lokasi
      ? new URL(lokasi, CRM_URL).toString()
      : CRM_URL;
    const ikut = await fetch(url, {
      headers: { ...kepala, Cookie: cookie },
      cache: "no-store",
    });
    statusAkhir = ikut.status;
    html = await ikut.text();
  } else {
    html = await post.text();

    // Ada laman membalas 200 dengan borang log masuk semula walaupun
    // kata laluan betul, dan hanya memberi data pada permintaan GET
    // berikutnya. Kalau ada cookie, cuba sekali lagi dengannya.
    if (cookie && borangLogMasuk(html)) {
      const semula = await fetch(CRM_URL, {
        headers: { ...kepala, Cookie: cookie },
        cache: "no-store",
      });
      statusAkhir = semula.status;
      html = await semula.text();
    }
  }

  const masihBorang = borangLogMasuk(html);

  // CRM membalas 401 khusus untuk kata laluan salah (disahkan dengan
  // menghantar kata laluan palsu). Jadi status itu — bukan kehadiran borang
  // — yang menentukan sama ada log masuk ditolak. Halaman yang sudah log
  // masuk mungkin masih mengandungi medan `pw` (contohnya borang tukar kata
  // laluan), dan menganggapnya sebagai penolakan adalah silap.
  const ditolak = post.status === 401 || post.status === 403;

  return {
    html,
    cookie,
    berjaya: !ditolak,
    jejak: {
      statusPost: post.status,
      adaCookie: cookie.length > 0,
      ikutPengalihan: lokasi,
      statusAkhir,
      panjangHtml: html.length,
      masihBorangLogMasuk: masihBorang,
      cebisan: html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 600),
    },
  };
}

/** Buang segala kecuali digit — untuk memadankan ID dari sumber berbeza. */
function kunciId(v: unknown): string {
  const s = String(v ?? "");
  const digit = s.match(/(\d{4,})/g);
  return digit ? digit[digit.length - 1] : "";
}

/**
 * Ambil status & catatan yang ditetapkan pasukan dari /api/masdora-status.
 *
 * Bentuk balasan tidak dijamin, jadi tiga bentuk lazim diterima:
 *   { "<id>": { status, note } }
 *   { overrides: { "<id>": { status, note } } }
 *   [ { id, status, note } ]
 *
 * Kunci dinormalkan kepada digit sahaja, kerana CRM mungkin menggunakan
 * gid Shopify penuh manakala rekod kita menyimpan nombor sahaja.
 */
/**
 * Ambil alamat & token penyegerakan yang tertanam dalam halaman CRM.
 *
 * CRM menyimpannya sebagai pemboleh ubah JavaScript:
 *   var SYNC_URL   = "https://masdora.zo.space/api/masdora-status";
 *   var SYNC_TOKEN = "masdora-...";
 *
 * Membacanya dari halaman lebih baik daripada menyimpan salinan sendiri:
 * kalau CRM menukar tokennya, penyegerakan terus ikut tanpa perlu
 * mengubah apa-apa di sini atau di Vercel.
 */
export function cariTetapanSync(html: string): {
  url: string;
  token: string | null;
} {
  const url =
    html.match(/SYNC_URL\s*=\s*["']([^"']+)["']/)?.[1] ?? CRM_STATUS_URL;
  const token = html.match(/SYNC_TOKEN\s*=\s*["']([^"']+)["']/)?.[1] ?? null;
  return { url, token };
}

/**
 * Endpoint status memerlukan token, bukan cookie sesi — ia membalas
 * 401 Unauthorized kepada cookie sahaja. Cara token itu dihantar tidak
 * dinyatakan dalam kod yang dapat dibaca, jadi beberapa kedudukan lazim
 * dicuba sampai satu berjaya.
 */
function calonPermintaan(
  url: string,
  token: string,
  cookie: string
): { url: string; init: RequestInit }[] {
  const asas = {
    Accept: "application/json",
    "User-Agent": "Mozilla/5.0 (compatible; MasdoraDashboard/1.0)",
    Cookie: cookie,
  };
  const pisah = url.includes("?") ? "&" : "?";

  return [
    { url, init: { headers: { ...asas, Authorization: `Bearer ${token}` } } },
    { url, init: { headers: { ...asas, "X-Sync-Token": token } } },
    { url, init: { headers: { ...asas, "X-Token": token } } },
    { url, init: { headers: { ...asas, "X-Masdora-Token": token } } },
    { url: `${url}${pisah}token=${encodeURIComponent(token)}`, init: { headers: asas } },
  ];
}

export async function ambilStatusPasukan(
  cookie: string,
  html?: string
): Promise<Map<string, StatusPasukan>> {
  const peta = new Map<string, StatusPasukan>();
  const { url, token } = html
    ? cariTetapanSync(html)
    : { url: CRM_STATUS_URL, token: null };

  // Tanpa token, cookie sahaja pasti ditolak — tetapi tetap dicuba supaya
  // ia berfungsi kalau CRM mengubah kaedahnya kemudian.
  const calon = token
    ? calonPermintaan(url, token, cookie)
    : [{ url, init: { headers: { Cookie: cookie, Accept: "application/json" } } }];

  let data: unknown = null;

  for (const c of calon) {
    try {
      const res = await fetch(c.url, { ...c.init, cache: "no-store" });
      if (!res.ok) continue;
      data = await res.json();
      break;
    } catch {
      continue;
    }
  }

  if (data === null) return peta;

  const simpan = (id: unknown, nilai: unknown) => {
    const k = kunciId(id);
    if (!k || typeof nilai !== "object" || nilai === null) return;
    const v = nilai as { status?: unknown; note?: unknown };
    peta.set(k, {
      status: v.status ? String(v.status) : null,
      note: v.note ? String(v.note) : null,
    });
  };

  if (Array.isArray(data)) {
    data.forEach((row) => {
      const r = row as { id?: unknown; status?: unknown; note?: unknown };
      simpan(r?.id, r);
    });
  } else if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    const isi =
      (obj.overrides as Record<string, unknown> | undefined) ??
      (obj.statuses as Record<string, unknown> | undefined) ??
      obj;
    Object.entries(isi).forEach(([k, v]) => simpan(k, v));
  }

  return peta;
}

/**
 * Gabungkan status pasukan ke dalam rekod.
 *
 * Status CRM mengatasi status Shopify, kerana itulah keputusan sebenar
 * yang dibuat oleh Maisarah. Status Shopify dikekalkan sebagai sandaran
 * bagi kes yang belum disentuh sesiapa.
 */
export function gabungStatus(
  rekod: CrmRow[],
  peta: Map<string, StatusPasukan>
): CrmRow[] {
  if (peta.size === 0) return rekod;

  return rekod.map((r) => {
    const s = peta.get(kunciId(r.source_id));
    if (!s) return r;
    return {
      ...r,
      status: s.status ?? r.status,
      note: [s.note, r.note].filter(Boolean).join(" — ") || null,
    };
  });
}

/**
 * Cuba satu alamat dalam CRM menggunakan sesi yang sama.
 *
 * Digunakan untuk mencari dari mana status pasukan diambil, tanpa perlu
 * meneka dan menunggu satu pusingan penuh setiap kali.
 */
export interface HasilCubaan {
  url: string;
  status: number;
  jenis: string;
  cebisan: string;
}

/** Cuba satu alamat menggunakan cookie sesi yang sudah ada. */
export async function cubaDenganCookie(
  cookie: string,
  laluan: string
): Promise<HasilCubaan> {
  const url = new URL(laluan, CRM_URL).toString();
  const res = await fetch(url, {
    headers: {
      Cookie: cookie,
      Accept: "application/json, */*",
      "User-Agent": "Mozilla/5.0 (compatible; MasdoraDashboard/1.0)",
    },
    cache: "no-store",
  });
  const teks = await res.text();

  return {
    url,
    status: res.status,
    jenis: res.headers.get("content-type") ?? "",
    cebisan: teks.slice(0, 1500),
  };
}

export async function cubaAlamat(
  kataLaluan: string,
  laluan: string
): Promise<HasilCubaan> {
  // Log masuk untuk mendapatkan cookie sesi.
  const post = await fetch(CRM_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (compatible; MasdoraDashboard/1.0)",
    },
    body: new URLSearchParams({ pw: kataLaluan }).toString(),
    redirect: "manual",
    cache: "no-store",
  });

  return cubaDenganCookie(kutipCookie(post), laluan);
}

/** Periksa struktur halaman tanpa menyimpan apa-apa. */
export function periksaStruktur(html: string): CrmDebug {
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  const t = jadualTerbesar(html);
  const rows = t ? baris(t) : [];

  // Kalau data bukan dalam jadual, ia selalunya JSON terbenam dalam
  // <script>. Kutip calon pertama supaya pembaca boleh dilaraskan.
  let jsonCebisan: string | null = null;
  const skrip = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const s of skrip) {
    const isi = s.replace(/<\/?script[^>]*>/gi, "");
    const arr = isi.match(/\[\s*\{[\s\S]{40,}?\}\s*\]/);
    if (arr) {
      jsonCebisan = arr[0].slice(0, 800);
      break;
    }
  }

  // CSS dan pilihan penapis turut mengandungi perkataan status, tetapi ia
  // bukan data. Buang dahulu supaya carian tidak dipenuhi bunyi.
  const bersih = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<option[\s\S]*?<\/option>/gi, " ")
    .replace(/<link[^>]*>/gi, " ");

  // Cari pasangan status dalam bentuk data sebenar, contoh "status":"recovered"
  const statusCebisan: string[] = [];
  const corak = [
    /["']?status["']?\s*[:=]\s*["'](open|contacted|recovered|lost)["']/gi,
    /["'](open|contacted|recovered|lost)["']\s*[,}\]]/gi,
    /s-(open|contacted|recovered|lost)\b/gi,
  ];
  for (const c of corak) {
    let sm: RegExpExecArray | null;
    while ((sm = c.exec(bersih)) !== null && statusCebisan.length < 6) {
      const mula = Math.max(0, sm.index - 260);
      statusCebisan.push(
        bersih.slice(mula, sm.index + 260).replace(/\s+/g, " ")
      );
    }
    if (statusCebisan.length >= 6) break;
  }

  // Kutip SEMUA alamat yang disebut dalam skrip halaman — bukan hanya
  // corak fetch() yang jelas, kerana alamat boleh dibina secara dinamik.
  const skripSahaja = (html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) ?? [])
    .join(" ")
    .replace(/\\\//g, "/");

  const endpoints = Array.from(
    new Set(
      (
        skripSahaja.match(
          /["'`](https?:\/\/[^"'`\s]{4,90}|\/[A-Za-z0-9_\-./]{2,80})["'`]/g
        ) ?? []
      )
        .map((x) => x.slice(1, -1))
        // Buang aset — gambar produk, fon, skrip pihak ketiga.
        .filter(
          (u) =>
            !/\.(png|jpe?g|gif|svg|webp|css|woff2?|ttf|ico)(\?|$)/i.test(u) &&
            !/cdn\.shopify\.com/i.test(u) &&
            !/fonts\.(googleapis|gstatic)/i.test(u)
        )
    )
  ).slice(0, 20);

  // Endpoint status membalas 401, jadi kaedah pengesahannya berbeza
  // daripada cookie halaman. Kutip kod di sekeliling panggilan CRM sendiri
  // supaya header/kaedah yang betul dapat dilihat.
  const panggilanStatus: string[] = [];
  const reP = /masdora-status/g;
  let pm: RegExpExecArray | null;
  while ((pm = reP.exec(skripSahaja)) !== null && panggilanStatus.length < 3) {
    const mula = Math.max(0, pm.index - 400);
    panggilanStatus.push(
      skripSahaja.slice(mula, pm.index + 700).replace(/\s+/g, " ")
    );
  }

  return {
    headers: rows[0] ?? [],
    rowCount: Math.max(0, rows.length - 1),
    tableCount: tables.length,
    jsonEmbedded: jsonCebisan !== null,
    jsonCebisan,
    statusCebisan,
    endpoints,
    panggilanStatus,
    sample: rows.slice(1, 4),
  };
}

// ---------------------------------------------------------------- JSON Shopify

/**
 * Petik satu objek JSON lengkap bermula pada kurungan `{` yang diberi,
 * dengan mengira kedalaman kurungan dan mengabaikan kurungan dalam teks.
 */
function petikObjek(s: string, mula: number): string | null {
  let dalam = 0;
  let dalamTeks = false;
  let escape = false;

  for (let i = mula; i < s.length; i++) {
    const c = s[i];
    if (dalamTeks) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') dalamTeks = false;
      continue;
    }
    if (c === '"') dalamTeks = true;
    else if (c === "{") dalam++;
    else if (c === "}") {
      dalam--;
      if (dalam === 0) return s.slice(mula, i + 1);
    }
  }
  return null;
}

interface NodShopify {
  id?: string;
  name?: string;
  createdAt?: string;
  email?: string;
  phone?: string;
  displayFinancialStatus?: string;
  abandonedCheckoutUrl?: string;
  totalPriceSet?: {
    presentmentMoney?: { amount?: string };
    shopMoney?: { amount?: string };
  };
  customer?: { displayName?: string; phone?: string; email?: string };
  billingAddress?: { phone?: string };
  shippingAddress?: { phone?: string };
  lineItems?: { edges?: { node?: { title?: string; quantity?: number } }[] };
}

/**
 * Kutip nod pesanan/checkout dari JSON Shopify yang terbenam dalam halaman.
 *
 * Jadual CRM diisi oleh JavaScript selepas halaman dibuka, jadi HTML yang
 * diterima pelayan hanya mengandungi baris "Loading live data from
 * Shopify…". Tetapi data sebenar terbenam dalam halaman sebagai JSON —
 * itulah yang dibaca di sini.
 */
function kutipNodShopify(html: string): NodShopify[] {
  // Data mungkin terbenam terus, atau sebagai teks JavaScript dengan petikan
  // yang di-escape. Cuba kedua-duanya.
  const calon = [html, html.replace(/\\"/g, '"')];
  const nod: NodShopify[] = [];
  const nampak = new Set<string>();

  for (const s of calon) {
    const re = /"node"\s*:\s*\{/g;
    let m: RegExpExecArray | null;

    while ((m = re.exec(s)) !== null) {
      const braceIdx = s.indexOf("{", m.index + 6);
      if (braceIdx < 0) continue;
      const objStr = petikObjek(s, braceIdx);
      if (!objStr) continue;

      let o: NodShopify;
      try {
        o = JSON.parse(objStr) as NodShopify;
      } catch {
        continue;
      }

      // lineItems juga menggunakan bentuk {"node":{...}}, jadi hanya nod
      // yang benar-benar pesanan/checkout diterima.
      const pesanan =
        o.totalPriceSet !== undefined ||
        o.customer !== undefined ||
        o.email !== undefined ||
        o.abandonedCheckoutUrl !== undefined;
      if (!pesanan) continue;

      const kunci = String(o.id ?? o.name ?? objStr.slice(0, 120));
      if (nampak.has(kunci)) continue;
      nampak.add(kunci);
      nod.push(o);
    }

    if (nod.length > 0) break;
  }

  return nod;
}

function nodKeRekod(o: NodShopify): CrmRow | null {
  // "gid://shopify/Order/7898953482531" -> "7898953482531"
  const idPanjang = String(o.id ?? "").match(/(\d{6,})/)?.[1];
  const noNama = String(o.name ?? "").replace(/\D/g, "");
  const kunci = idPanjang || noNama;
  if (!kunci) return null;

  const jumlah =
    o.totalPriceSet?.presentmentMoney?.amount ??
    o.totalPriceSet?.shopMoney?.amount ??
    "0";

  const produk = (o.lineItems?.edges ?? [])
    .map((e) => e.node?.title)
    .filter(Boolean)
    .join(" · ");

  // Checkout yang ditinggalkan tiada status kewangan — tandakan sendiri.
  const status = o.abandonedCheckoutUrl
    ? "ABANDONED"
    : o.displayFinancialStatus ?? null;

  return {
    source_id: `crm-${kunci}`,
    customer_name: o.customer?.displayName || null,
    customer_contact:
      o.email ||
      o.customer?.email ||
      o.phone ||
      o.customer?.phone ||
      o.billingAddress?.phone ||
      o.shippingAddress?.phone ||
      null,
    status,
    amount_rm: nombor(jumlah),
    contacted_at: o.createdAt ? o.createdAt.slice(0, 10) : null,
    handler: null,
    note: produk || null,
  };
}

/** Baca rekod dari JSON Shopify yang terbenam dalam halaman. */
export function bacaRekodJson(html: string): CrmRow[] {
  return kutipNodShopify(html)
    .map(nodKeRekod)
    .filter((r): r is CrmRow => r !== null);
}

/**
 * Tukar HTML CRM menjadi rekod.
 *
 * Lajur dikesan melalui kata kunci tajuk dan bukan kedudukan, supaya
 * menambah atau menyusun semula lajur dalam CRM tidak merosakkan
 * penyegerakan.
 */
export function bacaRekod(html: string): CrmRow[] {
  // JSON terbenam didahulukan: jadual CRM diisi oleh JavaScript, jadi HTML
  // yang sampai ke pelayan hanya mengandungi baris "Loading live data…".
  const dariJson = bacaRekodJson(html);
  if (dariJson.length > 0) return dariJson;

  const t = jadualTerbesar(html);
  if (!t) return [];

  const rows = baris(t);
  if (rows.length < 2) return [];

  const headers = rows[0];
  const cNama = cariLajur(headers, ["CUSTOMER", "NAMA", "NAME", "PELANGGAN"]);
  const cHubungi = cariLajur(headers, [
    "CONTACT",
    "EMAIL",
    "PHONE",
    "TELEFON",
    "NOMBOR",
    "WHATSAPP",
  ]);
  // "STATUS & NOTE" ialah keputusan semasa (Open/Won/...). "STATE" pula
  // menerangkan jenis kes (Abandoned/Expired). Keputusan diutamakan.
  const cStatus = cariLajur(headers, ["STATUS", "KEADAAN"]);
  const cState = cariLajur(headers, ["STATE"]);
  const cJumlah = cariLajur(headers, [
    "RM",
    "AMOUNT",
    "JUMLAH",
    "NILAI",
    "HARGA",
    "VALUE",
  ]);
  const cTarikh = cariLajur(headers, [
    "TARIKH",
    "DATE",
    "CONTACTED",
    "DIHUBUNGI",
    "FOLLOW",
  ]);
  const cHandler = cariLajur(headers, ["HANDLER", "AGENT", "PIC", "OLEH"]);
  const cItem = cariLajur(headers, ["ITEM", "PRODUK", "PRODUCT"]);
  // Lajur CRM bernama "STATUS & NOTE" — ia mengandungi "NOTE", jadi tanpa
  // pengecualian ini nilai status akan disalin semula sebagai catatan.
  const cNotaMentah = cariLajur(headers, ["NOTA", "CATATAN", "REMARK", "NOTE"]);
  const cNota = cNotaMentah === cStatus ? -1 : cNotaMentah;
  const cPriority = cariLajur(headers, ["PRIORITY", "KEUTAMAAN"]);
  const cAge = cariLajur(headers, ["AGE", "UMUR"]);

  const out: CrmRow[] = [];
  const nampak = new Set<string>();

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const get = (idx: number) => (idx >= 0 && idx < r.length ? r[idx] : "");

    const selNama = get(cNama);
    const hubungi = get(cHubungi);

    // Sel CUSTOMER mengandungi nama DAN nombor pesanan, contoh:
    // "Amely Md Noor #41691769405731". Pisahkan kedua-duanya.
    const noPesanan = r.join(" ").match(/#\s*(\d{3,})/)?.[1] ?? "";
    const nama = selNama.replace(/#\s*\d{3,}/, "").trim();

    // source_id mesti stabil supaya rekod dikemas kini dan bukan diduplikasi.
    const sourceId = noPesanan
      ? `crm-${noPesanan}`
      : nama || hubungi
      ? `crm-${(nama + "|" + hubungi).toLowerCase().replace(/\s+/g, "")}`
      : "";

    if (!sourceId || nampak.has(sourceId)) continue;
    nampak.add(sourceId);

    // Ambil emel dari sel CONTACT — sel itu turut mengandungi teks butang
    // ("WhatsApp", "Script", "Email") yang bukan maklumat hubungan.
    const emel = hubungi.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] ?? "";

    const status = get(cStatus) || get(cState) || null;

    // ITEM ialah produk yang ditinggalkan — simpan sebagai catatan supaya
    // Maisarah tahu apa yang perlu disusuli tanpa membuka CRM.
    const nota = [get(cNota), get(cItem)].filter(Boolean).join(" — ") || null;

    out.push({
      source_id: sourceId,
      customer_name: nama || null,
      customer_contact: emel || hubungi || null,
      status,
      amount_rm: nombor(get(cJumlah)),
      contacted_at: tarikh(get(cTarikh)),
      handler: get(cHandler)?.toUpperCase() || null,
      note: nota,
      priority: get(cPriority) || null,
      age: get(cAge) || null,
    });
  }

  return out;
}
