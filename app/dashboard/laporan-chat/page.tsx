"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { monthName } from "@/lib/period";
import AvatarInitials from "@/components/AvatarInitials";

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
  const [showTable, setShowTable] = useState(false);

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

  // Bulan terkini dipilih secara automatik supaya paparan tak terlalu padat.
  useEffect(() => {
    if (!periodFilter && periods.length > 0) setPeriodFilter(periods[0][0]);
  }, [periods, periodFilter]);

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
  const uniqueDays = new Set(filtered.map((r) => r.date)).size;
  const avgPerDay = uniqueDays > 0 ? Math.round(totalOpen / uniqueDays) : 0;

  /** Hanya platform yang benar-benar ada data — yang kosong disembunyikan. */
  const activePlatforms = useMemo(
    () =>
      PLATFORMS.map((p) => ({
        ...p,
        open: filtered.reduce(
          (s, r) => s + (r[`${p.key}Open` as keyof ChatLogRow] as number),
          0
        ),
      })).filter((p) => p.open > 0),
    [filtered]
  );

  const perHandler = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((r) => {
      map.set(r.handler, (map.get(r.handler) ?? 0) + r.totalOpen);
    });
    return Array.from(map.entries())
      .map(([handler, open]) => ({ handler, open }))
      .sort((a, b) => b.open - a.open);
  }, [filtered]);
  const maxHandler = Math.max(1, ...perHandler.map((h) => h.open));

  /** Jumlah chat setiap hari (semua handler yang dipilih digabung). */
  const perDay = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((r) => {
      map.set(r.date, (map.get(r.date) ?? 0) + r.totalOpen);
    });
    return Array.from(map.entries())
      .map(([date, open]) => ({ date, open }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered]);
  const maxDay = Math.max(1, ...perDay.map((d) => d.open));

  const periodLabel =
    periods.find(([k]) => k === periodFilter)?.[1] ?? "Semua bulan";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Laporan Chat Harian</h2>
          <p className="text-sm text-muted">
            Terus dari Google Doc — sentiasa terkini.
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

      {/* Penapis diletak di atas supaya jelas apa yang sedang dilihat */}
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
                {HANDLER_NAMES[h] ?? h}
              </option>
            ))}
          </select>
        </div>
      </motion.div>

      {loading ? (
        <p className="text-sm text-muted">Memuatkan data...</p>
      ) : filtered.length === 0 ? (
        <motion.div {...cardMotion} className="card text-center text-sm text-muted">
          Tiada rekod untuk penapis ini.
        </motion.div>
      ) : (
        <>
          {/* Satu nombor besar sahaja — apa yang paling penting */}
          <motion.div
            {...cardMotion}
            className="rounded-2xl border border-masdora-orange/25 bg-gradient-to-br from-masdora-orange/20 to-masdora-orange/5 p-6"
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Jumlah chat dibalas · {periodLabel}
              {handlerFilter ? ` · ${HANDLER_NAMES[handlerFilter] ?? handlerFilter}` : ""}
            </p>
            <p className="mt-1 text-5xl font-black text-white">
              {totalOpen.toLocaleString("ms-MY")}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              <span className="font-bold text-white">{avgPerDay}</span> chat sehari ·{" "}
              <span className="font-bold text-white">{uniqueDays}</span> hari bekerja
              {activePlatforms.length === 1 && (
                <> · semua melalui {activePlatforms[0].label}</>
              )}
            </p>
          </motion.div>

          {/* Ranking handler — hanya bila lebih daripada seorang */}
          {perHandler.length > 1 && (
            <motion.div {...cardMotion} className="card">
              <h3 className="mb-4 font-semibold text-white">Siapa Paling Banyak</h3>
              <div className="space-y-3">
                {perHandler.map((h, i) => (
                  <div key={h.handler} className="flex items-center gap-3">
                    <span className="w-5 text-center text-sm font-bold text-slate-500">
                      {i + 1}
                    </span>
                    <AvatarInitials
                      name={HANDLER_NAMES[h.handler] ?? h.handler}
                      size={32}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-bold text-slate-100">
                          {HANDLER_NAMES[h.handler] ?? h.handler}
                        </span>
                        <span className="text-sm font-black text-white">
                          {h.open.toLocaleString("ms-MY")}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-masdora-orange to-masdora-orange/60"
                          initial={{ width: 0 }}
                          animate={{ width: `${(h.open / maxHandler) * 100}%` }}
                          transition={{ duration: 0.7, delay: i * 0.08, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Platform — hanya tunjuk kalau memang guna lebih daripada satu */}
          {activePlatforms.length > 1 && (
            <motion.div {...cardMotion} className="card">
              <h3 className="mb-4 font-semibold text-white">Mengikut Platform</h3>
              <div className="space-y-3">
                {activePlatforms.map((p, i) => (
                  <div key={p.key}>
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <span className="font-semibold text-slate-200">{p.label}</span>
                      <span className="font-black text-white">
                        {p.open.toLocaleString("ms-MY")}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-masdora-olive to-masdora-olive/60"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${(p.open / activePlatforms[0].open) * 100}%`,
                        }}
                        transition={{ duration: 0.7, delay: i * 0.08, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Trend harian sebagai carta — ganti jadual panjang */}
          <motion.div {...cardMotion} className="card">
            <h3 className="mb-1 font-semibold text-white">Trend Harian</h3>
            <p className="mb-4 text-xs text-slate-400">
              Bilangan chat setiap hari · {periodLabel}
            </p>
            <div className="flex h-40 items-end gap-1.5 overflow-x-auto pb-1">
              {perDay.map((d, i) => (
                <div
                  key={d.date}
                  className="group flex min-w-[18px] flex-1 flex-col items-center gap-1.5"
                  title={`${d.date}: ${d.open} chat`}
                >
                  <span className="text-[10px] font-bold text-slate-400 opacity-0 transition group-hover:opacity-100">
                    {d.open}
                  </span>
                  <motion.div
                    className="w-full rounded-t bg-gradient-to-t from-masdora-orange/40 to-masdora-orange transition group-hover:from-masdora-orange/60"
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(4, (d.open / maxDay) * 100)}%` }}
                    transition={{
                      duration: 0.6,
                      delay: Math.min(i * 0.02, 0.5),
                      ease: "easeOut",
                    }}
                  />
                  <span className="text-[9px] text-slate-500">
                    {Number(d.date.slice(8, 10))}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Jadual penuh disorok — buka hanya kalau perlu detail */}
          <div>
            <button
              onClick={() => setShowTable((v) => !v)}
              className="btn-secondary"
            >
              {showTable ? "Sembunyikan rekod penuh" : `Lihat rekod penuh (${filtered.length})`}
            </button>

            {showTable && (
              <motion.div {...cardMotion} className="card mt-3 overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Tarikh</th>
                      <th>Handler</th>
                      {activePlatforms.map((p) => (
                        <th key={p.key}>{p.label}</th>
                      ))}
                      <th>Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={`${r.date}-${r.handler}`}>
                        <td>{r.date}</td>
                        <td className="font-semibold text-slate-100">
                          {HANDLER_NAMES[r.handler] ?? r.handler}
                        </td>
                        {activePlatforms.map((p) => (
                          <td key={p.key}>
                            {(r[`${p.key}Open` as keyof ChatLogRow] as number) || "—"}
                          </td>
                        ))}
                        <td className="font-bold text-brand-400">{r.totalOpen}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
