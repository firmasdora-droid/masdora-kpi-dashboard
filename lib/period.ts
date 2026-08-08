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
