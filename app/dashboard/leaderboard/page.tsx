"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getCurrentYear,
  getCurrentMonth,
  getCurrentWeekOfMonth,
} from "@/lib/period";
import WeekPicker, { WeekValue } from "@/components/WeekPicker";
import DataTable, { DataTableColumn } from "@/components/DataTable";
import type { VDeptSummary, VLeaderboard } from "@/types/database";

export default function LeaderboardPage() {
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
      <div>
        <h2 className="text-xl font-bold text-white">Leaderboard</h2>
        <p className="text-sm text-muted">
          Ranking prestasi mingguan seluruh pasukan.
        </p>
      </div>

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
