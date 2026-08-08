"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import AvatarInitials from "@/components/AvatarInitials";

interface WaMessage {
  id: number;
  message_id: string;
  chat_id: string;
  chat_name: string | null;
  sender_name: string | null;
  sender_id: string | null;
  body: string | null;
  sent_at: string | null;
}

const cardMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const },
};

/** Kata kunci yang menunjukkan mesej itu laporan kerja siap. */
const DONE_WORDS =
  /\b(siap|done|dah|sudah|selesai|complete|settle|ok\b|beres)\b/i;

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ms-MY", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LaporanWhatsappPage() {
  const supabase = createClient();

  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [chatFilter, setChatFilter] = useState("");
  const [senderFilter, setSenderFilter] = useState("");
  const [onlyDone, setOnlyDone] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(300);

    if (qErr) {
      setError(
        "Belum bersedia. Pastikan fail add-whatsapp-reports.sql sudah di-run di Supabase."
      );
      setMessages([]);
    } else {
      setMessages((data as WaMessage[]) ?? []);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const chats = useMemo(() => {
    const map = new Map<string, string>();
    messages.forEach((m) => {
      if (!map.has(m.chat_id)) map.set(m.chat_id, m.chat_name || m.chat_id);
    });
    return Array.from(map.entries());
  }, [messages]);

  const senders = useMemo(
    () =>
      Array.from(
        new Set(messages.map((m) => m.sender_name).filter(Boolean) as string[])
      ).sort(),
    [messages]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return messages.filter((m) => {
      if (chatFilter && m.chat_id !== chatFilter) return false;
      if (senderFilter && m.sender_name !== senderFilter) return false;
      if (onlyDone && !DONE_WORDS.test(m.body ?? "")) return false;
      if (q && !(m.body ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [messages, chatFilter, senderFilter, onlyDone, search]);

  const doneCount = filtered.filter((m) => DONE_WORDS.test(m.body ?? "")).length;

  /** Bilangan laporan setiap ahli — siapa paling aktif lapor. */
  const perSender = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((m) => {
      const name = m.sender_name || "(tanpa nama)";
      map.set(name, (map.get(name) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [filtered]);
  const maxSender = Math.max(1, ...perSender.map((s) => s.count));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Laporan WhatsApp</h2>
          <p className="text-sm text-muted">
            Mesej dari group WhatsApp team — masuk automatik.
          </p>
        </div>
        <button onClick={load} className="btn-secondary" disabled={loading}>
          {loading ? "Memuatkan..." : "Muat Semula"}
        </button>
      </div>

      {error && (
        <motion.div
          {...cardMotion}
          className="card border-red-500/30 text-sm text-red-300"
        >
          {error}
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <motion.div
          {...cardMotion}
          className="rounded-2xl border border-masdora-orange/25 bg-gradient-to-br from-masdora-orange/20 to-masdora-orange/5 p-5"
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
            Jumlah Mesej
          </p>
          <p className="mt-1 text-3xl font-black text-white">
            {filtered.length}
          </p>
        </motion.div>
        <motion.div
          {...cardMotion}
          transition={{ ...cardMotion.transition, delay: 0.06 }}
          className="rounded-2xl border border-masdora-olive/35 bg-gradient-to-br from-masdora-olive/25 to-masdora-olive/5 p-5"
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
            Lapor Kerja Siap
          </p>
          <p className="mt-1 text-3xl font-black text-white">{doneCount}</p>
          <p className="mt-1 text-[11px] text-slate-400">
            mesej mengandungi &ldquo;siap / done / selesai&rdquo;
          </p>
        </motion.div>
        <motion.div
          {...cardMotion}
          transition={{ ...cardMotion.transition, delay: 0.12 }}
          className="rounded-2xl border border-masdora-yellow/25 bg-gradient-to-br from-masdora-yellow/18 to-masdora-yellow/5 p-5"
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
            Ahli Melapor
          </p>
          <p className="mt-1 text-3xl font-black text-white">
            {perSender.length}
          </p>
        </motion.div>
      </div>

      <motion.div {...cardMotion} className="card flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Group</label>
          <select
            className="input"
            value={chatFilter}
            onChange={(e) => setChatFilter(e.target.value)}
          >
            <option value="">Semua Group</option>
            {chats.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Ahli</label>
          <select
            className="input"
            value={senderFilter}
            onChange={(e) => setSenderFilter(e.target.value)}
          >
            <option value="">Semua Ahli</option>
            {senders.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[180px] flex-1">
          <label className="label">Cari</label>
          <input
            className="input"
            placeholder="Cari dalam mesej..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setOnlyDone((v) => !v)}
          className={`pill ${onlyDone ? "pill-hijau" : "pill-kosong"} h-9`}
        >
          ✅ Laporan siap sahaja
        </button>
      </motion.div>

      {perSender.length > 1 && (
        <motion.div {...cardMotion} className="card">
          <h3 className="mb-4 font-semibold text-white">Siapa Paling Aktif</h3>
          <div className="space-y-3">
            {perSender.map((s, i) => (
              <div key={s.name} className="flex items-center gap-3">
                <AvatarInitials name={s.name} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-slate-100">
                      {s.name}
                    </span>
                    <span className="text-sm font-black text-white">
                      {s.count}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-masdora-orange to-masdora-orange/60"
                      initial={{ width: 0 }}
                      animate={{ width: `${(s.count / maxSender) * 100}%` }}
                      transition={{ duration: 0.7, delay: i * 0.08 }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {loading ? (
        <p className="text-sm text-muted">Memuatkan...</p>
      ) : filtered.length === 0 ? (
        <motion.div {...cardMotion} className="card text-center text-sm text-muted">
          {messages.length === 0
            ? "Belum ada mesej. Selepas bridge WhatsApp dipasang & disambung, mesej group akan muncul di sini secara automatik."
            : "Tiada mesej untuk tapisan ini."}
        </motion.div>
      ) : (
        <div className="space-y-2">
          {filtered.map((m, i) => {
            const isDone = DONE_WORDS.test(m.body ?? "");
            return (
              <motion.div
                key={m.message_id}
                {...cardMotion}
                transition={{
                  ...cardMotion.transition,
                  delay: Math.min(i * 0.02, 0.3),
                }}
                className={`card ${isDone ? "border-masdora-olive/30" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <AvatarInitials name={m.sender_name ?? "?"} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-bold text-slate-100">
                        {m.sender_name || "(tanpa nama)"}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {fmtDate(m.sent_at)}
                        {!chatFilter && m.chat_name ? ` · ${m.chat_name}` : ""}
                      </span>
                      {isDone && (
                        <span className="pill pill-hijau ml-auto">
                          ✅ Lapor siap
                        </span>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm text-slate-300">
                      {m.body || "(tiada teks)"}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
