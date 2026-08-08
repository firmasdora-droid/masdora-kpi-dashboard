/**
 * Terima mesej dari bridge WhatsApp yang berjalan di komputer pejabat.
 *
 * Bridge (whatsapp-mcp-go) menyokong WEBHOOK_URL — ia akan POST setiap mesej
 * masuk ke sini. Kita simpan mesej group sahaja.
 *
 * Rahsia dihantar melalui query string kerana bridge menghantar bentuk
 * payload-nya sendiri yang tidak boleh kita ubah:
 *   https://.../api/ingest/whatsapp?secret=XXXX
 *
 * Bentuk payload berbeza antara versi bridge, jadi kita baca secara
 * bertoleransi — cuba beberapa nama medan yang biasa digunakan.
 */

import { createServiceClient } from "@/lib/supabase/service";

type Json = Record<string, unknown>;

function pick(obj: Json, keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

function asText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** Terima epoch (saat/milisaat) atau string ISO. */
function asTimestamp(v: unknown): string | null {
  if (v === null || v === undefined) return null;

  if (typeof v === "number") {
    const ms = v > 1e12 ? v : v * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  const s = String(v).trim();
  if (!s) return null;

  if (/^\d+$/.test(s)) {
    const n = Number(s);
    const ms = n > 1e12 ? n : n * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Cari objek mesej dalam payload — sesetengah bridge bungkus dalam wrapper. */
function unwrap(body: Json): Json {
  for (const key of ["message", "data", "payload", "event"]) {
    const inner = body[key];
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      return inner as Json;
    }
  }
  return body;
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const secret = url.searchParams.get("secret");

    if (!process.env.INGEST_SECRET) {
      return Response.json({ error: "Server belum dikonfigurasi." }, { status: 500 });
    }
    if (secret !== process.env.INGEST_SECRET) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return Response.json({ error: "Body bukan JSON." }, { status: 400 });
    }

    // Bridge mungkin hantar satu mesej atau senarai mesej
    const items: Json[] = Array.isArray(raw)
      ? (raw as Json[])
      : [raw as Json];

    const rows = items
      .map((item) => {
        const m = unwrap(item);

        const chatId = asText(
          pick(m, ["chat_id", "chatId", "chatJID", "chat_jid", "from", "chat"])
        );
        const body = asText(
          pick(m, ["body", "text", "content", "message", "caption"])
        );
        const messageId = asText(pick(m, ["id", "message_id", "messageId", "msg_id"]));

        if (!chatId || !messageId) return null;

        // Group WhatsApp sentiasa berakhir dengan @g.us
        const isGroup =
          chatId.includes("@g.us") ||
          pick(m, ["is_group", "isGroup"]) === true;
        if (!isGroup) return null; // abaikan chat peribadi

        return {
          message_id: messageId,
          chat_id: chatId,
          chat_name: asText(
            pick(m, ["chat_name", "chatName", "group_name", "groupName", "subject"])
          ),
          sender_name: asText(
            pick(m, ["sender_name", "senderName", "pushName", "push_name", "notify"])
          ),
          sender_id: asText(
            pick(m, ["sender", "sender_id", "senderId", "participant", "author"])
          ),
          body,
          sent_at:
            asTimestamp(
              pick(m, ["timestamp", "sent_at", "sentAt", "t", "messageTimestamp"])
            ) ?? new Date().toISOString(),
          is_group: true,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length === 0) {
      return Response.json({ ok: true, upserted: 0, skipped: items.length });
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("whatsapp_messages")
      .upsert(rows, { onConflict: "message_id" });

    if (error) {
      return Response.json({ error: "Gagal menyimpan mesej." }, { status: 500 });
    }

    return Response.json({
      ok: true,
      upserted: rows.length,
      skipped: items.length - rows.length,
    });
  } catch {
    return Response.json({ error: "Ralat tidak dijangka." }, { status: 500 });
  }
}

/** Sesetengah bridge memanggil GET dahulu untuk mengesahkan webhook. */
export async function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get("secret");
  if (!process.env.INGEST_SECRET || secret !== process.env.INGEST_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({ ok: true, ready: true });
}
