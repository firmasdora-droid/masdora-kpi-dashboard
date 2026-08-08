"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

type CampaignStatus =
  | "dilancarkan"
  | "dalam_proses"
  | "ditangguh"
  | "dirancang";

interface CampaignItem {
  rowIndex: number;
  quarter: string;
  month: string;
  product: string;
  category: string;
  weight: string;
  launchDate: string;
  launchIso: string | null;
  status: CampaignStatus;
  statusRaw: string;
  remarks: string;
  daysAway: number | null;
}

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1f-T7YGO6u8B_loX3FMHLX9B_TOUX82GlOU9fFnBZ0J0/edit";

const cardMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const },
};

const STATUSES: {
  key: CampaignStatus;
  label: string;
  pill: string;
  icon: string;
  accent: string;
}[] = [
  {
    key: "dalam_proses",
    label: "Dalam Proses",
    pill: "pill-kuning",
    icon: "⏳",
    accent: "from-masdora-yellow/18 to-masdora-yellow/5 border-masdora-yellow/25",
  },
  {
    key: "dirancang",
    label: "Dirancang",
    pill: "pill-kosong",
    icon: "🗓️",
    accent: "from-masdora-gray/15 to-masdora-gray/5 border-masdora-gray/25",
  },
  {
    key: "dilancarkan",
    label: "Dilancarkan",
    pill: "pill-hijau",
    icon: "✅",
    accent: "from-masdora-olive/25 to-masdora-olive/5 border-masdora-olive/35",
  },
  {
    key: "ditangguh",
    label: "Ditangguh",
    pill: "pill-merah",
    icon: "⏸️",
    accent: "from-masdora-alert/20 to-masdora-alert/5 border-masdora-alert/25",
  },
];

const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.key, s]));

function countdownLabel(days: number | null): string | null {
  if (days === null) return null;
  if (days === 0) return "Hari ini!";
  if (days === 1) return "Esok";
  if (days > 0) return `${days} hari lagi`;
  if (days >= -7) return `${Math.abs(days)} hari lepas`;
  return null;
}

export default function CampaignsPage() {
  const [items, setItems] = useState<CampaignItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "">("");
  const [monthFilter, setMonthFilter] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async (fresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaign-log${fresh ? "?fresh=1" : ""}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Gagal memuatkan data.");
        setItems([]);
      } else {
        setItems(json.items as CampaignItem[]);
        setRefreshedAt(
          new Date().toLocaleTimeString("ms-MY", {
            hour: "2-digit",
            minute: "2-digit",
          })
        );
      }
    } catch {
      setError("Gagal menghubungi Google Sheet.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const months = useMemo(
    () => Array.from(new Set(items.map((i) => i.month).filter(Boolean))),
    [items]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (statusFilter && i.status !== statusFilter) return false;
      if (monthFilter && i.month !== monthFilter) return false;
      if (q) {
        const hay = `${i.product} ${i.category} ${i.remarks}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, statusFilter, monthFilter, search]);

  const counts = useMemo(() => {
    const c: Record<CampaignStatus, number> = {
      dilancarkan: 0,
      dalam_proses: 0,
      ditangguh: 0,
      dirancang: 0,
    };
    items.forEach((i) => c[i.status]++);
    return c;
  }, [items]);

  /** Pelancaran akan datang dalam 30 hari — untuk kesedaran seluruh team. */
  const upcoming = useMemo(
    () =>
      items
        .filter(
          (i) =>
            i.daysAway !== null &&
            i.daysAway >= 0 &&
            i.daysAway <= 30 &&
            i.status !== "ditangguh"
        )
        .sort((a, b) => (a.daysAway ?? 0) - (b.daysAway ?? 0))
        .slice(0, 4),
    [items]
  );

  /** Kumpul mengikut bulan supaya senang dibaca. */
  const grouped = useMemo(() => {
    const map = new Map<string, CampaignItem[]>();
    filtered.forEach((i) => {
      const key = i.month || "Tiada Bulan";
      const arr = map.get(key) ?? [];
      arr.push(i);
      map.set(key, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Kempen & Pelancaran</h2>
          <p className="text-sm text-muted">
            Terus dari Google Sheet Product Launch Tracker — semua orang nampak
            perkembangan yang sama.
            {refreshedAt && (
              <span className="ml-1 text-slate-500">
                (dikemas kini {refreshedAt})
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => load(true)}
            className="btn-secondary"
            disabled={loading}
          >
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

      {/* Pelancaran akan datang */}
      {upcoming.length > 0 && (
        <motion.div
          {...cardMotion}
          className="rounded-2xl border border-masdora-orange/25 bg-gradient-to-br from-masdora-orange/20 to-masdora-orange/5 p-5"
        >
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-300">
            🚀 Pelancaran akan datang
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {upcoming.map((i, idx) => (
              <motion.div
                key={i.rowIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.06 }}
                className="rounded-xl border border-white/10 bg-black/20 p-3"
              >
                <p className="truncate text-sm font-bold text-white">
                  {i.product}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {i.launchDate} · {i.weight}
                </p>
                <p className="mt-1 text-xs font-black text-masdora-orange">
                  {countdownLabel(i.daysAway)}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Kad status — klik untuk tapis */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATUSES.map((s, i) => {
          const active = statusFilter === s.key;
          return (
            <motion.button
              key={s.key}
              {...cardMotion}
              transition={{ ...cardMotion.transition, delay: i * 0.06 }}
              onClick={() => setStatusFilter(active ? "" : s.key)}
              className={`rounded-2xl border bg-gradient-to-br p-4 text-left transition ${
                s.accent
              } ${active ? "ring-2 ring-white/40" : "hover:brightness-125"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  {s.label}
                </span>
                <span className="text-lg" aria-hidden>
                  {s.icon}
                </span>
              </div>
              <p className="mt-2 text-2xl font-black text-white">
                {counts[s.key]}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {active ? "klik untuk buang tapisan" : "klik untuk tapis"}
              </p>
            </motion.button>
          );
        })}
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
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="label">Cari</label>
          <input
            className="input"
            placeholder="Nama produk, kategori, catatan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </motion.div>

      {loading ? (
        <p className="text-sm text-muted">Memuatkan data...</p>
      ) : filtered.length === 0 ? (
        <motion.div {...cardMotion} className="card text-center text-sm text-muted">
          {items.length === 0
            ? "Belum ada kempen direkod dalam sheet."
            : "Tiada kempen untuk tapisan ini."}
        </motion.div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([month, list]) => (
            <div key={month}>
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-400">
                {month}
                {list[0]?.quarter ? ` · ${list[0].quarter}` : ""}
                <span className="ml-2 font-normal normal-case text-slate-600">
                  {list.length} produk
                </span>
              </h3>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {list.map((i, idx) => {
                  const meta = STATUS_MAP[i.status];
                  const cd = countdownLabel(i.daysAway);
                  return (
                    <motion.div
                      key={i.rowIndex}
                      {...cardMotion}
                      transition={{
                        ...cardMotion.transition,
                        delay: Math.min(idx * 0.03, 0.3),
                      }}
                      className="card"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-100">{i.product}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {[i.category, i.weight].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <span className={`pill flex-shrink-0 ${meta.pill}`}>
                          {meta.icon} {i.statusRaw || meta.label}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-slate-400">
                          📅 {i.launchDate || "Tarikh belum ditetapkan"}
                        </span>
                        {cd && (
                          <span className="font-bold text-masdora-orange">
                            {cd}
                          </span>
                        )}
                      </div>

                      {i.remarks && (
                        <p className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] p-2 text-xs text-slate-300">
                          {i.remarks}
                        </p>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
