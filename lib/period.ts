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
