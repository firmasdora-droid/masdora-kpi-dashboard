"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

interface CsIssue {
  monthTab: string;
  rowIndex: number;
  reportedAt: string | null;
  rawDate: string;
  username: string;
  platform: string;
  description: string;
  solution: string;
  handler: string;
}

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1TqDoXOfECRElTd2QOKFPH9OmFKP2flQGqke0dp47PYA/edit";

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

export default function IsuPelangganPage() {
  const [issues, setIssues] = useState<CsIssue[]>([]);
  const [tabs, setTabs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [monthFilter, setMonthFilter] = useState("");
  const [handlerFilter, setHandlerFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cs-issues", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Gagal memuatkan data.");
        setIssues([]);
      } else {
        setIssues(json.issues as CsIssue[]);
        setTabs((json.tabs as string[]) ?? []);
      }
    } catch {
      setError("Gagal menghubungi Google Sheet.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handlers = useMemo(
    () => Array.from(new Set(issues.map((i) => i.handler).filter(Boolean))).sort(),
    [issues]
  );
  const platforms = useMemo(
    () => Array.from(new Set(issues.map((i) => i.platform).filter(Boolean))).sort(),
    [issues]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return issues.filter((i) => {
      if (monthFilter && i.monthTab !== monthFilter) return false;
      if (handlerFilter && i.handler !== handlerFilter) return false;
      if (platformFilter && i.platform !== platformFilter) return false;
      if (q) {
        const hay = `${i.username} ${i.description} ${i.solution} ${i.platform} ${i.handler}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [issues, monthFilter, handlerFilter, platformFilter, search]);

  const settled = filtered.filter((i) => i.solution.trim().length > 0).length;
  const pending = filtered.length - settled;
  const settledPct =
    filtered.length > 0 ? Math.round((settled / filtered.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Isu Pelanggan</h2>
          <p className="text-sm text-muted">
            Terus dari Google Sheet &ldquo;Customer Issue Report&rdquo; — semua bulan,
            sentiasa terkini.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary" disabled={loading}>
            {loading ? "Memuatkan..." : "Muat Semula"}
          </button>
          <a
            href={SHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            Buka Sheet
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
          icon="📋"
          label="Jumlah Isu"
          value={String(filtered.length)}
          caption={
            monthFilter || handlerFilter || platformFilter || search
              ? `daripada ${issues.length} keseluruhan`
              : "semua bulan"
          }
        />
        <StatCard
          index={1}
          icon="✅"
          label="Ada Penyelesaian"
          value={String(settled)}
          caption={`${settledPct}% direkod selesai`}
        />
        <StatCard
          index={2}
          icon="⏳"
          label="Belum Direkod"
          value={String(pending)}
          caption="ruangan solution kosong"
        />
        <StatCard
          index={3}
          icon="👥"
          label="Handler Aktif"
          value={String(handlers.length)}
          caption={handlers.join(", ") || "-"}
        />
      </div>

      <motion.div {...cardMotion} className="card flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Bulan</label>
          <select
            className="input"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          >
            <option value="">Semua Bulan</option>
            {tabs.map((t) => (
              <option key={t} value={t}>
                {t}
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
                {h}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Platform</label>
          <select
            className="input"
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
          >
            <option value="">Semua Platform</option>
            {platforms.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="label">Cari</label>
          <input
            className="input"
            placeholder="Nama pelanggan, masalah, penyelesaian..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </motion.div>

      {loading ? (
        <p className="text-sm text-muted">Memuatkan data dari Google Sheet...</p>
      ) : filtered.length === 0 ? (
        <motion.div {...cardMotion} className="card text-center text-sm text-muted">
          Tiada isu yang sepadan dengan penapis ini.
        </motion.div>
      ) : (
        <div className="space-y-3">
          {filtered.map((issue, i) => (
            <motion.div
              key={`${issue.monthTab}-${issue.rowIndex}`}
              {...cardMotion}
              transition={{ ...cardMotion.transition, delay: Math.min(i * 0.03, 0.4) }}
              className="card"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="pill pill-oren">{issue.handler || "—"}</span>
                <span className="pill pill-kosong">{issue.platform || "—"}</span>
                <span className="text-xs text-slate-400">
                  {issue.reportedAt || issue.rawDate || "Tiada tarikh"} ·{" "}
                  {issue.monthTab}
                </span>
                <span
                  className={`pill ml-auto ${
                    issue.solution.trim() ? "pill-hijau" : "pill-kuning"
                  }`}
                >
                  {issue.solution.trim() ? "Ada penyelesaian" : "Belum direkod"}
                </span>
              </div>

              <p className="text-sm font-bold text-slate-100">
                {issue.username || "(tiada username)"}
              </p>

              <p className="mt-1 whitespace-pre-line text-sm text-slate-300">
                {issue.description || "-"}
              </p>

              {issue.solution.trim() && (
                <div className="mt-3 rounded-lg border border-masdora-olive/30 bg-masdora-olive/10 p-3">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-masdora-olive">
                    Penyelesaian
                  </p>
                  <p className="whitespace-pre-line text-sm text-slate-200">
                    {issue.solution}
                  </p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
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
