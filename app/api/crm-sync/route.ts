/**
 * Tarik data Recovery CRM dan simpan ke dashboard.
 *
 * Dashboard log masuk sendiri ke masdora.zo.space, baca jadual, dan
 * kemas kini jadual `recovery_records`. Tiada apa yang perlu diubah pada
 * CRM — Maisarah cuma kemas kini seperti biasa.
 *
 * Env yang diperlukan di Vercel:
 *   CRM_TEAM_PASSWORD          — kata laluan team CRM (server sahaja)
 *   SUPABASE_SERVICE_ROLE_KEY  — untuk menulis ke database
 *   INGEST_SECRET              — untuk membenarkan panggilan cron
 *
 * Cara ia dipanggil:
 *   - Halaman Recovery memanggilnya bila dibuka (pengguna perlu log masuk)
 *   - Cron Vercel memanggilnya dengan ?secret=INGEST_SECRET
 *   - ?debug=1 memulangkan struktur jadual CRM tanpa menyimpan apa-apa
 *     (manager/CEO sahaja) — untuk menyelaraskan pembaca bila lajur berubah
 */

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  ambilHalamanCrm,
  ambilStatusPasukan,
  bacaRekod,
  cubaAlamat,
  cubaDenganCookie,
  gabungStatus,
  periksaStruktur,
} from "@/lib/crm";

/** Jangan tarik lebih kerap daripada ini bila halaman dibuka. */
const COOLDOWN_MINIT = 5;

async function pemanggilDibenarkan(request: Request): Promise<
  { ok: true; manager: boolean } | { ok: false; status: number; error: string }
> {
  const url = new URL(request.url);

  // Panggilan cron / automasi
  const secret =
    url.searchParams.get("secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (secret && process.env.INGEST_SECRET && secret === process.env.INGEST_SECRET) {
    return { ok: true, manager: true };
  }

  // Panggilan dari dashboard — mesti pengguna yang sudah log masuk
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, status: 401, error: "Anda belum log masuk." };
  }

  const { data: prof } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string }>();

  return {
    ok: true,
    manager: prof?.role === "manager" || prof?.role === "ceo",
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const debug = url.searchParams.get("debug") === "1";
  const paksa = url.searchParams.get("force") === "1";

  const auth = await pemanggilDibenarkan(request);
  if (!auth.ok) {
    return Response.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  if (!process.env.CRM_TEAM_PASSWORD) {
    return Response.json(
      {
        ok: false,
        error:
          "CRM_TEAM_PASSWORD belum ditetapkan di Vercel. Rujuk PANDUAN-SAMBUNG-CRM.md.",
        perluSetup: true,
      },
      { status: 503 }
    );
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY belum ditetapkan." },
      { status: 503 }
    );
  }

  const admin = createServiceClient();

  // Elak menarik berulang kali bila beberapa orang membuka halaman serentak.
  if (!paksa && !debug) {
    const { data: terkini } = await admin
      .from("recovery_records")
      .select("synced_at")
      .order("synced_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ synced_at: string }>();

    if (terkini?.synced_at) {
      const minitLalu =
        (Date.now() - new Date(terkini.synced_at).getTime()) / 60_000;
      if (minitLalu < COOLDOWN_MINIT) {
        return Response.json({
          ok: true,
          dilangkau: true,
          sebab: `Baru disegerakkan ${Math.round(minitLalu)} minit lalu.`,
        });
      }
    }
  }

  // Mod cuba-alamat: uji satu laluan CRM menggunakan sesi yang sama.
  // Manager/CEO sahaja kerana balasannya boleh mengandungi data customer.
  const cuba = url.searchParams.get("cuba");
  if (cuba) {
    if (!auth.manager) {
      return Response.json(
        { ok: false, error: "Mod ini untuk manager & CEO sahaja." },
        { status: 403 }
      );
    }
    if (!/^\/[A-Za-z0-9_\-./?=&]{1,120}$/.test(cuba)) {
      return Response.json(
        { ok: false, error: "Laluan tidak sah." },
        { status: 400 }
      );
    }
    try {
      return Response.json({
        ok: true,
        cubaan: await cubaAlamat(process.env.CRM_TEAM_PASSWORD, cuba),
      });
    } catch (e) {
      return Response.json(
        { ok: false, error: e instanceof Error ? e.message : "Gagal." },
        { status: 502 }
      );
    }
  }

  let hasil;
  try {
    hasil = await ambilHalamanCrm(process.env.CRM_TEAM_PASSWORD);
  } catch (e) {
    return Response.json(
      {
        ok: false,
        error:
          e instanceof Error ? e.message : "Gagal menghubungi CRM.",
      },
      { status: 502 }
    );
  }

  // Mod pemeriksaan dijalankan SEBELUM semakan log masuk, supaya ia masih
  // berguna justeru bila log masuk gagal — itulah masanya kita paling
  // perlukan jejaknya.
  if (debug) {
    if (!auth.manager) {
      return Response.json(
        { ok: false, error: "Mod pemeriksaan untuk manager & CEO sahaja." },
        { status: 403 }
      );
    }
    let bilStatus = 0;
    try {
      bilStatus = (await ambilStatusPasukan(hasil.cookie)).size;
    } catch {
      // diabaikan — bahagian lain diagnosis masih berguna
    }

    // Balasan mentah endpoint status. Tanpa ini, "0 status" tidak
    // memberitahu SEBAB ia 0 — endpoint mati, ditolak, atau bentuk lain.
    let balasanStatus = null;
    try {
      balasanStatus = await cubaDenganCookie(
        hasil.cookie,
        "/api/masdora-status"
      );
    } catch (e) {
      balasanStatus = {
        url: "/api/masdora-status",
        status: 0,
        jenis: "",
        cebisan: e instanceof Error ? e.message : "gagal",
      };
    }

    return Response.json({
      ok: true,
      logMasukBerjaya: hasil.berjaya,
      // Berapa rekod yang BOLEH dibaca — angka yang paling penting.
      rekodDikenali: bacaRekod(hasil.html).length,
      statusPasukan: bilStatus,
      balasanStatus,
      jejak: hasil.jejak,
      struktur: periksaStruktur(hasil.html),
    });
  }

  if (!hasil.berjaya) {
    return Response.json(
      {
        ok: false,
        error:
          "Kata laluan CRM ditolak, atau CRM tidak memberikan sesi. Buka /api/crm-sync?debug=1 untuk melihat puncanya.",
        jejak: hasil.jejak,
      },
      { status: 401 }
    );
  }

  const html = hasil.html;

  // Status pasukan (Open/Contacted/Recovered/Lost) datang dari endpoint
  // berasingan. Kalau ia gagal, kes tetap disimpan dengan status Shopify —
  // lebih baik daripada tiada data langsung.
  let petaStatus = new Map<string, { status: string | null; note: string | null }>();
  try {
    petaStatus = await ambilStatusPasukan(hasil.cookie);
  } catch {
    // diabaikan dengan sengaja
  }

  const rekod = gabungStatus(bacaRekod(html), petaStatus);

  if (rekod.length === 0) {
    return Response.json(
      {
        ok: false,
        error:
          "Berjaya log masuk ke CRM, tetapi tiada baris data dikenali. Buka /api/crm-sync?debug=1 dan hantar hasilnya untuk melaraskan pembaca.",
        petunjuk: periksaStruktur(html),
        jejak: hasil.jejak,
      },
      { status: 422 }
    );
  }

  const now = new Date().toISOString();
  const { error } = await admin.from("recovery_records").upsert(
    rekod.map((r) => ({
      source_id: r.source_id,
      customer_name: r.customer_name,
      customer_contact: r.customer_contact,
      status: r.status,
      amount_rm: r.amount_rm,
      contacted_at: r.contacted_at,
      handler_code: r.handler,
      note: r.note,
      updated_at: now,
      synced_at: now,
    })),
    { onConflict: "source_id" }
  );

  if (error) {
    return Response.json(
      { ok: false, error: "Gagal menyimpan: " + error.message },
      { status: 500 }
    );
  }

  return Response.json({
    ok: true,
    disegerakkan: rekod.length,
    statusPasukan: petaStatus.size,
    masa: now,
  });
}
