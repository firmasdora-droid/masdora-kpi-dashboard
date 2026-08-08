/**
 * Baca "Product Launch Master Tracker" terus dari Google Sheet kempen.
 *
 * Tab "Overview" ialah senarai induk:
 *   Quarter | Month | Product Name | Category | Weight | Launch Date | Status | Remarks
 *
 * Lajur Quarter & Month hanya diisi pada baris pertama setiap kumpulan
 * (sel bergabung), jadi nilainya dibawa turun ke baris seterusnya.
 */

const SHEET_ID = "1f-T7YGO6u8B_loX3FMHLX9B_TOUX82GlOU9fFnBZ0J0";
const OVERVIEW_GID = "1107288159";
const REVALIDATE_SECONDS = 60;

export type CampaignStatus =
  | "dilancarkan"
  | "dalam_proses"
  | "ditangguh"
  | "dirancang";

export interface CampaignItem {
  rowIndex: number;
  quarter: string;
  month: string;
  product: string;
  category: string;
  weight: string;
  launchDate: string; // teks asal dari sheet
  launchIso: string | null; // untuk susunan & pengiraan hari
  status: CampaignStatus;
  statusRaw: string;
  remarks: string;
  daysAway: number | null;
}

function cacheOpts(fresh: boolean): RequestInit {
  return fresh
    ? { cache: "no-store" }
    : { next: { revalidate: REVALIDATE_SECONDS } };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\r") {
      // abaikan
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** "05-Jun-26" / "5-Jun-26" -> ISO "2026-06-05". */
function parseLaunchDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (m) {
    const day = Number(m[1]);
    const mon = MONTHS[m[2].toLowerCase()];
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    if (!day || !mon || !year) return null;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${year}-${pad(mon)}-${pad(day)}`;
  }

  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

/** Padankan teks status bebas kepada 4 kategori paparan. */
function normalizeStatus(raw: string): CampaignStatus {
  const s = raw.trim().toLowerCase();
  if (!s) return "dirancang";
  if (/(launch|lancar|live|done|selesai|siap)/.test(s)) return "dilancarkan";
  if (/(hold|tangguh|tunda|pending|postpone)/.test(s)) return "ditangguh";
  if (/(progress|proses|ongoing|wip|jalan)/.test(s)) return "dalam_proses";
  return "dirancang";
}

function daysFromToday(iso: string | null): number | null {
  if (!iso) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

export async function GET(request: Request) {
  try {
    const fresh = new URL(request.url).searchParams.get("fresh") === "1";

    const res = await fetch(
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${OVERVIEW_GID}`,
      cacheOpts(fresh)
    );
    if (!res.ok) {
      return Response.json(
        {
          ok: false,
          error:
            "Tidak dapat membaca Google Sheet kempen. Pastikan ia dikongsi sebagai 'Anyone with the link'.",
        },
        { status: 502 }
      );
    }

    const rows = parseCsv(await res.text());

    // Cari baris header (yang bermula dengan "Quarter")
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      if ((rows[i][0] ?? "").trim().toLowerCase() === "quarter") {
        headerIdx = i;
        break;
      }
    }
    if (headerIdx === -1) headerIdx = 1;

    const items: CampaignItem[] = [];
    let lastQuarter = "";
    let lastMonth = "";

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      const get = (idx: number) => (r[idx] ?? "").trim();

      const quarter = get(0);
      const month = get(1);
      const product = get(2);

      if (quarter) lastQuarter = quarter;
      if (month) lastMonth = month;

      // Baris tanpa nama produk = pemisah / kosong
      if (!product) continue;

      const launchDate = get(5);
      const launchIso = parseLaunchDate(launchDate);
      const statusRaw = get(6);

      items.push({
        rowIndex: i + 1,
        quarter: lastQuarter,
        month: lastMonth,
        product,
        category: get(3),
        weight: get(4),
        launchDate,
        launchIso,
        status: normalizeStatus(statusRaw),
        statusRaw,
        remarks: get(7),
        daysAway: daysFromToday(launchIso),
      });
    }

    return Response.json({ ok: true, total: items.length, items });
  } catch {
    return Response.json(
      { ok: false, error: "Gagal membaca Google Sheet." },
      { status: 500 }
    );
  }
}
