"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { monthName } from "@/lib/period";

interface ChatLogRow {
  date: string;
  year: number;
  month: number;
  handler: string;
  whatsappOpen: number;
  whatsappClose: number;
  telegramOpen: number;
  telegramClose: number;
  instagramOpen: number;
  instagramClose: number;
  tiktokOpen: number;
  tiktokClose: number;
  webOpen: number;
  webClose: number;
  totalOpen: number;
  totalClose: number;
}

const DOC_URL =
  "https://docs.google.com/document/d/14yACfwqebYdz7m-8PU5MCtu9quoB2TnbSkquHeLoZn4/edit";

/** Nama sebenar bagi kod handler dalam laporan. */
const HANDLER_NAMES: Record<string, string> = {
  MAI: "Maisarah",
  TI: "Najjati",
  HAWA: "Natasya",
};

const cardMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const },
};

const STAT_ACCENTS = [
  "from-masdora-orange/20 to-masdora-orange/5 border-masdora-orange/25",
  "from-masdora-olive/25 to-masdora-olive/5 border-masdora-olive/35",
  "from-masdora-yellow/18 to-masdora-yellow/5 border-masdora-yellow/25",
  "from-masdora-gray/15 to-masdora-gray/5 border-masdora-gray/25",
];

const PLATFORMS = [
  { key: "whatsapp", label: "WhatsApp" },
  { key: "telegram", label: "Telegram" },
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "web", label: "Web" },
] as const;

export default function LaporanChatPage() {
  const [rows, setRows] = useState<ChatLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [periodFilter, setPeriodFilter] = useState("");
  const [handlerFilter, setHandlerFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cs-chat-report", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Gagal memuatkan data.");
        setRows([]);
      } else {
        setRows(json.rows as ChatLogRow[]);
      }
    } catch {
      setError("Gagal menghubungi Google Doc.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const periods = useMemo(() => {
    const set = new Map<string, string>();
    rows.forEach((r) => {
      const key = `${r.year}-${String(r.month).padStart(2, "0")}`;
      set.set(key, `${monthName(r.month)} ${r.year}`);
    });
    return Array.from(set.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  const handlers = useMemo(
    () => Array.from(new Set(rows.map((r) => r.handler))).sort(),
    [rows]
  );

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const key = `${r.year}-${String(r.month).padStart(2, "0")}`;
        if (periodFilter && key !== periodFilter) return false;
        if (handlerFilter && r.handler !== handlerFilter) return false;
        return true;
      }),
    [rows, periodFilter, handlerFilter]
  );

  const totalOpen = filtered.reduce((s, r) => s + r.totalOpen, 0);
  const totalClose = filtered.reduce((s, r) => s + r.totalClose, 0);
  const uniqueDays = new Set(filtered.map((r) => r.date)).size;

  const platformTotals = useMemo(
    () =>
      PLATFORMS.map((p) => ({
        ...p,
        open: filtered.reduce(
          (s, r) => s + (r[`${p.key}Open` as keyof ChatLogRow] as number),
          0
        ),
        close: filtered.reduce(
          (s, r) => s + (r[`${p.key}Close` as keyof ChatLogRow] as number),
          0
        ),
      })),
    [filtered]
  );
  const maxPlatformOpen = Math.max(1, ...platformTotals.map((p) => p.open));

  const perHandler = useMemo(() => {
    const map = new Map<string, { open: number; close: number; days: Set<string> }>();
    filtered.forEach((r) => {
      const cur = map.get(r.handler) ?? { open: 0, close: 0, days: new Set<string>() };
      cur.open += r.totalOpen;
      cur.close += r.totalClose;
      cur.days.add(r.date);
      map.set(r.handler, cur);
    });
    return Array.from(map.entries())
      .map(([handler, v]) => ({
        handler,
        open: v.open,
        close: v.close,
        days: v.days.size,
      }))
      .sort((a, b) => b.open - a.open);
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Laporan Chat Harian</h2>
          <p className="text-sm text-muted">
            Terus dari Google Doc &ldquo;Daily Chat Report&rdquo; — sentiasa terkini.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary" disabled={loading}>
            {loading ? "Memuatkan..." : "Muat Semula"}
          </button>
          <a
            href={DOC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            Buka Doc
          </a>
        </div>
      </div>

      {error && (
        <motion.div
          {...cardMotion}
          className="card border-red-500/30 text-sm text-red-300"
        >
          {error}
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          index={0}
          icon="💬"
          label="Chat Dibuka"
          value={totalOpen.toLocaleString("ms-MY")}
          caption="semua platform"
        />
        <StatCard
          index={1}
          icon="✅"
          label="Chat Ditutup"
          value={totalClose.toLocaleString("ms-MY")}
          caption="selesai dilayan"
        />
        <StatCard
          index={2}
          icon="📅"
          label="Hari Direkod"
          value={String(uniqueDays)}
          caption={periodFilter ? "dalam tempoh dipilih" : "keseluruhan"}
        />
        <StatCard
          index={3}
          icon="👥"
          label="Purata Sehari"
          value={uniqueDays > 0 ? Math.round(totalOpen / uniqueDays).toLocaleString("ms-MY") : "0"}
          caption="chat dibuka / hari"
        />
      </div>

      <motion.div {...cardMotion} className="card flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Bulan</label>
          <select
            className="input"
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
          >
            <option value="">Semua Bulan</option>
            {periods.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Handler</label>
          <select
            className="input"
            value={handlerFilter}
            onChange={(e) => setHandlerFilter(e.target.value)}
          >
            <option value="">Semua Handler</option>
            {handlers.map((h) => (
              <option key={h} value={h}>
                {HANDLER_NAMES[h] ? `${HANDLER_NAMES[h]} (${h})` : h}
              </option>
            ))}
          </select>
        </div>
      </motion.div>

      {loading ? (
        <p className="text-sm text-muted">Memuatkan data dari Google Doc...</p>
      ) : filtered.length === 0 ? (
        <motion.div {...cardMotion} className="card text-center text-sm text-muted">
          Tiada rekod untuk penapis ini.
        </motion.div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <motion.div {...cardMotion} className="card">
              <h3 className="mb-4 font-semibold text-white">
                Chat Mengikut Platform
              </h3>
              <div className="space-y-3">
                {platformTotals.map((p, i) => (
                  <div key={p.key}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-200">{p.label}</span>
                      <span className="text-slate-400">
                        <span className="font-bold text-white">
                          {p.open.toLocaleString("ms-MY")}
                        </span>{" "}
                        dibuka · {p.close.toLocaleString("ms-MY")} ditutup
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-masdora-orange to-masdora-orange/60"
                        initial={{ width: 0 }}
                        animate={{ width: `${(p.open / maxPlatformOpen) * 100}%` }}
                        transition={{ duration: 0.7, delay: i * 0.08, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div {...cardMotion} className="card">
              <h3 className="mb-4 font-semibold text-white">Prestasi Handler</h3>
              <div className="space-y-3">
                {perHandler.map((h, i) => (
                  <motion.div
                    key={h.handler}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.06 }}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                  >
                    <span className="w-6 text-center text-sm font-bold text-slate-400">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-100">
                        {HANDLER_NAMES[h.handler] ?? h.handler}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {h.handler} · {h.days} hari direkod
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-white">
                        {h.open.toLocaleString("ms-MY")}
                      </p>
                      <p className="text-[11px] text-slate-500">chat dibuka</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-white">
              Rekod Harian ({filtered.length})
            </h3>
            <motion.div {...cardMotion} className="card overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Tarikh</th>
                    <th>Handler</th>
                    <th>WhatsApp</th>
                    <th>Telegram</th>
                    <th>Instagram</th>
                    <th>TikTok</th>
                    <th>Web</th>
                    <th>Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 200).map((r) => (
                    <tr key={`${r.date}-${r.handler}`}>
                      <td>{r.date}</td>
                      <td>
                        <span className="font-semibold text-slate-100">
                          {HANDLER_NAMES[r.handler] ?? r.handler}
                        </span>
                      </td>
                      <td>{cell(r.whatsappOpen, r.whatsappClose)}</td>
                      <td>{cell(r.telegramOpen, r.telegramClose)}</td>
                      <td>{cell(r.instagramOpen, r.instagramClose)}</td>
                      <td>{cell(r.tiktokOpen, r.tiktokClose)}</td>
                      <td>{cell(r.webOpen, r.webClose)}</td>
                      <td>
                        <span className="font-bold text-brand-400">
                          {r.totalOpen}
                        </span>
                        <span className="text-slate-500"> / {r.totalClose}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 200 && (
                <p className="mt-3 text-xs text-muted">
                  Menunjukkan 200 rekod terkini daripada {filtered.length}. Guna
                  penapis bulan untuk lihat tempoh lain.
                </p>
              )}
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
}

function cell(open: number, close: number) {
  if (open === 0 && close === 0) return <span className="text-slate-600">—</span>;
  return (
    <span>
      {open}
      <span className="text-slate-500"> / {close}</span>
    </span>
  );
}

function StatCard({
  icon,
  label,
  value,
  caption,
  index = 0,
}: {
  icon: string;
  label: string;
  value: string;
  caption: string;
  index?: number;
}) {
  return (
    <motion.div
      {...cardMotion}
      transition={{ ...cardMotion.transition, delay: index * 0.06 }}
      className={`rounded-2xl border bg-gradient-to-br p-4 ${
        STAT_ACCENTS[index % STAT_ACCENTS.length]
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
          {label}
        </span>
        <span className="text-lg" aria-hidden>
          {icon}
        </span>
      </div>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 truncate text-[11px] text-slate-400">{caption}</p>
    </motion.div>
  );
}
