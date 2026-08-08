"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

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

/** Nama sebenar bagi kod handler. */
const HANDLER_NAMES: Record<string, string> = {
  MAI: "Maisarah",
  TI: "Najjati",
  HAWA: "Natasya",
};

type StatusKey = "baru" | "proses" | "selesai" | "perhatian";

const STATUSES: {
  key: StatusKey;
  label: string;
  pill: string;
  icon: string;
}[] = [
  { key: "baru", label: "Baru", pill: "pill-kosong", icon: "🆕" },
  { key: "proses", label: "Sedang Diuruskan", pill: "pill-kuning", icon: "⏳" },
  { key: "selesai", label: "Selesai", pill: "pill-hijau", icon: "✅" },
  { key: "perhatian", label: "Perlu Perhatian", pill: "pill-merah", icon: "⚠️" },
];

const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.key, s]));

const cardMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const },
};

const STAT_ACCENTS = [
  "from-masdora-orange/20 to-masdora-orange/5 border-masdora-orange/25",
  "from-masdora-yellow/18 to-masdora-yellow/5 border-masdora-yellow/25",
  "from-masdora-olive/25 to-masdora-olive/5 border-masdora-olive/35",
  "from-masdora-alert/20 to-masdora-alert/5 border-masdora-alert/25",
];

/** Kunci stabil untuk padankan isu dari sheet dengan status dalam database. */
function keyOf(i: CsIssue) {
  return `${i.monthTab}-${i.rowIndex}`;
}

/** Status awal kalau team belum tanda apa-apa lagi. */
function defaultStatus(i: CsIssue): StatusKey {
  return i.solution.trim() ? "selesai" : "baru";
}

export default function IsuPelangganPage() {
  const supabase = createClient();

  const [issues, setIssues] = useState<CsIssue[]>([]);
  const [tabs, setTabs] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<Record<string, StatusKey>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [monthFilter, setMonthFilter] = useState("");
  const [handlerFilter, setHandlerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sheetRes, { data: statusRows }] = await Promise.all([
        fetch("/api/cs-issues", { cache: "no-store" }).then((r) => r.json()),
        supabase.from("cs_issue_status").select("source_key, status"),
      ]);

      if (!sheetRes.ok) {
        setError(sheetRes.error ?? "Gagal memuatkan data.");
        setIssues([]);
      } else {
        setIssues(sheetRes.issues as CsIssue[]);
        setTabs((sheetRes.tabs as string[]) ?? []);
      }

      const map: Record<string, StatusKey> = {};
      ((statusRows as { source_key: string; status: string }[]) ?? []).forEach(
        (r) => {
          map[r.source_key] = r.status as StatusKey;
        }
      );
      setStatuses(map);
    } catch {
      setError("Gagal menghubungi Google Sheet.");
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  function statusOf(i: CsIssue): StatusKey {
    return statuses[keyOf(i)] ?? defaultStatus(i);
  }

  async function setStatus(issue: CsIssue, next: StatusKey) {
    const key = keyOf(issue);
    setSavingKey(key);
    // Kemas skrin dahulu supaya terasa pantas
    setStatuses((prev) => ({ ...prev, [key]: next }));

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: upsertError } = await supabase
      .from("cs_issue_status")
      .upsert(
        {
          source_key: key,
          status: next,
          updated_by: user?.id ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "source_key" }
      );

    setSavingKey(null);

    if (upsertError) {
      setError("Gagal menyimpan status: " + upsertError.message);
      load();
    }
  }

  const handlers = useMemo(
    () => Array.from(new Set(issues.map((i) => i.handler).filter(Boolean))).sort(),
    [issues]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return issues.filter((i) => {
      if (monthFilter && i.monthTab !== monthFilter) return false;
      if (handlerFilter && i.handler !== handlerFilter) return false;
      if (statusFilter && statusOf(i) !== statusFilter) return false;
      if (q) {
        const hay =
          `${i.username} ${i.description} ${i.solution} ${i.platform} ${i.handler}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues, monthFilter, handlerFilter, statusFilter, search, statuses]);

  const counts = useMemo(() => {
    const c: Record<StatusKey, number> = {
      baru: 0,
      proses: 0,
      selesai: 0,
      perhatian: 0,
    };
    filtered.forEach((i) => {
      c[statusOf(i)]++;
    });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, statuses]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Isu Pelanggan</h2>
          <p className="text-sm text-muted">
            Isu dari Google Sheet · status boleh ditanda terus di sini.
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
                STAT_ACCENTS[i]
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
                {HANDLER_NAMES[h] ?? h}
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
        <p className="text-sm text-muted">Memuatkan data...</p>
      ) : filtered.length === 0 ? (
        <motion.div {...cardMotion} className="card text-center text-sm text-muted">
          Tiada isu yang sepadan dengan penapis ini.
        </motion.div>
      ) : (
        <div className="space-y-3">
          {filtered.map((issue, i) => {
            const key = keyOf(issue);
            const current = statusOf(issue);
            const meta = STATUS_MAP[current];
            return (
              <motion.div
                key={key}
                {...cardMotion}
                transition={{
                  ...cardMotion.transition,
                  delay: Math.min(i * 0.03, 0.4),
                }}
                className="card"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="pill pill-oren">
                    {HANDLER_NAMES[issue.handler] || issue.handler || "—"}
                  </span>
                  <span className="pill pill-kosong">{issue.platform || "—"}</span>
                  <span className="text-xs text-slate-400">
                    {issue.reportedAt || issue.rawDate || "Tiada tarikh"} ·{" "}
                    {issue.monthTab}
                  </span>
                  <span className={`pill ml-auto ${meta.pill}`}>
                    {meta.icon} {meta.label}
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

                {/* Tukar status */}
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Tukar status:
                  </span>
                  {STATUSES.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setStatus(issue, s.key)}
                      disabled={savingKey === key}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        current === s.key
                          ? "bg-white/15 text-white"
                          : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      } disabled:opacity-50`}
                    >
                      {s.icon} {s.label}
                    </button>
                  ))}
                  {savingKey === key && (
                    <span className="text-xs text-slate-500">Menyimpan...</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
