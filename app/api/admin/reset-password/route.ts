/**
 * Reset kata laluan ahli team — HANYA untuk manager & CEO.
 *
 * Kenapa perlu API di server (bukan terus dari pelayar):
 *   Menukar kata laluan orang lain memerlukan Supabase Admin API, yang perlu
 *   SUPABASE_SERVICE_ROLE_KEY. Kunci itu boleh melepasi SEMUA keselamatan
 *   database, jadi ia TIDAK BOLEH sesekali dihantar ke pelayar. Route ini
 *   menyimpannya di server sahaja.
 *
 * Env var yang WAJIB ditetapkan di Vercel:
 *   SUPABASE_SERVICE_ROLE_KEY=<service_role key dari Supabase>
 *
 * Peraturan keselamatan yang dikuatkuasakan di sini:
 *   1. Pemanggil WAJIB sudah log masuk (disemak melalui cookie sesi).
 *   2. Pemanggil WAJIB berperanan 'manager' atau 'ceo' — disemak dari jadual
 *      profiles di server, BUKAN dari apa yang pelayar hantar.
 *   3. Manager TIDAK BOLEH reset kata laluan manager lain atau CEO.
 *      (Kalau tidak, sesiapa yang menawan akaun manager boleh rampas akaun CEO.)
 *   4. Tiada siapa boleh reset kata laluan sendiri di sini — guna
 *      "Profil Saya" untuk itu, supaya kata laluan sendiri tidak tersalah tukar.
 *   5. Kata laluan baru dijana di server; pelayar tidak boleh menetapkannya.
 */

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const CHARS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Jana kata laluan sementara yang mudah dibaca melalui WhatsApp. */
function generatePassword(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += CHARS[bytes[i] % CHARS.length];
  // Tambah simbol & digit di hujung supaya menepati syarat kekuatan Supabase.
  return `${out}#${(bytes[0] % 90) + 10}`;
}

export async function POST(request: Request) {
  // ---------- 1) Siapa yang memanggil? ----------
  // Semakan identiti didahulukan supaya orang luar tidak dapat mengesan
  // keadaan konfigurasi pelayan hanya dengan memanggil route ini.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json(
      { ok: false, error: "Anda belum log masuk." },
      { status: 401 }
    );
  }

  // ---------- 2) Adakah dia benar-benar manager/CEO? ----------
  const { data: me } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle<{ role: string; full_name: string }>();

  if (!me || (me.role !== "manager" && me.role !== "ceo")) {
    return Response.json(
      {
        ok: false,
        error: "Hanya Marketing Manager & CEO boleh reset kata laluan team.",
      },
      { status: 403 }
    );
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json(
      {
        ok: false,
        error:
          "Fungsi ini belum disiapkan sepenuhnya: SUPABASE_SERVICE_ROLE_KEY belum ditetapkan di Vercel. Rujuk fail PANDUAN-RESET-PASSWORD.md.",
      },
      { status: 503 }
    );
  }

  // ---------- 3) Siapa sasarannya? ----------
  let targetId: unknown;
  try {
    ({ userId: targetId } = await request.json());
  } catch {
    return Response.json(
      { ok: false, error: "Permintaan tidak sah." },
      { status: 400 }
    );
  }

  if (typeof targetId !== "string" || targetId.length < 10) {
    return Response.json(
      { ok: false, error: "Pengguna sasaran tidak dinyatakan." },
      { status: 400 }
    );
  }

  if (targetId === user.id) {
    return Response.json(
      {
        ok: false,
        error:
          "Untuk menukar kata laluan sendiri, guna halaman Profil Saya.",
      },
      { status: 400 }
    );
  }

  const admin = createServiceClient();

  const { data: target } = await admin
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("id", targetId)
    .maybeSingle<{
      id: string;
      full_name: string;
      email: string;
      role: string;
    }>();

  if (!target) {
    return Response.json(
      { ok: false, error: "Pengguna tidak dijumpai." },
      { status: 404 }
    );
  }

  // Manager hanya boleh reset ahli biasa. CEO boleh reset manager juga,
  // tetapi tiada siapa boleh reset akaun CEO melalui fungsi ini.
  if (target.role === "ceo") {
    return Response.json(
      {
        ok: false,
        error:
          "Akaun CEO tidak boleh direset di sini. Ia perlu dibuat terus di Supabase.",
      },
      { status: 403 }
    );
  }
  if (me.role === "manager" && target.role !== "member") {
    return Response.json(
      {
        ok: false,
        error:
          "Manager hanya boleh reset kata laluan ahli team, bukan manager lain.",
      },
      { status: 403 }
    );
  }

  // ---------- 4) Tukar kata laluan ----------
  const newPassword = generatePassword();

  const { error } = await admin.auth.admin.updateUserById(target.id, {
    password: newPassword,
  });

  if (error) {
    return Response.json(
      { ok: false, error: "Gagal menukar kata laluan: " + error.message },
      { status: 500 }
    );
  }

  // Jangan sesekali log kata laluan itu. Ia hanya dipulangkan sekali kepada
  // manager yang memintanya, untuk disampaikan kepada ahli berkenaan.
  return Response.json({
    ok: true,
    fullName: target.full_name,
    email: target.email,
    newPassword,
  });
}
