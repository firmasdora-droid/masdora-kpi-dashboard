/**
 * =====================================================================
 * ARAHAN PEMASANGAN (Bahasa Melayu) — untuk staff bukan teknikal
 * =====================================================================
 * 1. Buka Google Doc "Daily Chat Report" yang berkenaan.
 * 2. Klik menu Extensions (Sambungan) -> Apps Script.
 * 3. Padam apa-apa kod contoh yang ada, dan tampal SEMUA kandungan
 *    fail ini (dari atas ke bawah) ke dalam editor Apps Script.
 * 4. Cari baris "const SECRET = 'PASTE_YOUR_SECRET_HERE';" di bawah,
 *    dan gantikan 'PASTE_YOUR_SECRET_HERE' dengan kod rahsia yang
 *    diberikan oleh admin (Ferdaus).
 * 5. Simpan projek (ikon disket / Ctrl+S). Boleh namakan projek apa-apa
 *    saja, contohnya "Chat Log Sync".
 * 6. Di bahagian atas editor, pilih function "createTimeTrigger" dari
 *    dropdown function (sebelah butang Run/Debug), kemudian klik Run.
 *    Ini set up sync automatik setiap 15 minit — HANYA perlu buat SEKALI.
 * 7. Google akan minta kebenaran (permission) — klik "Review permissions",
 *    pilih akaun Google anda, klik "Advanced" kalau ada amaran, kemudian
 *    "Go to <nama projek> (unsafe)" dan "Allow". Ini normal untuk skrip
 *    peribadi/dalaman.
 * 8. Selesai! Skrip akan sync data setiap 15 minit secara automatik.
 *    Boleh check "Executions" (menu sebelah kiri editor) untuk tengok log.
 * =====================================================================
 */

// Alamat endpoint dashboard KPI Masdora — jangan tukar melainkan diarahkan.
const ENDPOINT = 'https://masdora-kpi-dashboard.vercel.app/api/ingest/chat-log';

// GANTIKAN dengan kod rahsia yang diberikan oleh admin.
const SECRET = 'PASTE_YOUR_SECRET_HERE';

const VALID_HANDLERS = ['MAI', 'HAWA', 'TI'];
const DATE_LINE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const CHUNK_SIZE = 200;

/**
 * Fungsi utama — imbas seluruh dokumen, cari setiap blok tarikh + jadual
 * handler, kumpul semua row, dan hantar ke endpoint dalam batch.
 */
function syncChatLog() {
  const doc = DocumentApp.getActiveDocument();
  const body = doc.getBody();
  const numChildren = body.getNumChildren();

  const rows = [];

  for (let i = 0; i < numChildren; i++) {
    const el = body.getChild(i);
    if (el.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;

    const text = el.asParagraph().getText().trim();
    const dateMatch = text.match(DATE_LINE_PATTERN);
    if (!dateMatch) continue;

    const day = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10);
    const year = parseInt(dateMatch[3], 10);
    if (!day || !month || !year) continue;
    const isoDate = year + '-' + pad2(month) + '-' + pad2(day);

    // Cari jadual berikutnya dalam beberapa elemen selepas baris tarikh ini
    const table = findNextTable(body, i, numChildren);
    if (!table) continue;

    const tableRows = parseHandlerTable(table);
    for (const r of tableRows) {
      rows.push(Object.assign({ date: isoDate }, r));
    }
  }

  Logger.log('Jumlah row ditemui: ' + rows.length);

  let sent = 0;
  let errors = 0;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    try {
      const resp = UrlFetchApp.fetch(ENDPOINT, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ secret: SECRET, rows: chunk }),
        muteHttpExceptions: true,
      });
      const code = resp.getResponseCode();
      if (code >= 200 && code < 300) {
        sent += chunk.length;
      } else {
        errors++;
        Logger.log('Chunk gagal (HTTP ' + code + '): ' + resp.getContentText());
      }
    } catch (e) {
      errors++;
      Logger.log('Chunk ralat: ' + e);
    }
  }

  Logger.log(
    'Selesai. Row ditemui: ' + rows.length + ', row dihantar: ' + sent +
    ', chunk ralat: ' + errors
  );
}

/**
 * Cari jadual (Table element) yang datang selepas index startIndex,
 * dalam beberapa elemen bukan-kosong berikutnya (skip paragraf kosong
 * seperti tajuk "HANDLER" duplikat / baris kosong).
 */
function findNextTable(body, startIndex, numChildren) {
  const LOOKAHEAD = 6;
  for (let j = startIndex + 1; j < Math.min(startIndex + 1 + LOOKAHEAD, numChildren); j++) {
    const el = body.getChild(j);
    if (el.getType() === DocumentApp.ElementType.TABLE) {
      return el.asTable();
    }
  }
  return null;
}

/**
 * Parse satu jadual: baris pertama = header handler platform, baris kedua =
 * sub-header OPEN/CLOSE, baris ketiga dst = data sebenar (MAI/HAWA/TI).
 * Pulangkan array { handler, whatsapp_open, whatsapp_close, ... }.
 */
function parseHandlerTable(table) {
  const results = [];
  const numRows = table.getNumRows();

  for (let r = 0; r < numRows; r++) {
    const row = table.getRow(r);
    const numCells = row.getNumCells();
    if (numCells === 0) continue;

    const firstCell = row.getCell(0).getText().trim().toUpperCase();
    if (VALID_HANDLERS.indexOf(firstCell) === -1) continue; // bukan baris data handler

    // Ambil 10 cell numerik seterusnya (cell 1..10)
    const nums = [];
    for (let c = 1; c <= 10; c++) {
      if (c < numCells) {
        nums.push(parseNum(row.getCell(c).getText()));
      } else {
        nums.push(0);
      }
    }

    results.push({
      handler: firstCell,
      whatsapp_open: nums[0],
      whatsapp_close: nums[1],
      telegram_open: nums[2],
      telegram_close: nums[3],
      instagram_open: nums[4],
      instagram_close: nums[5],
      tiktok_open: nums[6],
      tiktok_close: nums[7],
      web_open: nums[8],
      web_close: nums[9],
    });
  }

  return results;
}

function parseNum(raw) {
  const trimmed = String(raw || '').trim();
  if (trimmed === '') return 0;
  const n = parseInt(trimmed, 10);
  return isNaN(n) ? 0 : n;
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

/**
 * Jalankan fungsi ini SEKALI SAHAJA (secara manual, dari editor Apps Script)
 * untuk pasang trigger automatik setiap 15 minit. Padam trigger lama dahulu
 * supaya tak duplicate kalau function ini dijalankan semula.
 */
function createTimeTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    if (t.getHandlerFunction() === 'syncChatLog') {
      ScriptApp.deleteTrigger(t);
    }
  }
  ScriptApp.newTrigger('syncChatLog').timeBased().everyMinutes(15).create();
  Logger.log('Trigger automatik dipasang: syncChatLog setiap 15 minit.');
}
