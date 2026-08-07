/**
 * Baca "Customer Issue Report" terus dari Google Sheet (semua tab bulan),
 * tanpa perlu Apps Script atau sync manual.
 *
 * Sheet ini dikongsi secara "anyone with the link", jadi CSV export boleh
 * dibaca tanpa kredensial. Semua fetch dibuat di server (bukan browser)
 * supaya tiada isu CORS.
 */

const SHEET_ID = "1TqDoXOfECRElTd2QOKFPH9OmFKP2flQGqke0dp47PYA";
const REVALIDATE_SECONDS = 60;

export interface CsIssue {
  monthTab: string;
  rowIndex: number;
  reportedAt: string | null; // ISO YYYY-MM-DD
  rawDate: string;
  username: string;
  platform: string;
  description: string;
  solution: string;
  handler: string;
}

/** Parse CSV mengikut RFC4180 — kendalikan petikan, koma & newline dalam sel. */
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
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\r") {
      // abaikan — tunggu \n
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/** Cari index lajur pertama yang header-nya mengandungi salah satu kata kunci. */
function findCol(headers: string[], keywords: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].trim().toUpperCase();
    if (!h) continue;
    if (keywords.some((k) => h.includes(k))) return i;
  }
  return -1;
}

/** Ekstrak tarikh DD/M/YYYY daripada teks bebas -> ISO YYYY-MM-DD. */
function extractIsoDate(free: string): string | null {
  const m = free.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (!day || !month || !year) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Kesan semua tab (nama + gid) daripada paparan HTML awam sheet. */
async function discoverTabs(): Promise<{ name: string; gid: string }[]> {
  const res = await fetch(
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/htmlview`,
    { next: { revalidate: REVALIDATE_SECONDS } }
  );
  if (!res.ok) return [];
  const html = await res.text();

  const tabs: { name: string; gid: string }[] = [];
  const re = /items\.push\(\{name: "([^"]+)", pageUrl: "[^"]*gid=(\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    tabs.push({ name: m[1], gid: m[2] });
  }
  return tabs;
}

async function fetchTab(tab: { name: string; gid: string }): Promise<CsIssue[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${tab.gid}`;
  const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });
  if (!res.ok) return [];

  const rows = parseCsv(await res.text());
  if (rows.length < 2) return [];

  const headers = rows[0];
  const cDate = findCol(headers, ["TARIKH", "DATE"]);
  const cUser = findCol(headers, ["USERNAME", "USER"]);
  const cPlatform = findCol(headers, ["PLATFORM"]);
  const cDesc = findCol(headers, ["MASALAH", "ISSUE", "PROBLEM"]);
  const cSolution = findCol(headers, ["SOLUTION", "PENYELESAIAN"]);
  const cHandler = findCol(headers, ["HANDLER", "PENGENDALI"]);

  const out: CsIssue[] = [];
  let lastRawDate = "";
  let lastIso: string | null = null;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const get = (idx: number) => (idx >= 0 && idx < r.length ? r[idx].trim() : "");

    const rawDate = get(cDate);
    if (rawDate) {
      const iso = extractIsoDate(rawDate);
      if (iso) {
        lastIso = iso;
        lastRawDate = rawDate;
      }
    }

    const username = get(cUser);
    const platform = get(cPlatform);
    const description = get(cDesc);
    const solution = get(cSolution);
    const handler = get(cHandler).toUpperCase();

    // Langkau baris yang benar-benar kosong
    if (!username && !platform && !description && !handler) continue;

    out.push({
      monthTab: tab.name,
      rowIndex: i + 1,
      reportedAt: lastIso,
      rawDate: rawDate || lastRawDate,
      username,
      platform,
      description,
      solution,
      handler,
    });
  }

  return out;
}

export async function GET() {
  try {
    const tabs = await discoverTabs();
    if (tabs.length === 0) {
      return Response.json(
        { ok: false, error: "Tiada tab dijumpai dalam sheet." },
        { status: 502 }
      );
    }

    const results = await Promise.all(
      tabs.map((t) => fetchTab(t).catch(() => [] as CsIssue[]))
    );
    const issues = results.flat();

    // Terkini di atas: yang ada tarikh dahulu, disusun menurun
    issues.sort((a, b) => {
      if (a.reportedAt && b.reportedAt) return b.reportedAt.localeCompare(a.reportedAt);
      if (a.reportedAt) return -1;
      if (b.reportedAt) return 1;
      return 0;
    });

    return Response.json({
      ok: true,
      tabs: tabs.map((t) => t.name),
      total: issues.length,
      issues,
    });
  } catch {
    return Response.json(
      { ok: false, error: "Gagal membaca Google Sheet." },
      { status: 500 }
    );
  }
}
