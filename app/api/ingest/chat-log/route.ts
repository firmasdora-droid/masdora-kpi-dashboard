// Webhook ingest: "Daily Chat Report" (Google Doc) -> cs_chat_log -> KPI CSA02.
//
// Dipanggil oleh google-apps-script/chat-log-sync.gs setiap 15 minit.
// Auth: header body { secret } mesti sepadan dengan env var INGEST_SECRET.
//
// Env var yang perlu ditetapkan di Vercel:
//   INGEST_SECRET=<rentetan rawak yang sama dengan SECRET dalam .gs>
//   SUPABASE_SERVICE_ROLE_KEY=<service_role key Supabase>
//
// Selepas upsert cs_chat_log, kira semula jumlah 5 kolum OPEN (whatsapp/telegram/
// instagram/tiktok/web) bagi setiap (handler_code, year, month, week) yang
// tersentuh dalam batch ini, resolve handler_code -> user_id via profiles.handler_code,
// dan upsert kpi_entries { kpi_id: 'CSA02', actual: <jumlah> }.

import { createServiceClient } from "@/lib/supabase/service";

interface ChatLogRow {
  date: string; // YYYY-MM-DD
  handler: "MAI" | "HAWA" | "TI";
  whatsapp_open?: number;
  whatsapp_close?: number;
  telegram_open?: number;
  telegram_close?: number;
  instagram_open?: number;
  instagram_close?: number;
  tiktok_open?: number;
  tiktok_close?: number;
  web_open?: number;
  web_close?: number;
}

interface ChatLogBody {
  secret: string;
  rows: ChatLogRow[];
}

const VALID_HANDLERS = new Set(["MAI", "HAWA", "TI"]);

// Sepadan dengan week_of() dalam sync-schema-and-tables.sql dan
// getCurrentWeekOfMonth() dalam lib/period.ts — kekalkan ketiga-tiganya sama.
function weekOfMonth(day: number): number {
  return Math.min(4, Math.max(1, Math.ceil(day / 7)));
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(req: Request) {
  let body: ChatLogBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body.secret !== "string") {
    return Response.json({ error: "Missing secret" }, { status: 400 });
  }
  if (body.secret !== process.env.INGEST_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!Array.isArray(body.rows)) {
    return Response.json({ error: "rows must be an array" }, { status: 400 });
  }

  try {
    const supabase = createServiceClient();

    const validRows = body.rows.filter(
      (r) =>
        r &&
        typeof r.date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
        VALID_HANDLERS.has(r.handler)
    );

    if (validRows.length === 0) {
      return Response.json({ ok: true, upserted: 0, kpiRowsUpdated: 0 });
    }

    const upsertPayload = validRows.map((r) => ({
      log_date: r.date,
      handler_code: r.handler,
      whatsapp_open: num(r.whatsapp_open),
      whatsapp_close: num(r.whatsapp_close),
      telegram_open: num(r.telegram_open),
      telegram_close: num(r.telegram_close),
      instagram_open: num(r.instagram_open),
      instagram_close: num(r.instagram_close),
      tiktok_open: num(r.tiktok_open),
      tiktok_close: num(r.tiktok_close),
      web_open: num(r.web_open),
      web_close: num(r.web_close),
    }));

    const { error: upsertError } = await supabase
      .from("cs_chat_log")
      .upsert(upsertPayload, { onConflict: "log_date,handler_code" });

    if (upsertError) {
      console.error("cs_chat_log upsert failed:", upsertError.message);
      return Response.json({ error: "Database error" }, { status: 500 });
    }

    // Kumpul set unik (handler_code, year, month, week) yang tersentuh
    const buckets = new Map<
      string,
      { handler_code: string; year: number; month: number; week: number }
    >();
    for (const r of validRows) {
      const [y, m, d] = r.date.split("-").map((x) => parseInt(x, 10));
      const week = weekOfMonth(d);
      const key = `${r.handler}-${y}-${m}-${week}`;
      buckets.set(key, { handler_code: r.handler, year: y, month: m, week });
    }

    // Cache handler_code -> user_id
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, handler_code")
      .not("handler_code", "is", null);

    if (profilesError) {
      console.error("profiles lookup failed:", profilesError.message);
      return Response.json({ error: "Database error" }, { status: 500 });
    }

    const handlerToUserId = new Map<string, string>();
    for (const p of profiles ?? []) {
      if (p.handler_code) handlerToUserId.set(p.handler_code, p.id);
    }

    let kpiRowsUpdated = 0;

    for (const bucket of buckets.values()) {
      const userId = handlerToUserId.get(bucket.handler_code);
      if (!userId) continue; // tiada profile sepadan handler_code ini — skip senyap

      // Julat tarikh bagi minggu ini dalam bulan berkenaan
      const monthStr = String(bucket.month).padStart(2, "0");
      const startDay = (bucket.week - 1) * 7 + 1;
      const lastDayOfMonth = new Date(bucket.year, bucket.month, 0).getDate();
      const endDay = bucket.week === 4 ? lastDayOfMonth : Math.min(bucket.week * 7, lastDayOfMonth);
      const startDate = `${bucket.year}-${monthStr}-${String(startDay).padStart(2, "0")}`;
      const endDate = `${bucket.year}-${monthStr}-${String(endDay).padStart(2, "0")}`;

      const { data: weekRows, error: sumError } = await supabase
        .from("cs_chat_log")
        .select(
          "whatsapp_open, telegram_open, instagram_open, tiktok_open, web_open"
        )
        .eq("handler_code", bucket.handler_code)
        .gte("log_date", startDate)
        .lte("log_date", endDate);

      if (sumError) {
        console.error("cs_chat_log week sum failed:", sumError.message);
        continue;
      }

      const total = (weekRows ?? []).reduce(
        (sum, row) =>
          sum +
          num(row.whatsapp_open) +
          num(row.telegram_open) +
          num(row.instagram_open) +
          num(row.tiktok_open) +
          num(row.web_open),
        0
      );

      const { error: kpiError } = await supabase.from("kpi_entries").upsert(
        {
          user_id: userId,
          kpi_id: "CSA02",
          year: bucket.year,
          month: bucket.month,
          week: bucket.week,
          actual: total,
          updated_by: null,
        },
        { onConflict: "user_id,kpi_id,year,month,week" }
      );

      if (kpiError) {
        console.error("kpi_entries upsert failed:", kpiError.message);
        continue;
      }

      kpiRowsUpdated++;
    }

    return Response.json({
      ok: true,
      upserted: upsertPayload.length,
      kpiRowsUpdated,
    });
  } catch (err) {
    console.error("chat-log ingest error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
