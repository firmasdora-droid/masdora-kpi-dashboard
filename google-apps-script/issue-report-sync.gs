/**
 * =====================================================================
 * ARAHAN PEMASANGAN (Bahasa Melayu) — untuk staff bukan teknikal
 * =====================================================================
 * 1. Buka Google Sheet "Customer Issue Report" yang berkenaan.
 * 2. Klik menu Extensions (Sambungan) -> Apps Script.
 * 3. Padam apa-apa kod contoh yang ada, dan tampal SEMUA kandungan
 *    fail ini (dari atas ke bawah) ke dalam editor Apps Script.
 * 4. Cari baris "const SECRET = 'PASTE_YOUR_SECRET_HERE';" di bawah,
 *    dan gantikan 'PASTE_YOUR_SECRET_HERE' dengan kod rahsia yang
 *    diberikan oleh admin (Ferdaus).
 * 5. Simpan projek (ikon disket / Ctrl+S). Boleh namakan projek apa-apa
 *    saja, contohnya "Issue Report Sync".
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
const ENDPOINT = 'https://masdora-kpi-dashboard.vercel.app/api/ingest/issues';

// GANTIKAN dengan kod rahsia yang diberikan oleh admin.
const SECRET = 'PASTE_YOUR_SECRET_HERE';

const VALID_HANDLERS = ['MAI', 'HAWA', 'TI'];
// Padan tarikh DD/M/YYYY (atau DD/MM/YYYY) di mana-mana dalam teks bebas,
// cth "Parcel delivered: 18/1/2026" -> tangkap "18/1/2026".
const DATE_SUBSTRING_PATTERN = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
const CHUNK_SIZE = 200;

// Lajur yang digunakan (0-indexed), selebihnya (duplikat SOLUTION/HANDLER
// dari copy-paste lama) diabaikan:
// 0=TARIKH & MASA, 1=USERNAME, 2=PLATFORM, 3=MASALAH/CUSTOMER,
// 4=SCREENSHOT (diabaikan), 5=SOLUTION, 6=HANDLER
const COL_DATE = 0;
const COL_USERNAME = 1;
const COL_PLATFORM = 2;
const COL_DESCRIPTION = 3;
const COL_SOLUTION = 5;
const COL_HANDLER = 6;

/**
 * Fungsi utama — baca seluruh sheet aktif, skip header, forward-fill tarikh,
 * bina source_row_id stabil per baris fizikal, dan hantar ke endpoint dalam batch.
 */
function syncIssueReport() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const data = sheet.getDataRange().getValues();

  const rows = [];
  let lastDate = null; // 'YYYY-MM-DD' terkini yang ditemui (forward-fill)

  // Row 0 = header, mula dari row 1
  for (let i = 1; i < data.length; i++) {
    const rowValues = data[i];
    const physicalRowNumber = i + 1; // 1-indexed, sepadan dengan nombor row sheet sebenar

    const rawDateCell = String(rowValues[COL_DATE] || '').trim();
    if (rawDateCell !== '') {
      const parsed = extractIsoDate(rawDateCell);
      if (parsed) lastDate = parsed;
      // kalau rawDateCell ada tapi tak parse, kekalkan lastDate sedia ada (tak reset)
    }

    if (!lastDate) continue; // belum pernah nampak tarikh sah lagi — skip

    const handlerRaw = String(rowValues[COL_HANDLER] || '').trim().toUpperCase();
    if (VALID_HANDLERS.indexOf(handlerRaw) === -1) continue; // handler kosong/tak sah — skip

    const username = String(rowValues[COL_USERNAME] || '').trim();
    const platform = String(rowValues[COL_PLATFORM] || '').trim();
    const description = String(rowValues[COL_DESCRIPTION] || '').trim();
    const solution = String(rowValues[COL_SOLUTION] || '').trim();

    rows.push({
      source_row_id: 'issue-' + physicalRowNumber,
      reported_at: lastDate,
      username: username,
      platform: platform,
      description: description,
      solution: solution,
      handler: handlerRaw,
    });
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
 * Cari corak DD/M/YYYY di mana-mana dalam rentetan bebas dan pulangkan
 * dalam format ISO 'YYYY-MM-DD'. Pulangkan null kalau tiada padanan.
 */
function extractIsoDate(freeText) {
  const m = freeText.match(DATE_SUBSTRING_PATTERN);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (!day || !month || !year) return null;
  return year + '-' + pad2(month) + '-' + pad2(day);
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
    if (t.getHandlerFunction() === 'syncIssueReport') {
      ScriptApp.deleteTrigger(t);
    }
  }
  ScriptApp.newTrigger('syncIssueReport').timeBased().everyMinutes(15).create();
  Logger.log('Trigger automatik dipasang: syncIssueReport setiap 15 minit.');
}
