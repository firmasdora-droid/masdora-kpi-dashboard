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
