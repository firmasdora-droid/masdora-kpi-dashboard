// Webhook ingest: "Customer Issue Report" (Google Sheet) -> cs_issue_log -> KPI CSA03.
//
// Dipanggil oleh google-apps-script/issue-report-sync.gs setiap 15 minit.
// Auth: header body { secret } mesti sepadan dengan env var INGEST_SECRET.
//
// Env var yang perlu ditetapkan di Vercel:
//   INGEST_SECRET=<rentetan rawak yang sama dengan SECRET dalam .gs>
//   SUPABASE_SERVICE_ROLE_KEY=<service_role key Supabase>
//
// Selepas upsert cs_issue_log, kira semula bilangan isu per (handler_code, year,
// month, week) yang tersentuh dalam batch ini, resolve handler_code -> user_id
// via profiles.handler_code, dan upsert kpi_entries { kpi_id: 'CSA03', actual: <count> }.

import { createServiceClient } from "@/lib/supabase/service";

interface IssueRow {
  source_row_id: string;
  reported_at: string | null; // YYYY-MM-DD
  username?: string | null;
  platform?: string | null;
  description?: string | null;
  solution?: string | null;
  handler: "MAI" | "HAWA" | "TI" | null;
}

interface IssueBody {
  secret: string;
  rows: IssueRow[];
}

const VALID_HANDLERS = new Set(["MAI", "HAWA", "TI"]);

// Sepadan dengan week_of() dalam sync-schema-and-tables.sql dan
// getCurrentWeekOfMonth() dalam lib/period.ts — kekalkan ketiga-tiganya sama.
function weekOfMonth(day: number): number {
  return Math.min(4, Math.max(1, Math.ceil(day / 7)));
}

export async function POST(req: Request) {
  let body: IssueBody;
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

    // Boleh bucket ke minggu hanya jika ada handler dan reported_at yang sah
    const validRows = body.rows.filter(
      (r) =>
        r &&
        typeof r.source_row_id === "string" &&
        r.source_row_id.length > 0 &&
        typeof r.handler === "string" &&
        VALID_HANDLERS.has(r.handler) &&
        typeof r.reported_at === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(r.reported_at)
    );

    if (validRows.length === 0) {
      return Response.json({ ok: true, upserted: 0, kpiRowsUpdated: 0 });
    }

    const upsertPayload = validRows.map((r) => ({
      source_row_id: r.source_row_id,
      reported_at: r.reported_at,
      username: r.username ?? null,
      platform: r.platform ?? null,
      description: r.description ?? null,
      solution: r.solution ?? null,
      handler_code: r.handler,
    }));

    const { error: upsertError } = await supabase
      .from("cs_issue_log")
      .upsert(upsertPayload, { onConflict: "source_row_id" });

    if (upsertError) {
      console.error("cs_issue_log upsert failed:", upsertError.message);
      return Response.json({ error: "Database error" }, { status: 500 });
    }

    // Kumpul set unik (handler_code, year, month, week) yang tersentuh
    const buckets = new Map<
      string,
      { handler_code: string; year: number; month: number; week: number }
    >();
    for (const r of validRows) {
      const [y, m, d] = r.reported_at!.split("-").map((x) => parseInt(x, 10));
      const week = weekOfMonth(d);
      const key = `${r.handler}-${y}-${m}-${week}`;
      buckets.set(key, { handler_code: r.handler as string, year: y, month: m, week });
    }

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

      const monthStr = String(bucket.month).padStart(2, "0");
      const startDay = (bucket.week - 1) * 7 + 1;
      const lastDayOfMonth = new Date(bucket.year, bucket.month, 0).getDate();
      const endDay = bucket.week === 4 ? lastDayOfMonth : Math.min(bucket.week * 7, lastDayOfMonth);
      const startDate = `${bucket.year}-${monthStr}-${String(startDay).padStart(2, "0")}`;
      const endDate = `${bucket.year}-${monthStr}-${String(endDay).padStart(2, "0")}`;

      const { count, error: countError } = await supabase
        .from("cs_issue_log")
        .select("id", { count: "exact", head: true })
        .eq("handler_code", bucket.handler_code)
        .gte("reported_at", startDate)
        .lte("reported_at", endDate);

      if (countError) {
        console.error("cs_issue_log week count failed:", countError.message);
        continue;
      }

      const { error: kpiError } = await supabase.from("kpi_entries").upsert(
        {
          user_id: userId,
          kpi_id: "CSA03",
          year: bucket.year,
          month: bucket.month,
          week: bucket.week,
          actual: count ?? 0,
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
    console.error("issues ingest error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
