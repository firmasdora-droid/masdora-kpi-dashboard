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
export async function ambilHalamanCrm(kataLaluan: string): Promise<string> {
  const res = await fetch(CRM_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      // Sesetengah hos menolak permintaan tanpa User-Agent
      "User-Agent": "MasdoraDashboard/1.0",
    },
    body: new URLSearchParams({ pw: kataLaluan }).toString(),
    redirect: "follow",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`CRM membalas HTTP ${res.status}.`);
  }

  const html = await res.text();

  // Kalau borang kata laluan masih ada, log masuk gagal.
  if (/name="pw"/i.test(html) && !/<table/i.test(html)) {
    throw new Error(
      "Kata laluan CRM ditolak. Semak nilai CRM_TEAM_PASSWORD di Vercel."
    );
  }

  return html;
}

/** Periksa struktur halaman tanpa menyimpan apa-apa. */
export function periksaStruktur(html: string): CrmDebug {
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  const t = jadualTerbesar(html);
  const rows = t ? baris(t) : [];
  return {
    headers: rows[0] ?? [],
    rowCount: Math.max(0, rows.length - 1),
    tableCount: tables.length,
    jsonEmbedded: /application\/json|__DATA__|window\.__/.test(html),
    sample: rows.slice(1, 4),
  };
}

/**
 * Tukar HTML CRM menjadi rekod.
 *
 * Lajur dikesan melalui kata kunci tajuk dan bukan kedudukan, supaya
 * menambah atau menyusun semula lajur dalam CRM tidak merosakkan
 * penyegerakan.
 */
export function bacaRekod(html: string): CrmRow[] {
  const t = jadualTerbesar(html);
  if (!t) return [];

  const rows = baris(t);
  if (rows.length < 2) return [];

  const headers = rows[0];
  const cId = cariLajur(headers, ["ID", "NO", "BIL", "REF"]);
  const cNama = cariLajur(headers, ["NAMA", "NAME", "CUSTOMER", "PELANGGAN"]);
  const cHubungi = cariLajur(headers, [
    "PHONE",
    "TELEFON",
    "CONTACT",
    "NOMBOR",
    "WHATSAPP",
  ]);
  const cStatus = cariLajur(headers, ["STATUS", "KEADAAN"]);
  const cJumlah = cariLajur(headers, [
    "AMOUNT",
    "JUMLAH",
    "RM",
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
  const cHandler = cariLajur(headers, ["HANDLER", "AGENT", "PIC", "OLEH", "CS"]);
  const cNota = cariLajur(headers, ["NOTE", "NOTA", "CATATAN", "REMARK"]);

  const out: CrmRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const get = (idx: number) => (idx >= 0 && idx < r.length ? r[idx] : "");

    const nama = get(cNama);
    const hubungi = get(cHubungi);

    // source_id mesti stabil supaya rekod dikemas kini, bukan diduplikasi.
    // Kalau CRM tiada lajur ID, guna gabungan nama + nombor telefon.
    const idMentah = get(cId);
    const sourceId = idMentah
      ? `crm-${idMentah}`
      : nama || hubungi
      ? `crm-${(nama + "|" + hubungi).toLowerCase().replace(/\s+/g, "")}`
      : "";

    if (!sourceId) continue; // baris kosong atau baris jumlah

    out.push({
      source_id: sourceId,
      customer_name: nama || null,
      customer_contact: hubungi || null,
      status: get(cStatus) || null,
      amount_rm: nombor(get(cJumlah)),
      contacted_at: tarikh(get(cTarikh)),
      handler: get(cHandler)?.toUpperCase() || null,
      note: get(cNota) || null,
    });
  }

  return out;
}
