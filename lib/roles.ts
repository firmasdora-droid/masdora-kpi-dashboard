export type Role = "ceo" | "manager" | "member";

export function isManager(role: Role | null | undefined): boolean {
  return role === "manager";
}

export function isCeo(role: Role | null | undefined): boolean {
  return role === "ceo";
}

/** Jawatan yang layak key-in jualan (sales), sepadan dengan fungsi is_sale_eligible() di DB. */
export const SALE_ELIGIBLE_POSITIONS = [
  "CS_AGENT",
  "CS_WEB",
  "CS_SHOPEE",
  "CS_TIKTOK",
  "VID_PROD",
] as const;

export type SaleEligiblePosition = (typeof SALE_ELIGIBLE_POSITIONS)[number];

export function canKeyInSale(
  role: Role | null | undefined,
  positionCode: string | null | undefined
): boolean {
  if (role === "manager") return true;
  if (!positionCode) return false;
  return (SALE_ELIGIBLE_POSITIONS as readonly string[]).includes(positionCode);
}

/**
 * Jawatan Digital Marketing.
 *
 * Mereka hanya menguruskan perancangan & prestasi konten. Mereka TIDAK
 * menghantar To-Do List harian, tidak key-in jualan, dan tidak mengendali
 * isu pelanggan / grafik / CRM — tetapi mereka boleh melihat Leaderboard
 * jualan untuk memantau kesan konten terhadap jualan.
 */
export const DIGITAL_MARKETING_POSITIONS = ["DM", "DIG_MKT"] as const;

export function isDigitalMarketing(
  positionCode: string | null | undefined
): boolean {
  if (!positionCode) return false;
  return (DIGITAL_MARKETING_POSITIONS as readonly string[]).includes(
    positionCode
  );
}

/**
 * Adakah jawatan ini perlu menghantar To-Do List harian?
 *
 * Digunakan di halaman To-Do, laporan manager dan laporan PDF supaya
 * Digital Marketing tidak dikira sebagai "belum hantar".
 */
export function perluTodoList(
  positionCode: string | null | undefined
): boolean {
  return !isDigitalMarketing(positionCode);
}
