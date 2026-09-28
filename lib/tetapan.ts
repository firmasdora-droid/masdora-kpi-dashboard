/**
 * Tetapan keseluruhan dashboard, disimpan dalam jadual `app_settings`
 * dan diubah oleh Marketing Manager melalui halaman Master Setting.
 *
 * Kalau jadual itu belum wujud atau sesuatu kunci belum ditetapkan,
 * nilai asal di bawah digunakan — jadi dashboard tidak pernah rosak
 * hanya kerana tetapan belum diisi.
 */

export interface TetapanPaparan {
  /** Teks kecil di bawah logo dalam sidebar. */
  tajuk: string;
  /** Pengumuman kepada seluruh team. Kosong = tiada pengumuman. */
  pengumuman: string;
}

export interface TetapanMasa {
  /** Jam (0-23) tarikh akhir hantar To-Do harian. */
  jam_akhir_hantar: number;
  hari_kerja_seminggu: number;
  hari_kerja_sebulan: number;
}

/** kod jawatan -> senarai kunci menu yang dibenarkan. */
export type TetapanAkses = Record<string, string[]>;

export interface Tetapan {
  paparan: TetapanPaparan;
  masa: TetapanMasa;
  akses: TetapanAkses;
}

export const TETAPAN_ASAL: Tetapan = {
  paparan: { tajuk: "Team Dashboard", pengumuman: "" },
  masa: {
    jam_akhir_hantar: 17,
    hari_kerja_seminggu: 6,
    hari_kerja_sebulan: 26,
  },
  akses: {},
};

interface BarisTetapan {
  key: string;
  value: unknown;
}

function objek(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function teks(v: unknown, asal: string): string {
  return typeof v === "string" ? v : asal;
}

function angka(v: unknown, asal: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : asal;
}

/** Gabungkan baris database dengan nilai asal. Baris rosak diabaikan. */
export function gabungTetapan(rows: BarisTetapan[] | null | undefined): Tetapan {
  const map = new Map<string, unknown>();
  (rows ?? []).forEach((r) => map.set(r.key, r.value));

  const p = objek(map.get("paparan"));
  const m = objek(map.get("masa"));
  const a = objek(map.get("akses"));

  const akses: TetapanAkses = {};
  Object.entries(a).forEach(([kod, senarai]) => {
    if (Array.isArray(senarai)) {
      akses[kod] = senarai.filter((x): x is string => typeof x === "string");
    }
  });

  return {
    paparan: {
      tajuk: teks(p.tajuk, TETAPAN_ASAL.paparan.tajuk),
      pengumuman: teks(p.pengumuman, TETAPAN_ASAL.paparan.pengumuman),
    },
    masa: {
      jam_akhir_hantar: angka(
        m.jam_akhir_hantar,
        TETAPAN_ASAL.masa.jam_akhir_hantar
      ),
      hari_kerja_seminggu: angka(
        m.hari_kerja_seminggu,
        TETAPAN_ASAL.masa.hari_kerja_seminggu
      ),
      hari_kerja_sebulan: angka(
        m.hari_kerja_sebulan,
        TETAPAN_ASAL.masa.hari_kerja_sebulan
      ),
    },
    akses,
  };
}
