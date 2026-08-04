"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import {
  getCurrentYear,
  getCurrentMonth,
  getCurrentWeekOfMonth,
  monthName,
} from "@/lib/period";
import WeekPicker, { WeekValue } from "@/components/WeekPicker";
import DataTable, { DataTableColumn } from "@/components/DataTable";
import AvatarInitials from "@/components/AvatarInitials";
import RankBarChart, { RankBarItem } from "@/components/charts/RankBarChart";
import type {
  VDeptSummary,
  VKpiStatus,
  VLeaderboard,
  VSalesRankDaily,
  VSalesRankWeekly,
  VSalesRankMonthly,
} from "@/types/database";

const MEDALS = ["🥇", "🥈", "🥉"];

const cardMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const },
};

function formatRM(n: number | null | undefined): string {
  if (n === null || n === undefined) return "-";
  return `RM ${Number(n).toLocaleString("ms-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function pctPill(pct: number | null): { label: string; pill: string } {
  if (pct === null) return { label: "-", pill: "kosong" };
  if (pct >= 100) return { label: `${pct}%`, pill: "hijau" };
  if (pct >= 85) return { label: `${pct}%`, pill: "kuning" };
  if (pct >= 60) return { label: `${pct}%`, pill: "oren" };
  return { label: `${pct}%`, pill: "merah" };
}

function rankLabel(rank: number): React.ReactNode {
  return MEDALS[rank - 1] ?? `#${rank}`;
}

export default function LeaderboardPage() {
  const [mainTab, setMainTab] = useState<"kpi" | "jualan">("kpi");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Leaderboard</h2>
        <p className="text-sm text-muted">
          Ranking prestasi KPI dan jualan seluruh pasukan.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className={`pill ${mainTab === "kpi" ? "pill-hijau" : "pill-kosong"}`}
          onClick={() => setMainTab("kpi")}
        >
          🏆 KPI
        </button>
        <button
          className={`pill ${mainTab === "jualan" ? "pill-hijau" : "pill-kosong"}`}
          onClick={() => setMainTab("jualan")}
        >
          💰 Jualan
        </button>
      </div>

      {mainTab === "kpi" ? <KpiLeaderboard /> : <SalesLeaderboard />}
    </div>
  );
}

interface Badge {
  label: string;
  icon: string;
  className: string;
}

const PODIUM_HEIGHT: Record<number, string> = {
  1: "h-28",
  2: "h-20",
  3: "h-16",
};
const PODIUM_ORDER = [2, 1, 3];
const CONFETTI = [
  { left: "8%", top: "10%", rotate: "12deg", color: "#F26122" },
  { left: "20%", top: "35%", rotate: "-18deg", color: "#6B8042" },
  { left: "80%", top: "12%", rotate: "-8deg", color: "#6B8042" },
  { left: "88%", top: "40%", rotate: "20deg", color: "#F26122" },
  { left: "45%", top: "6%", rotate: "6deg", color: "#FDE585" },
  { left: "62%", top: "30%", rotate: "-25deg", color: "#F26122" },
  { left: "12%", top: "55%", rotate: "30deg", color: "#FDE585" },
  { left: "70%", top: "55%", rotate: "-10deg", color: "#6B8042" },
];

function KpiLeaderboard() {
  const supabase = createClient();
  const [week, setWeek] = useState<WeekValue>({
    year: getCurrentYear(),
    month: getCurrentMonth(),
    week: getCurrentWeekOfMonth(),
  });
  const [rows, setRows] = useState<VLeaderboard[]>([]);
  const [deptRows, setDeptRows] = useState<VDeptSummary[]>([]);
  const [kpiDefCounts, setKpiDefCounts] = useState<Map<string, number>>(
    new Map()
  );
  const [kpiStatusRows, setKpiStatusRows] = useState<VKpiStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [
      { data: leaderboard },
      { data: dept },
      { data: defs },
      { data: statusRows },
    ] = await Promise.all([
      supabase
        .from("v_leaderboard")
        .select("*")
        .eq("year", week.year)
        .eq("month", week.month)
        .eq("week", week.week)
        .order("rank"),
      supabase
        .from("v_dept_summary")
        .select("*")
        .eq("year", week.year)
        .eq("month", week.month)
        .eq("week", week.week)
        .order("avg_score", { ascending: false }),
      supabase
        .from("kpi_definitions")
        .select("position_code")
        .eq("active", true)
        .eq("status", "active"),
      supabase
        .from("v_kpi_status")
        .select("*")
        .eq("year", week.year)
        .eq("month", week.month)
        .eq("week", week.week),
    ]);
    setRows((leaderboard as VLeaderboard[]) ?? []);
    setDeptRows((dept as VDeptSummary[]) ?? []);
    const counts = new Map<string, number>();
    ((defs as { position_code: string }[]) ?? []).forEach((d) => {
      counts.set(d.position_code, (counts.get(d.position_code) ?? 0) + 1);
    });
    setKpiDefCounts(counts);
    setKpiStatusRows((statusRows as VKpiStatus[]) ?? []);
    setLoading(false);
  }, [week, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const viralUsers = new Set(
    kpiStatusRows
      .filter((r) => r.status === "hijau" && /view/i.test(r.kpi_name))
      .map((r) => r.user_id)
  );
  const zeroBacklogUsers = new Set(
    kpiStatusRows
      .filter((r) => r.direction === "down" && r.status === "hijau")
      .map((r) => r.user_id)
  );

  function badgesFor(row: VLeaderboard): Badge[] {
    const badges: Badge[] = [];
    if (row.rank === 1) badges.push({ label: "Juara Minggu", icon: "🏆", className: "pill-oren" });
    else if (row.rank === 2) badges.push({ label: "Tempat Ke-2", icon: "🥈", className: "pill-kosong" });
    else if (row.rank === 3) badges.push({ label: "Tempat Ke-3", icon: "🥉", className: "pill-oren" });
    const expected = row.position_code ? kpiDefCounts.get(row.position_code) ?? 0 : 0;
    if (expected > 0 && row.kpi_filled >= expected) {
      badges.push({ label: "Data Penuh", icon: "✅", className: "pill-hijau" });
    }
    if (row.on_time) {
      badges.push({ label: "Hantar Tepat Masa", icon: "⏱️", className: "pill-kosong" });
    }
    if (viralUsers.has(row.user_id)) {
      badges.push({ label: "Viral Hunter", icon: "🚀", className: "pill-oren" });
    }
    if (zeroBacklogUsers.has(row.user_id)) {
      badges.push({ label: "Zero Backlog", icon: "♻️", className: "pill-hijau" });
    }
    return badges;
  }

  const champion = rows.find((r) => r.rank === 1) ?? null;
  const avgTeamScore =
    rows.length > 0
      ? Number(
          (rows.reduce((s, r) => s + (r.total_score ?? 0), 0) / rows.length).toFixed(1)
        )
      : null;
  const fullDataCount = rows.filter((r) => {
    const expected = r.position_code ? kpiDefCounts.get(r.position_code) ?? 0 : 0;
    return expected > 0 && r.kpi_filled >= expected;
  }).length;
  const bestDept = deptRows.length > 0 ? deptRows[0] : null;

  const podiumTop3 = rows.filter((r) => r.rank <= 3).sort((a, b) => a.rank - b.rank);

  const deptColumns: DataTableColumn<VDeptSummary>[] = [
    { key: "dept_code", header: "Jabatan" },
    { key: "avg_score", header: "Purata Skor" },
    { key: "headcount", header: "Bilangan Ahli" },
    { key: "total_achieved", header: "Jumlah KPI Dicapai" },
  ];

  return (
    <div className="space-y-6">
      <motion.div {...cardMotion} className="card">
        <WeekPicker value={week} onChange={setWeek} />
      </motion.div>

      {loading ? (
        <p className="text-sm text-muted">Memuatkan...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <motion.div
              {...cardMotion}
              transition={{ ...cardMotion.transition, delay: 0 }}
              className="rounded-2xl border bg-gradient-to-br from-masdora-orange/20 to-masdora-orange/5 border-masdora-orange/25 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Juara Minggu</span>
                <span className="text-lg" aria-hidden>🥇</span>
              </div>
              <p className="mt-2 text-2xl font-black text-white">{champion?.full_name ?? "-"}</p>
              <p className="mt-1 text-[11px] text-slate-400">{champion ? `${champion.total_score} skor` : "Tiada data"}</p>
            </motion.div>
            <motion.div
              {...cardMotion}
              transition={{ ...cardMotion.transition, delay: 0.06 }}
              className="rounded-2xl border bg-gradient-to-br from-masdora-olive/25 to-masdora-olive/5 border-masdora-olive/35 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Skor Purata Team</span>
                <span className="text-lg" aria-hidden>📊</span>
              </div>
              <p className="mt-2 text-2xl font-black text-white">{avgTeamScore ?? "-"}</p>
              <p className="mt-1 text-[11px] text-slate-400">{rows.length} ahli bertanding</p>
            </motion.div>
            <motion.div
              {...cardMotion}
              transition={{ ...cardMotion.transition, delay: 0.12 }}
              className="rounded-2xl border bg-gradient-to-br from-masdora-yellow/18 to-masdora-yellow/5 border-masdora-yellow/25 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Data Penuh</span>
                <span className="text-lg" aria-hidden>✅</span>
              </div>
              <p className="mt-2 text-2xl font-black text-white">{fullDataCount}</p>
              <p className="mt-1 text-[11px] text-slate-400">ahli isi 100% KPI</p>
            </motion.div>
            <motion.div
              {...cardMotion}
              transition={{ ...cardMotion.transition, delay: 0.18 }}
              className="rounded-2xl border bg-gradient-to-br from-masdora-gray/15 to-masdora-gray/5 border-masdora-gray/25 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Jabatan Terbaik</span>
                <span className="text-lg" aria-hidden>🏢</span>
              </div>
              <p className="mt-2 text-2xl font-black text-white">{bestDept?.dept_code ?? "-"}</p>
              <p className="mt-1 text-[11px] text-slate-400">{bestDept ? `${bestDept.avg_score}% skor purata` : "-"}</p>
            </motion.div>
          </div>

          {podiumTop3.length > 0 && (
            <motion.div {...cardMotion} className="card relative overflow-hidden">
              <div className="mb-6 flex items-center gap-2">
                <span className="text-lg" aria-hidden>👑</span>
                <div>
                  <h3 className="font-bold text-white">Podium Minggu {week.week}</h3>
                  <p className="text-xs text-slate-400">
                    Skor = purata berpemberat semua KPI (had 120%) + bonus to-do mingguan
                  </p>
                </div>
              </div>

              {CONFETTI.map((c, i) => (
                <span
                  key={i}
                  className="pointer-events-none absolute h-2 w-1 rounded-sm opacity-60"
                  style={{ left: c.left, top: c.top, background: c.color, transform: `rotate(${c.rotate})` }}
                />
              ))}

              <div className="relative flex items-end justify-center gap-3 sm:gap-6">
                {PODIUM_ORDER.map((rank) => {
                  const row = podiumTop3.find((r) => r.rank === rank);
                  if (!row) return <div key={rank} className="w-24 sm:w-32" />;
                  return (
                    <div key={rank} className="flex w-24 flex-col items-center sm:w-32">
                      <span className="text-xl">{MEDALS[rank - 1]}</span>
                      <AvatarInitials name={row.full_name} deptColor={undefined} size={56} className="my-2" />
                      <p className="truncate text-center text-sm font-bold text-white">{row.full_name}</p>
                      <p className="truncate text-center text-[11px] text-slate-400">{row.position_code ?? "-"}</p>
                      <p className="mt-1 text-lg font-black text-masdora-orange">{row.total_score}</p>
                      <div
                        className={`mt-3 flex w-full items-start justify-center rounded-t-lg ${PODIUM_HEIGHT[rank]} ${
                          rank === 1
                            ? "bg-gradient-to-b from-masdora-orange/40 to-masdora-orange/10"
                            : "bg-gradient-to-b from-white/15 to-white/5"
                        }`}
                      >
                        <span className="mt-2 text-2xl font-black text-white/30">{rank}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          <div>
            <h3 className="mb-2 font-semibold text-white">Kedudukan Penuh</h3>
            <div className="space-y-2">
              {rows.length === 0 ? (
                <div className="card text-sm text-muted">Tiada data leaderboard untuk minggu ini.</div>
              ) : (
                rows.map((row, i) => {
                  const expected = row.position_code ? kpiDefCounts.get(row.position_code) ?? 0 : 0;
                  const fillPct = expected > 0 ? Math.min(100, (row.kpi_filled / expected) * 100) : 0;
                  const bonus = Math.round((row.total_score ?? 0) - (row.kpi_score ?? 0));
                  return (
                    <motion.div
                      key={row.user_id}
                      {...cardMotion}
                      transition={{ ...cardMotion.transition, delay: i * 0.05 }}
                      className="card flex flex-col gap-3 sm:flex-row sm:items-center"
                    >
                      <div className="flex w-8 flex-shrink-0 items-center justify-center text-lg font-bold text-slate-400">
                        {row.rank}
                      </div>
                      <AvatarInitials name={row.full_name} deptColor={undefined} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-white">{row.full_name}</p>
                        <p className="truncate text-xs text-slate-400">
                          {row.position_code ?? "-"} · {row.dept_code ?? "-"}
                        </p>
                        <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-masdora-olive transition-[width] duration-700 ease-out"
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {row.kpi_filled}/{expected} KPI · {row.kpi_achieved} capai
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5 sm:max-w-xs sm:justify-end">
                        {badgesFor(row).map((b) => (
                          <span key={b.label} className={`pill ${b.className}`}>
                            {b.icon} {b.label}
                          </span>
                        ))}
                      </div>
                      <div className="text-right sm:w-24">
                        <p className="text-xl font-black text-white">{row.total_score}</p>
                        <p className="text-[11px] text-slate-500">
                          KPI {row.kpi_score ?? 0}% {bonus >= 0 ? "+" : ""}
                          {bonus}
                        </p>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-white">Rollup Jabatan</h3>
            <DataTable<VDeptSummary>
              columns={deptColumns}
              rows={deptRows}
              rowKey={(r) => r.dept_code ?? "-"}
              emptyMessage="Tiada data jabatan untuk minggu ini."
            />
          </div>
        </>
      )}
    </div>
  );
}

function SalesLeaderboard() {
  const [subTab, setSubTab] = useState<"harian" | "mingguan" | "bulanan">(
    "harian"
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          className={`pill ${subTab === "harian" ? "pill-hijau" : "pill-kosong"}`}
          onClick={() => setSubTab("harian")}
        >
          Harian
        </button>
        <button
          className={`pill ${subTab === "mingguan" ? "pill-hijau" : "pill-kosong"}`}
          onClick={() => setSubTab("mingguan")}
        >
          Mingguan
        </button>
        <button
          className={`pill ${subTab === "bulanan" ? "pill-hijau" : "pill-kosong"}`}
          onClick={() => setSubTab("bulanan")}
        >
          Bulanan
        </button>
      </div>

      {subTab === "harian" && <SalesDaily />}
      {subTab === "mingguan" && <SalesWeekly />}
      {subTab === "bulanan" && <SalesMonthly />}
    </div>
  );
}

function SalesDaily() {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState<VSalesRankDaily[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("v_sales_rank_daily")
      .select("*")
      .eq("date", date)
      .order("rank");
    setRows((data as VSalesRankDaily[]) ?? []);
    setLoading(false);
  }, [date, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: DataTableColumn<VSalesRankDaily>[] = [
    { key: "rank", header: "#", render: (r) => rankLabel(r.rank) },
    {
      key: "full_name",
      header: "Nama",
      render: (r) => (
        <div className="flex items-center gap-2">
          <AvatarInitials name={r.full_name} size={26} />
          <span>{r.full_name}</span>
        </div>
      ),
    },
    { key: "dept_code", header: "Jabatan" },
    {
      key: "total_rm",
      header: "Jumlah (RM)",
      render: (r) => formatRM(r.total_rm),
    },
    { key: "entries", header: "Bilangan Rekod" },
  ];

  return (
    <div className="space-y-6">
      <motion.div {...cardMotion} className="card">
        <label className="label">Tarikh</label>
        <input
          type="date"
          className="input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </motion.div>
      {loading ? (
        <p className="text-sm text-muted">Memuatkan...</p>
      ) : (
        <>
          <RankBarChart
            items={rows.map(
              (r): RankBarItem => ({
                id: r.user_id,
                rank: r.rank,
                name: r.full_name,
                deptCode: r.dept_code,
                value: r.total_rm ?? 0,
                valueLabel: formatRM(r.total_rm),
              })
            )}
          />
          <DataTable<VSalesRankDaily>
            columns={columns}
            rows={rows}
            rowKey={(r) => r.user_id}
            emptyMessage="Tiada data jualan untuk tarikh ini."
          />
        </>
      )}
    </div>
  );
}

function SalesWeekly() {
  const supabase = createClient();
  const [week, setWeek] = useState<WeekValue>({
    year: getCurrentYear(),
    month: getCurrentMonth(),
    week: getCurrentWeekOfMonth(),
  });
  const [rows, setRows] = useState<VSalesRankWeekly[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("v_sales_rank_weekly")
      .select("*")
      .eq("year", week.year)
      .eq("month", week.month)
      .eq("week", week.week)
      .order("rank");
    setRows((data as VSalesRankWeekly[]) ?? []);
    setLoading(false);
  }, [week, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: DataTableColumn<VSalesRankWeekly>[] = [
    { key: "rank", header: "#", render: (r) => rankLabel(r.rank) },
    {
      key: "full_name",
      header: "Nama",
      render: (r) => (
        <div className="flex items-center gap-2">
          <AvatarInitials name={r.full_name} size={26} />
          <span>{r.full_name}</span>
        </div>
      ),
    },
    { key: "dept_code", header: "Jabatan" },
    {
      key: "total_rm",
      header: "Jumlah (RM)",
      render: (r) => formatRM(r.total_rm),
    },
    { key: "entries", header: "Bilangan Rekod" },
  ];

  return (
    <div className="space-y-6">
      <motion.div {...cardMotion} className="card">
        <WeekPicker value={week} onChange={setWeek} />
      </motion.div>
      {loading ? (
        <p className="text-sm text-muted">Memuatkan...</p>
      ) : (
        <>
          <RankBarChart
            items={rows.map(
              (r): RankBarItem => ({
                id: r.user_id,
                rank: r.rank,
                name: r.full_name,
                deptCode: r.dept_code,
                value: r.total_rm ?? 0,
                valueLabel: formatRM(r.total_rm),
              })
            )}
          />
          <DataTable<VSalesRankWeekly>
            columns={columns}
            rows={rows}
            rowKey={(r) => r.user_id}
            emptyMessage="Tiada data jualan untuk minggu ini."
          />
        </>
      )}
    </div>
  );
}

function SalesMonthly() {
  const supabase = createClient();
  const [year, setYear] = useState(getCurrentYear());
  const [month, setMonth] = useState(getCurrentMonth());
  const [rows, setRows] = useState<VSalesRankMonthly[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("v_sales_rank_monthly")
      .select("*")
      .eq("year", year)
      .eq("month", month)
      .order("rank");
    setRows((data as VSalesRankMonthly[]) ?? []);
    setLoading(false);
  }, [year, month, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const years = Array.from({ length: 4 }, (_, i) => getCurrentYear() - 2 + i);

  const columns: DataTableColumn<VSalesRankMonthly>[] = [
    { key: "rank", header: "#", render: (r) => rankLabel(r.rank) },
    {
      key: "full_name",
      header: "Nama",
      render: (r) => (
        <div className="flex items-center gap-2">
          <AvatarInitials name={r.full_name} size={26} />
          <span>{r.full_name}</span>
        </div>
      ),
    },
    { key: "dept_code", header: "Jabatan" },
    {
      key: "total_rm",
      header: "Jumlah (RM)",
      render: (r) => formatRM(r.total_rm),
    },
    {
      key: "target_rm",
      header: "Sasaran (RM)",
      render: (r) => formatRM(r.target_rm),
    },
    {
      key: "pct_target",
      header: "% Sasaran",
      render: (r) => {
        const { label, pill } = pctPill(r.pct_target);
        return <span className={`pill pill-${pill}`}>{label}</span>;
      },
    },
    { key: "entries", header: "Bilangan Rekod" },
  ];

  return (
    <div className="space-y-6">
      <motion.div {...cardMotion} className="card flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Tahun</label>
          <select
            className="input"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Bulan</label>
          <select
            className="input"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {monthName(m)}
              </option>
            ))}
          </select>
        </div>
      </motion.div>
      {loading ? (
        <p className="text-sm text-muted">Memuatkan...</p>
      ) : (
        <>
          <RankBarChart
            items={rows.map(
              (r): RankBarItem => ({
                id: r.user_id,
                rank: r.rank,
                name: r.full_name,
                deptCode: r.dept_code,
                value: r.total_rm ?? 0,
                valueLabel: formatRM(r.total_rm),
              })
            )}
          />
          <DataTable<VSalesRankMonthly>
            columns={columns}
            rows={rows}
            rowKey={(r) => r.user_id}
            emptyMessage="Tiada data jualan untuk bulan ini."
          />
        </>
      )}
    </div>
  );
}
