"use client";

import { useCallback, useEffect, useState } from "react";
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
import type {
  VDeptSummary,
  VLeaderboard,
  VSalesRankDaily,
  VSalesRankWeekly,
  VSalesRankMonthly,
} from "@/types/database";

const MEDALS = ["🥇", "🥈", "🥉"];

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

function KpiLeaderboard() {
  const supabase = createClient();
  const [week, setWeek] = useState<WeekValue>({
    year: getCurrentYear(),
    month: getCurrentMonth(),
    week: getCurrentWeekOfMonth(),
  });
  const [rows, setRows] = useState<VLeaderboard[]>([]);
  const [deptRows, setDeptRows] = useState<VDeptSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: leaderboard }, { data: dept }] = await Promise.all([
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
    ]);
    setRows((leaderboard as VLeaderboard[]) ?? []);
    setDeptRows((dept as VDeptSummary[]) ?? []);
    setLoading(false);
  }, [week, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: DataTableColumn<VLeaderboard>[] = [
    { key: "rank", header: "#", render: (r) => `#${r.rank}` },
    { key: "full_name", header: "Nama" },
    { key: "dept_code", header: "Jabatan" },
    {
      key: "kpi_score",
      header: "Skor KPI",
      render: (r) => r.kpi_score ?? "-",
    },
    { key: "total_score", header: "Skor Keseluruhan" },
    {
      key: "on_time",
      header: "Tepat Masa",
      render: (r) =>
        r.submitted_at ? (r.on_time ? "Ya" : "Tidak") : "Belum hantar",
    },
  ];

  const deptColumns: DataTableColumn<VDeptSummary>[] = [
    { key: "dept_code", header: "Jabatan" },
    { key: "avg_score", header: "Purata Skor" },
    { key: "headcount", header: "Bilangan Ahli" },
    { key: "total_achieved", header: "Jumlah KPI Dicapai" },
  ];

  return (
    <div className="space-y-6">
      <div className="card">
        <WeekPicker value={week} onChange={setWeek} />
      </div>

      {loading ? (
        <p className="text-sm text-muted">Memuatkan...</p>
      ) : (
        <>
          <div>
            <h3 className="mb-2 font-semibold text-white">
              Ranking Individu
            </h3>
            <DataTable<VLeaderboard>
              columns={columns}
              rows={rows}
              rowKey={(r) => r.user_id}
              emptyMessage="Tiada data leaderboard untuk minggu ini."
            />
          </div>
          <div>
            <h3 className="mb-2 font-semibold text-white">
              Rollup Jabatan
            </h3>
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
      <div className="card">
        <label className="label">Tarikh</label>
        <input
          type="date"
          className="input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      {loading ? (
        <p className="text-sm text-muted">Memuatkan...</p>
      ) : (
        <DataTable<VSalesRankDaily>
          columns={columns}
          rows={rows}
          rowKey={(r) => r.user_id}
          emptyMessage="Tiada data jualan untuk tarikh ini."
        />
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
      <div className="card">
        <WeekPicker value={week} onChange={setWeek} />
      </div>
      {loading ? (
        <p className="text-sm text-muted">Memuatkan...</p>
      ) : (
        <DataTable<VSalesRankWeekly>
          columns={columns}
          rows={rows}
          rowKey={(r) => r.user_id}
          emptyMessage="Tiada data jualan untuk minggu ini."
        />
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
      <div className="card flex flex-wrap items-end gap-4">
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
      </div>
      {loading ? (
        <p className="text-sm text-muted">Memuatkan...</p>
      ) : (
        <DataTable<VSalesRankMonthly>
          columns={columns}
          rows={rows}
          rowKey={(r) => r.user_id}
          emptyMessage="Tiada data jualan untuk bulan ini."
        />
      )}
    </div>
  );
}
