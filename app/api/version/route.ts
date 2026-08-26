/**
 * Commit mana yang sedang live.
 *
 * Sepanjang menyiapkan integrasi CRM, banyak masa terbuang kerana tidak
 * pasti sama ada perubahan sudah sampai ke laman atau belum — dan tekaan
 * berdasarkan hash fail adalah salah, kerana Vercel menghasilkan hash
 * berbeza daripada binaan tempatan.
 *
 * Route ini menjawabnya secara pasti. Ia tidak mendedahkan apa-apa rahsia:
 * SHA commit repositori awam dan masa binaan sahaja.
 */
export const dynamic = "force-static";

export function GET() {
  return Response.json({
    sha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "tempatan",
    mesej: process.env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0] ?? null,
    cabang: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    dibina: new Date().toISOString(),
  });
}
