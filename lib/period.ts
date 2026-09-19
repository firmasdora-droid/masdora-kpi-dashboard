export function getCurrentYear(): number {
  return new Date().getFullYear();
}

export function getCurrentMonth(): number {
  return new Date().getMonth() + 1;
}

/** Minggu dalam bulan bagi satu tarikh = ceil(hari / 7), diklamp antara 1-4. */
export function weekOfDate(d: Date): number {
  const week = Math.ceil(d.getDate() / 7);
  return Math.min(4, Math.max(1, week));
}

/**
 * Minggu kerja semasa.
 *
 * Tarikh akhir penghantaran ialah Jumaat 5:00 petang. Jadi pada hari Sabtu
 * dan Ahad, minggu kerja yang RELEVAN ialah minggu yang baru sahaja tamat
 * (minggu Jumaat itu) — bukan minggu kalendar baharu.
 *
 * Tanpa pelarasan ini, laporan yang dihantar pada hujung minggu akan
 * difailkan ke minggu berikutnya, dan minggu sebenar kekal "belum hantar".
 */
export function getCurrentWeekOfMonth(): number {
  const now = new Date();
  const day = now.getDay(); // 0 = Ahad, 6 = Sabtu

  if (day === 6 || day === 0) {
    // Undur ke Jumaat terdekat sebelum ini
    const back = day === 6 ? 1 : 2;
    const friday = new Date(now);
    friday.setDate(now.getDate() - back);
    // Kalau Jumaat itu jatuh pada bulan lepas, kekal minggu 1 bulan ini
    if (friday.getMonth() !== now.getMonth()) return 1;
    return weekOfDate(friday);
  }

  return weekOfDate(now);
}

export interface WeekOption {
  year: number;
  month: number;
  week: number;
  label: string;
}

const BULAN_MS = [
  "Januari",
  "Februari",
  "Mac",
  "April",
  "Mei",
  "Jun",
  "Julai",
  "Ogos",
  "September",
  "Oktober",
  "November",
  "Disember",
];

/** Bina senarai pilihan minggu (1-4) untuk setiap bulan dalam tahun yang diberi. */
export function buildWeekOptions(year: number): WeekOption[] {
  const options: WeekOption[] = [];
  for (let month = 1; month <= 12; month++) {
    for (let week = 1; week <= 4; week++) {
      options.push({
        year,
        month,
        week,
        label: `Minggu ${week} - ${BULAN_MS[month - 1]} ${year}`,
      });
    }
  }
  return options;
}

export function monthName(month: number): string {
  return BULAN_MS[month - 1] ?? String(month);
}

export interface WeekRange {
  /** Tarikh mula, format "YYYY-MM-DD". */
  startIso: string;
  /** Tarikh akhir (termasuk), format "YYYY-MM-DD". */
  endIso: string;
  /** Contoh: "8 - 14 Ogos 2026" */
  label: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Tarikh sebenar bagi satu minggu dalam bulan.
 *
 * Selari dengan weekOfDate(): minggu 1 = hari 1-7, minggu 2 = 8-14,
 * minggu 3 = 15-21, minggu 4 = 22 hingga hari terakhir bulan itu.
 * Minggu 4 memang lebih panjang (7-10 hari) kerana ia menelan baki bulan.
 */
export function weekDateRange(
  year: number,
  month: number,
  week: number
): WeekRange {
  const w = Math.min(4, Math.max(1, week));
  const lastDay = new Date(year, month, 0).getDate();
  const startDay = (w - 1) * 7 + 1;
  const endDay = w === 4 ? lastDay : Math.min(w * 7, lastDay);
  return {
    startIso: `${year}-${pad(month)}-${pad(startDay)}`,
    endIso: `${year}-${pad(month)}-${pad(endDay)}`,
    label: `${startDay} - ${endDay} ${monthName(month)} ${year}`,
  };
}

/** Adakah tarikh ISO ("YYYY-MM-DD") berada dalam minggu ini? */
export function isInWeek(iso: string | null | undefined, r: WeekRange): boolean {
  if (!iso) return false;
  const d = iso.slice(0, 10);
  return d >= r.startIso && d <= r.endIso;
}

/** Gerak satu minggu ke depan/belakang, melangkaui sempadan bulan & tahun. */
export function shiftWeek(
  value: { year: number; month: number; week: number },
  delta: number
): { year: number; month: number; week: number } {
  let { year, month, week } = value;
  week += delta;
  while (week > 4) {
    week -= 4;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  while (week < 1) {
    week += 4;
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
  }
  return { year, month, week };
}

/** Jenis tempoh laporan. */
export type JenisTempoh = "minggu" | "bulan" | "suku" | "tahun";

export interface PilihanTempoh {
  jenis: JenisTempoh;
  year: number;
  /** Untuk minggu & bulan. */
  month: number;
  /** Untuk minggu sahaja. */
  week: number;
  /** Untuk suku tahun (1-4). */
  quarter: number;
}

export interface TempohRange extends WeekRange {
  /** Contoh: "Minggu 1 · Ogos 2026" atau "Suku 3 2026" */
  tajuk: string;
  /** Bulan yang termasuk dalam tempoh ini (1-12). */
  bulanTermasuk: number[];
}

/**
 * Julat tarikh sebenar bagi mana-mana jenis tempoh.
 *
 * Semua seksyen laporan menapis mengikut julat tarikh, jadi menukar jenis
 * tempoh hanya perlu menukar julat ini — bukan setiap seksyen.
 */
export function tempohRange(p: PilihanTempoh): TempohRange {
  const pad = (n: number) => String(n).padStart(2, "0");
  const akhirBulan = (y: number, m: number) => new Date(y, m, 0).getDate();

  if (p.jenis === "minggu") {
    const r = weekDateRange(p.year, p.month, p.week);
    return {
      ...r,
      tajuk: `Minggu ${p.week} · ${monthName(p.month)} ${p.year}`,
      bulanTermasuk: [p.month],
    };
  }

  if (p.jenis === "bulan") {
    return {
      startIso: `${p.year}-${pad(p.month)}-01`,
      endIso: `${p.year}-${pad(p.month)}-${pad(akhirBulan(p.year, p.month))}`,
      label: `1 - ${akhirBulan(p.year, p.month)} ${monthName(p.month)} ${p.year}`,
      tajuk: `${monthName(p.month)} ${p.year}`,
      bulanTermasuk: [p.month],
    };
  }

  if (p.jenis === "suku") {
    const mula = (p.quarter - 1) * 3 + 1;
    const tamat = mula + 2;
    return {
      startIso: `${p.year}-${pad(mula)}-01`,
      endIso: `${p.year}-${pad(tamat)}-${pad(akhirBulan(p.year, tamat))}`,
      label: `${monthName(mula)} - ${monthName(tamat)} ${p.year}`,
      tajuk: `Suku ${p.quarter} · ${p.year}`,
      bulanTermasuk: [mula, mula + 1, tamat],
    };
  }

  return {
    startIso: `${p.year}-01-01`,
    endIso: `${p.year}-12-31`,
    label: `Januari - Disember ${p.year}`,
    tajuk: `Tahun ${p.year}`,
    bulanTermasuk: Array.from({ length: 12 }, (_, i) => i + 1),
  };
}

/** Suku tahun bagi satu bulan. */
export function quarterOfMonth(month: number): number {
  return Math.floor((month - 1) / 3) + 1;
}

// ---------------------------------------------------------------- sasaran

/**
 * Hari bekerja yang diandaikan bila hanya sasaran HARIAN diberi.
 *
 * Angka ini diambil daripada sasaran Masdora sendiri: CRM update Najjati
 * ialah 10/hari dan 260/bulan (260 / 10 = 26 hari), dan sasaran jualan
 * RM4,000/hari dengan RM100,000/bulan (100,000 / 4,000 = 25 hari). Jadi
 * ~26 hari sebulan dan 6 hari seminggu.
 *
 * Sasaran mingguan/bulanan yang ditetapkan SECARA JELAS sentiasa mengatasi
 * pengiraan ini.
 */
export const HARI_KERJA_SEMINGGU = 6;
export const HARI_KERJA_SEBULAN = 26;

export interface SasaranTempoh {
  harian: number | null;
  mingguan: number | null;
  bulanan: number | null;
  /** Sasaran mana yang dikira, bukan ditetapkan manager. */
  dikira: { mingguan: boolean; bulanan: boolean };
}

/** Lengkapkan sasaran: yang ditetapkan kekal, yang kosong dikira. */
export function lengkapkanSasaran(t: {
  target_daily: number | null;
  target_weekly: number | null;
  target_monthly: number | null;
}): SasaranTempoh {
  const harian = t.target_daily;
  const mingguan =
    t.target_weekly ?? (harian !== null ? harian * HARI_KERJA_SEMINGGU : null);
  const bulanan =
    t.target_monthly ?? (harian !== null ? harian * HARI_KERJA_SEBULAN : null);

  return {
    harian,
    mingguan,
    bulanan,
    dikira: {
      mingguan: t.target_weekly === null && mingguan !== null,
      bulanan: t.target_monthly === null && bulanan !== null,
    },
  };
}

/**
 * Tarikh tempatan dalam bentuk "YYYY-MM-DD".
 *
 * JANGAN guna toISOString() untuk ini. Ia menukar kepada UTC, dan di
 * Malaysia (UTC+8) tengah malam tempatan menjadi 4:00 petang hari
 * SEBELUMNYA — jadi setiap sempadan minggu tersasar satu hari.
 */
function tarikhTempatan(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Julat tarikh minggu kerja (Isnin–Ahad) bagi satu tarikh. */
export function julatMinggu(iso: string): { mula: string; tamat: string } {
  const d = new Date(iso + "T00:00:00");
  const hari = (d.getDay() + 6) % 7; // Isnin = 0
  const isnin = new Date(d);
  isnin.setDate(d.getDate() - hari);
  const ahad = new Date(isnin);
  ahad.setDate(isnin.getDate() + 6);
  return { mula: tarikhTempatan(isnin), tamat: tarikhTempatan(ahad) };
}

/** Julat tarikh bulan bagi satu tarikh. */
export function julatBulan(iso: string): { mula: string; tamat: string } {
  const [y, m] = iso.split("-").map(Number);
  const akhir = new Date(y, m, 0).getDate();
  const p = (n: number) => String(n).padStart(2, "0");
  return { mula: `${y}-${p(m)}-01`, tamat: `${y}-${p(m)}-${p(akhir)}` };
}

// ------------------------------------------------- penghantaran harian

/** Laporan harian mesti dihantar sebelum jam ini. */
export const JAM_AKHIR_HANTAR = 17; // 5:00 petang

/**
 * Ahad ialah hari cuti — tiada laporan diperlukan.
 *
 * Sebab itu juga sasaran mingguan dikira atas 6 hari (Isnin–Sabtu), bukan 7.
 */
export function hariCuti(iso: string): boolean {
  return new Date(iso + "T00:00:00").getDay() === 0;
}

export type StatusHantar = "cuti" | "tepat" | "lewat" | "belum" | "menunggu";

/**
 * Status penghantaran bagi satu hari.
 *
 *   cuti     — Ahad, tiada laporan diperlukan
 *   tepat    — dihantar sebelum 5 petang pada hari itu
 *   lewat    — dihantar selepas 5 petang, atau hari sudah lepas tanpa hantar
 *   menunggu — hari ini, masih ada masa sebelum 5 petang
 *   belum    — hari ini, sudah lepas 5 petang dan belum dihantar
 */
export function statusHantarHarian(
  iso: string,
  submittedAt: string | null | undefined
): StatusHantar {
  if (hariCuti(iso)) return "cuti";

  const hadTarikh = new Date(iso + "T00:00:00");
  hadTarikh.setHours(JAM_AKHIR_HANTAR, 0, 0, 0);

  if (submittedAt) {
    return new Date(submittedAt) <= hadTarikh ? "tepat" : "lewat";
  }

  const sekarang = new Date();
  if (sekarang <= hadTarikh) return "menunggu";
  return sekarang.toDateString() === hadTarikh.toDateString()
    ? "belum"
    : "lewat";
}

/** Berapa lama lagi sebelum 5 petang hari ini. Null kalau sudah lepas/cuti. */
export function bakiMasaHantar(iso: string): string | null {
  if (hariCuti(iso)) return null;
  const had = new Date(iso + "T00:00:00");
  had.setHours(JAM_AKHIR_HANTAR, 0, 0, 0);
  const ms = had.getTime() - Date.now();
  if (ms <= 0) return null;
  const jam = Math.floor(ms / 3_600_000);
  const minit = Math.floor((ms % 3_600_000) / 60_000);
  return jam > 0 ? `${jam} jam ${minit} minit lagi` : `${minit} minit lagi`;
}

/** Bilangan hari kerja (bukan Ahad) dalam satu julat tarikh. */
export function hariKerjaDalamJulat(mula: string, tamat: string): number {
  let n = 0;
  const d = new Date(mula + "T00:00:00");
  const akhir = new Date(tamat + "T00:00:00");
  while (d <= akhir) {
    if (d.getDay() !== 0) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}
