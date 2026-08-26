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

  return {
    headers: rows[0] ?? [],
    rowCount: Math.max(0, rows.length - 1),
    tableCount: tables.length,
    jsonEmbedded: jsonCebisan !== null,
    jsonCebisan,
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
