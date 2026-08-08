/**
 * Terima data dari Masdora Recovery CRM (masdora.zo.space).
 *
 * CRM hantar POST ke sini setiap kali rekod dikemas kini. Rekod disimpan
 * dalam jadual `recovery_records` dan dipaparkan dalam dashboard.
 *
 * Env yang diperlukan (sudah ada di Vercel):
 *   INGEST_SECRET              — kata rahsia yang mesti sama dengan CRM
 *   SUPABASE_SERVICE_ROLE_KEY  — untuk tulis ke database (server sahaja)
 *
 * Contoh body:
 * {
 *   "secret": "...",
 *   "rows": [
 *     {
 *       "source_id": "rec-1024",
 *       "customer_name": "Siti",
 *       "customer_contact": "60123456789",
 *       "status": "pulih",
 *       "amount_rm": 250.00,
 *       "contacted_at": "2026-08-07",
 *       "handler": "MAI",
 *       "note": "follow up kedua"
 *     }
 *   ]
 * }
 */

import { createServiceClient } from "@/lib/supabase/service";

interface IncomingRow {
  source_id?: unknown;
  customer_name?: unknown;
  customer_contact?: unknown;
  status?: unknown;
  amount_rm?: unknown;
  contacted_at?: unknown;
  handler?: unknown;
  note?: unknown;
}

function asText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function asNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Terima "2026-08-07" atau "7/8/2026" dan pulangkan ISO. */
function asDate(v: unknown): string | null {
  const s = asText(v);
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const pad = (x: string) => x.padStart(2, "0");
    return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  }
  return null;
}

export async function POST(request: Request) {
  try {
    let body: { secret?: unknown; rows?: unknown };
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Body bukan JSON yang sah." }, { status: 400 });
    }

    if (!process.env.INGEST_SECRET) {
      return Response.json({ error: "Server belum dikonfigurasi." }, { status: 500 });
    }
    if (body.secret !== process.env.INGEST_SECRET) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!Array.isArray(body.rows)) {
      return Response.json({ error: "Medan 'rows' mesti array." }, { status: 400 });
    }

    const rows = (body.rows as IncomingRow[])
      .map((r) => {
        const sourceId = asText(r.source_id);
        if (!sourceId) return null; // wajib — tanpa ini rekod tak boleh dikemas kini
        return {
          source_id: sourceId,
          customer_name: asText(r.customer_name),
          customer_contact: asText(r.customer_contact),
          status: asText(r.status),
          amount_rm: asNumber(r.amount_rm),
          contacted_at: asDate(r.contacted_at),
          handler_code: asText(r.handler)?.toUpperCase() ?? null,
          note: asText(r.note),
          updated_at: new Date().toISOString(),
          synced_at: new Date().toISOString(),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length === 0) {
      return Response.json({ ok: true, upserted: 0, skipped: (body.rows as unknown[]).length });
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("recovery_records")
      .upsert(rows, { onConflict: "source_id" });

    if (error) {
      return Response.json(
        { error: "Gagal menyimpan rekod." },
        { status: 500 }
      );
    }

    return Response.json({
      ok: true,
      upserted: rows.length,
      skipped: (body.rows as unknown[]).length - rows.length,
    });
  } catch {
    return Response.json({ error: "Ralat tidak dijangka." }, { status: 500 });
  }
}
