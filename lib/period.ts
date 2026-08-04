export function getCurrentYear(): number {
  return new Date().getFullYear();
}

export function getCurrentMonth(): number {
  return new Date().getMonth() + 1;
}

/** Minggu dalam bulan = ceil(hari / 7), diklamp antara 1-4. */
export function getCurrentWeekOfMonth(): number {
  const day = new Date().getDate();
  const week = Math.ceil(day / 7);
  return Math.min(4, Math.max(1, week));
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
