/**
 * Baca "Daily Chat Report" terus dari Google Doc, tanpa Apps Script.
 *
 * Doc dikongsi "anyone with the link", jadi export teks boleh dibaca tanpa
 * kredensial. Semua fetch di server supaya tiada isu CORS.
 *
 * Format doc (setiap sel jadual jadi satu baris dalam export teks):
 *   23/02/2026
 *   HANDLER / WHATSAPP / TELEGRAM / INSTAGRAM / TIKTOK / WEB
 *   OPEN / CLOSE  (x5)
 *   MAI / 10 / 0 / 0 / 0 / 1 / 0 / 3 / 0 / 6 / 1
 *   HAWA / ...
 */

const DOC_ID = "14yACfwqebYdz7m-8PU5MCtu9quoB2TnbSkquHeLoZn4";
const REVALIDATE_SECONDS = 60;

const HANDLERS = ["MAI", "HAWA", "TI", "SHA"];
/** "SHA" ialah kod lain untuk orang yang sama seperti "HAWA" (Natasya). */
const HANDLER_ALIASES: Record<string, string> = { SHA: "HAWA" };
const DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const STOP_WORDS = [
  "HANDLER",
  "OPEN",
  "CLOSE",
  "WHATSAPP",
  "TELEGRAM",
  "INSTAGRAM",
  "INSTGRAM",
  "TIKTOK",
  "WEB",
];

export interface ChatLogRow {
  date: string; // ISO YYYY-MM-DD
  year: number;
  month: number;
  handler: string;
  whatsappOpen: number;
  whatsappClose: number;
  telegramOpen: number;
  telegramClose: number;
  instagramOpen: number;
  instagramClose: number;
  tiktokOpen: number;
  tiktokClose: number;
  webOpen: number;
  webClose: number;
  totalOpen: number;
  totalClose: number;
}

function toInt(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  if (!/^-?\d+$/.test(t)) return null;
  return Number(t);
}

function parseDoc(text: string): ChatLogRow[] {
  const lines = text
    .replace(/﻿/g, "")
    .split("\n")
    .map((l) => l.trim());

  const rows: ChatLogRow[] = [];
  let currentIso: string | null = null;
  let currentYear = 0;
  let currentMonth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const dm = line.match(DATE_RE);
    if (dm) {
      const day = Number(dm[1]);
      const month = Number(dm[2]);
      const year = Number(dm[3]);
      if (day && month && year) {
        const pad = (n: number) => String(n).padStart(2, "0");
        currentIso = `${year}-${pad(month)}-${pad(day)}`;
        currentYear = year;
        currentMonth = month;
      }
      continue;
    }

    const upper = line.toUpperCase();
    if (!HANDLERS.includes(upper)) continue;
    if (!currentIso) continue;

    // Kumpul 10 nombor selepas nama handler
    const nums: number[] = [];
    for (let j = i + 1; j < lines.length && nums.length < 10; j++) {
      const t = lines[j].trim();
      if (t === "") continue;

      const tUpper = t.toUpperCase();
      // Berhenti kalau terjumpa handler lain, tarikh baru, atau header jadual
      if (HANDLERS.includes(tUpper) || DATE_RE.test(t) || STOP_WORDS.includes(tUpper)) {
        break;
      }

      const n = toInt(t);
      if (n === null) break; // teks lain yang tak dijangka — berhenti
      nums.push(n);
    }

    if (nums.length === 0) continue;
    while (nums.length < 10) nums.push(0);

    const totalOpen = nums[0] + nums[2] + nums[4] + nums[6] + nums[8];
    const totalClose = nums[1] + nums[3] + nums[5] + nums[7] + nums[9];

    rows.push({
      date: currentIso,
      year: currentYear,
      month: currentMonth,
      handler: HANDLER_ALIASES[upper] ?? upper,
      whatsappOpen: nums[0],
      whatsappClose: nums[1],
      telegramOpen: nums[2],
      telegramClose: nums[3],
      instagramOpen: nums[4],
      instagramClose: nums[5],
      tiktokOpen: nums[6],
      tiktokClose: nums[7],
      webOpen: nums[8],
      webClose: nums[9],
      totalOpen,
      totalClose,
    });
  }

  return rows;
}

export async function GET() {
  try {
    const res = await fetch(
      `https://docs.google.com/document/d/${DOC_ID}/export?format=txt`,
      { next: { revalidate: REVALIDATE_SECONDS } }
    );
    if (!res.ok) {
      return Response.json(
        { ok: false, error: "Gagal membaca Google Doc." },
        { status: 502 }
      );
    }

    const rows = parseDoc(await res.text());
    rows.sort((a, b) => b.date.localeCompare(a.date));

    return Response.json({ ok: true, total: rows.length, rows });
  } catch {
    return Response.json(
      { ok: false, error: "Gagal membaca Google Doc." },
      { status: 500 }
    );
  }
}
