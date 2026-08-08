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
import SalesPodium, { PodiumItem } from "@/components/charts/SalesPodium";
import type {
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
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Leaderboard Jualan</h2>
        <p className="text-sm text-muted">
          Ranking jualan seluruh pasukan — harian, mingguan &amp; bulanan.
        </p>
      </div>

      <SalesLeaderboard />
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
  const [autoPicked, setAutoPicked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kalau hari ini tiada jualan, terus tunjuk hari TERKINI yang ada jualan
  // supaya pengguna tak nampak skrin kosong tanpa sebab.
  useEffect(() => {
    if (autoPicked) return;
    (async () => {
      const { data } = await supabase
        .from("v_sales_rank_daily")
        .select("date")
        .order("date", { ascending: false })
        .limit(1);
      const latest = (data as { date: string }[] | null)?.[0]?.date;
      if (latest && latest !== today) setDate(latest);
      setAutoPicked(true);
    })();
  }, [autoPicked, supabase, today]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from("v_sales_rank_daily")
      .select("*")
      .eq("date", date)
      .order("rank");
    if (qErr) {
      setError(
        "Leaderboard jualan belum disediakan dalam database. Sila run fail add-sales-leaderboard-views.sql di Supabase."
      );
      setRows([]);
    } else {
      setRows((data as VSalesRankDaily[]) ?? []);
    }
    setLoading(false);
  }, [date, supabase]);

  useEffect(() => {
    if (autoPicked) load();
  }, [load, autoPicked]);

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
        {date !== today && (
          <p className="mt-2 text-xs text-slate-400">
            Menunjukkan hari terkini yang ada jualan.{" "}
            <button
              onClick={() => setDate(today)}
              className="font-semibold text-brand-400 underline"
            >
              Tukar ke hari ini
            </button>
          </p>
        )}
      </motion.div>

      {error && (
        <motion.div
          {...cardMotion}
          className="card border-red-500/30 text-sm text-red-300"
        >
          {error}
        </motion.div>
      )}

      {loading ? (
        <p className="text-sm text-muted">Memuatkan...</p>
      ) : (
        <>
          <SalesPodium
            items={rows.map(
              (r): PodiumItem => ({
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
          <SalesPodium
            items={rows.map(
              (r): PodiumItem => ({
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
          <SalesPodium
            items={rows.map(
              (r): PodiumItem => ({
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
