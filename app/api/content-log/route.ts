/**
 * Baca "Content / Posting Log" terus dari Google Sheet team video & konten.
 *
 * Struktur sheet: setiap tab (bulan) mengandungi beberapa BLOK. Setiap blok
 * bermula dengan baris header:
 *   Acc handler | Content Type | Posting Date/Time | Like | Comments | Share |
 *   View | Video Links | Yellowbag / Without | Handler
 * diikuti baris-baris post untuk satu akaun (cth Tiktok OS) dan satu handler.
 *
 * Baris yang masih kosong (template belum diisi) tidak dikira.
 */

const SHEET_ID = "1Gk4DE6gcEKb6JkDZX3OJH27d6d7EPTVxaWynWgVcAgc";
const REVALIDATE_SECONDS = 60;

export interface ContentPost {
  monthTab: string;
  rowIndex: number;
  account: string;
  contentType: string;
  postedAt: string;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  videoLink: string;
  yellowBag: string;
  handler: string;
}

/**
 * Nama handler yang telah bertukar orang. "Nisa" digantikan oleh "Qistina",
 * jadi rekod lama digabungkan supaya sejarah kekal dalam satu nama.
 */
const HANDLER_ALIASES: Record<string, string> = { nisa: "Qistina" };

function normalizeHandler(raw: string): string {
  const t = raw.trim();
  return HANDLER_ALIASES[t.toLowerCase()] ?? t;
}

function cacheOpts(fresh: boolean): RequestInit {
  return fresh
    ? { cache: "no-store" }
    : { next: { revalidate: REVALIDATE_SECONDS } };
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

/** "1,234" / "1.2k" / "" -> nombor. */
function toNum(raw: string): number {
  const t = (raw ?? "").trim().toLowerCase().replace(/,/g, "");
  if (!t) return 0;
  const km = t.match(/^([\d.]+)\s*([km])$/);
  if (km) {
    const base = parseFloat(km[1]);
    if (!Number.isFinite(base)) return 0;
    return Math.round(base * (km[2] === "k" ? 1_000 : 1_000_000));
  }
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

function isHeaderRow(r: string[]): boolean {
  return (r[0] ?? "").trim().toLowerCase() === "acc handler";
}

async function discoverTabs(
  fresh: boolean
): Promise<{ name: string; gid: string }[]> {
  const res = await fetch(
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/htmlview`,
    cacheOpts(fresh)
  );
  if (!res.ok) return [];
  const html = await res.text();

  const tabs: { name: string; gid: string }[] = [];
  const re = /items\.push\(\{name: "([^"]+)", pageUrl: "[^"]*gid=(\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) tabs.push({ name: m[1], gid: m[2] });
  return tabs;
}

async function fetchTab(
  tab: { name: string; gid: string },
  fresh: boolean
): Promise<ContentPost[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${tab.gid}`;
  const res = await fetch(url, cacheOpts(fresh));
  if (!res.ok) return [];

  const rows = parseCsv(await res.text());
  const out: ContentPost[] = [];

  // Lajur tetap mengikut header blok
  const C_ACCOUNT = 0;
  const C_TYPE = 1;
  const C_POSTED = 2;
  const C_LIKE = 3;
  const C_COMMENT = 4;
  const C_SHARE = 5;
  const C_VIEW = 6;
  const C_LINK = 7;
  const C_BAG = 8;
  const C_HANDLER = 9;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (isHeaderRow(r)) continue;

    const get = (idx: number) => (r[idx] ?? "").trim();

    const account = get(C_ACCOUNT);
    const handler = normalizeHandler(get(C_HANDLER));
    if (!account || !handler) continue;

    const postedAt = get(C_POSTED);
    const contentType = get(C_TYPE);
    const videoLink = get(C_LINK);
    const likes = toNum(get(C_LIKE));
    const comments = toNum(get(C_COMMENT));
    const shares = toNum(get(C_SHARE));
    const views = toNum(get(C_VIEW));

    // Baris template yang belum diisi — tiada tarikh, tiada metrik, tiada link
    const hasContent =
      postedAt !== "" ||
      videoLink !== "" ||
      contentType !== "" ||
      likes > 0 ||
      comments > 0 ||
      shares > 0 ||
      views > 0;
    if (!hasContent) continue;

    out.push({
      monthTab: tab.name,
      rowIndex: i + 1,
      account,
      contentType,
      postedAt,
      likes,
      comments,
      shares,
      views,
      videoLink,
      yellowBag: get(C_BAG),
      handler,
    });
  }

  return out;
}

export async function GET(request: Request) {
  try {
    const fresh = new URL(request.url).searchParams.get("fresh") === "1";

    const tabs = await discoverTabs(fresh);
    if (tabs.length === 0) {
      return Response.json(
        { ok: false, error: "Tiada tab dijumpai dalam sheet." },
        { status: 502 }
      );
    }

    const results = await Promise.all(
      tabs.map((t) => fetchTab(t, fresh).catch(() => [] as ContentPost[]))
    );
    const posts = results.flat();

    return Response.json({
      ok: true,
      tabs: tabs.map((t) => t.name),
      total: posts.length,
      posts,
    });
  } catch {
    return Response.json(
      { ok: false, error: "Gagal membaca Google Sheet." },
      { status: 500 }
    );
  }
}
