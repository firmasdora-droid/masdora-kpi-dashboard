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
import type { Department, VDeptSummary, VWeeklyScore } from "@/types/database";

const cardMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const },
};

export default function LaporanPage() {
  const supabase = createClient();
  const [week, setWeek] = useState<WeekValue>({
    year: getCurrentYear(),
    month: getCurrentMonth(),
    week: getCurrentWeekOfMonth(),
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptRows, setDeptRows] = useState<VDeptSummary[]>([]);
  const [scoreRows, setScoreRows] = useState<VWeeklyScore[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: depts }, { data: dept }, { data: scores }] = await Promise.all([
      supabase.from("departments").select("*").order("sort_order"),
      supabase
        .from("v_dept_summary")
        .select("*")
        .eq("year", week.year)
        .eq("month", week.month)
        .eq("week", week.week)
        .order("avg_score", { ascending: false }),
      supabase
        .from("v_weekly_score")
        .select("*")
        .eq("year", week.year)
        .eq("month", week.month)
        .eq("week", week.week)
        .order("kpi_score", { ascending: false }),
    ]);
    setDepartments((depts as Department[]) ?? []);
    setDeptRows((dept as VDeptSummary[]) ?? []);
    setScoreRows((scores as VWeeklyScore[]) ?? []);
    setLoading(false);
  }, [week, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const deptNameOf = (code: string | null) =>
    departments.find((d) => d.code === code)?.name ?? code ?? "-";

  const deptColumns: DataTableColumn<VDeptSummary>[] = [
    { key: "dept_code", header: "Jabatan", render: (r) => deptNameOf(r.dept_code) },
    { key: "avg_score", header: "Purata Skor", render: (r) => `${r.avg_score ?? "-"}%` },
    { key: "headcount", header: "Bilangan Ahli" },
    { key: "total_achieved", header: "Jumlah KPI Dicapai" },
  ];

  const scoreColumns: DataTableColumn<VWeeklyScore>[] = [
    { key: "full_name", header: "Nama" },
    { key: "position_code", header: "Jawatan" },
    { key: "dept_code", header: "Jabatan", render: (r) => deptNameOf(r.dept_code) },
    { key: "kpi_score", header: "Skor KPI", render: (r) => r.kpi_score ?? "-" },
    {
      key: "kpi_achieved",
      header: "KPI Dicapai",
      render: (r) => `${r.kpi_achieved}/${r.kpi_filled}`,
    },
  ];

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Laporan</h2>
          <p className="text-sm text-muted">
            Rollup prestasi jabatan & individu untuk{" "}
            {monthName(week.month)} {week.year}, Minggu {week.week}.
          </p>
        </div>
        <button className="btn-secondary" onClick={handlePrint}>
          Cetak / Simpan PDF
        </button>
      </div>

      <motion.div {...cardMotion} className="card">
        <WeekPicker value={week} onChange={setWeek} />
      </motion.div>

      {loading ? (
        <p className="text-sm text-muted">Memuatkan...</p>
      ) : (
        <>
          <div>
            <h3 className="mb-2 font-semibold text-white">Rollup Jabatan</h3>
            <DataTable<VDeptSummary>
              columns={deptColumns}
              rows={deptRows}
              rowKey={(r) => r.dept_code ?? "-"}
              emptyMessage="Tiada data jabatan untuk tempoh ini."
            />
          </div>
          <div>
            <h3 className="mb-2 font-semibold text-white">Rollup Individu</h3>
            <DataTable<VWeeklyScore>
              columns={scoreColumns}
              rows={scoreRows}
              rowKey={(r) => r.user_id}
              emptyMessage="Tiada data individu untuk tempoh ini."
            />
          </div>
        </>
      )}
    </div>
  );
}
