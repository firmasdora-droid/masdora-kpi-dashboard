/**
 * Baca "Graphic Team Task List" terus dari Google Sheet.
 *
 * Tab "Task List":
 *   Task ID | Task / Project | Quantity | Category | Request From |
 *   Done by Who | Assign Date | Deadline | Status | Notes
 */

const SHEET_ID = "1Uw09DxFrFDpdTQR8hf3lF3KHEcixJMoy-9OsYHb8UhU";
const TASK_GID = "1389656995";
const REVALIDATE_SECONDS = 60;

export type TaskStatus = "selesai" | "semakan" | "proses" | "baru";

export interface GraphicTask {
  rowIndex: number;
  taskId: string;
  title: string;
  quantity: string;
  category: string;
  requestFrom: string;
  doneBy: string;
  assignDate: string;
  deadline: string;
  deadlineIso: string | null;
  status: TaskStatus;
  statusRaw: string;
  notes: string;
  /** Lewat = tarikh akhir sudah lepas tetapi belum selesai. */
  overdue: boolean;
  daysLeft: number | null;
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

/** "10/08/2026" (hari/bulan/tahun) -> ISO "2026-08-10". */
function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const day = Number(m[1]);
    const mon = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    if (!day || !mon || !year) return null;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${year}-${pad(mon)}-${pad(day)}`;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function normalizeStatus(raw: string): TaskStatus {
  const s = raw.trim().toLowerCase();
  if (!s) return "baru";
  if (/(done|selesai|siap|complete|approved|lulus)/.test(s)) return "selesai";
  if (/(review|semak|checking|verify)/.test(s)) return "semakan";
  if (/(progress|proses|ongoing|wip|doing|jalan)/.test(s)) return "proses";
  return "baru";
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

/** Cari index lajur pertama yang header-nya mengandungi kata kunci. */
function findCol(
  headers: string[],
  keywords: string[],
  skip: number[] = []
): number {
  // Cuba setiap kata kunci mengikut keutamaan, bukan mengikut susunan lajur —
  // supaya "Task ID" tidak tersilap dipilih sebagai lajur "Task / Project".
  for (const k of keywords) {
    for (let i = 0; i < headers.length; i++) {
      if (skip.includes(i)) continue;
      const h = headers[i].trim().toUpperCase();
      if (h && h.includes(k)) return i;
    }
  }
  return -1;
}

export async function GET(request: Request) {
  try {
    const fresh = new URL(request.url).searchParams.get("fresh") === "1";

    const res = await fetch(
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${TASK_GID}`,
      cacheOpts(fresh)
    );
    if (!res.ok) {
      return Response.json(
        {
          ok: false,
          error:
            "Tidak dapat membaca Google Sheet tugasan grafik. Pastikan ia dikongsi sebagai 'Anyone with the link'.",
        },
        { status: 502 }
      );
    }

    const rows = parseCsv(await res.text());
    if (rows.length < 2) {
      return Response.json({ ok: true, total: 0, tasks: [] });
    }

    const headers = rows[0];
    const cId = findCol(headers, ["TASK ID", "ID"]);
    const cTitle = findCol(headers, ["TASK /", "PROJECT", "TUGASAN", "TASK"], [cId]);
    const cQty = findCol(headers, ["QUANTITY", "QTY", "KUANTITI"]);
    const cCat = findCol(headers, ["CATEGORY", "KATEGORI"]);
    const cFrom = findCol(headers, ["REQUEST FROM", "REQUEST", "DARIPADA"]);
    const cBy = findCol(headers, ["DONE BY", "ASSIGNEE", "OLEH"]);
    const cAssign = findCol(headers, ["ASSIGN DATE", "ASSIGN", "TARIKH TERIMA"]);
    const cDeadline = findCol(headers, ["DEADLINE", "DUE", "TARIKH AKHIR"]);
    const cStatus = findCol(headers, ["STATUS"]);
    const cNotes = findCol(headers, ["NOTE", "REMARK", "CATATAN"]);

    const tasks: GraphicTask[] = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const get = (idx: number) => (idx >= 0 && idx < r.length ? r[idx].trim() : "");

      const title = get(cTitle);
      const taskId = get(cId);
      if (!title && !taskId) continue; // baris kosong

      const deadline = get(cDeadline);
      const deadlineIso = parseDate(deadline);
      const statusRaw = get(cStatus);
      const status = normalizeStatus(statusRaw);
      const daysLeft = daysUntil(deadlineIso);

      tasks.push({
        rowIndex: i + 1,
        taskId,
        title,
        quantity: get(cQty),
        category: get(cCat),
        requestFrom: get(cFrom),
        doneBy: get(cBy),
        assignDate: get(cAssign),
        deadline,
        deadlineIso,
        status,
        statusRaw,
        notes: get(cNotes),
        overdue: status !== "selesai" && daysLeft !== null && daysLeft < 0,
        daysLeft,
      });
    }

    // Yang belum selesai di atas, kemudian ikut tarikh akhir terdekat
    tasks.sort((a, b) => {
      const aDone = a.status === "selesai" ? 1 : 0;
      const bDone = b.status === "selesai" ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      if (a.deadlineIso && b.deadlineIso)
        return a.deadlineIso.localeCompare(b.deadlineIso);
      if (a.deadlineIso) return -1;
      if (b.deadlineIso) return 1;
      return 0;
    });

    return Response.json({ ok: true, total: tasks.length, tasks });
  } catch {
    return Response.json(
      { ok: false, error: "Gagal membaca Google Sheet." },
      { status: 500 }
    );
  }
}
