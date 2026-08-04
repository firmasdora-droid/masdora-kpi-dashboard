"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  getCurrentYear,
  getCurrentMonth,
  getCurrentWeekOfMonth,
  monthName,
} from "@/lib/period";
import BarChart from "@/components/charts/BarChart";
import DonutChart from "@/components/charts/DonutChart";
import LineChart from "@/components/charts/LineChart";
import RadarChart from "@/components/charts/RadarChart";
import AvatarInitials from "@/components/AvatarInitials";
import StatusBadge from "@/components/StatusBadge";
import type { ChartDatum, SeriesDatum } from "@/components/charts/types";
import type {
  Campaign,
  Department,
  KpiDefinition,
  KpiStatusColor,
  Profile,
  Todo,
  VDeptSummary,
  VKpiStatus,
  VLeaderboard,
  VWeekSummary,
  VWeeklyScore,
  WeeklySubmission,
} from "@/types/database";

const MEDALS = ["🥇", "🥈", "🥉"];

function scoreStatusLabel(score: number | null): {
  label: string;
  pill: KpiStatusColor;
} {
  if (score === null) return { label: "Tiada Data", pill: "kosong" };
  if (score >= 100) return { label: "Capai", pill: "hijau" };
  if (score >= 85) return { label: "Hampir", pill: "kuning" };
  return { label: "Lemah", pill: "merah" };
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export default function DashboardUtama() {
  const supabase = createClient();

  const [year, setYear] = useState(getCurrentYear());
  const [month, setMonth] = useState(getCurrentMonth());
  const [week, setWeek] = useState(getCurrentWeekOfMonth());
  const [deptFilter, setDeptFilter] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [kpiDefs, setKpiDefs] = useState<KpiDefinition[]>([]);
  const [weeklyScores, setWeeklyScores] = useState<VWeeklyScore[]>([]);
  const [kpiStatusRows, setKpiStatusRows] = useState<VKpiStatus[]>([]);
  const [weekSummaries, setWeekSummaries] = useState<VWeekSummary[]>([]);
  const [submissions, setSubmissions] = useState<WeeklySubmission[]>([]);
  const [tangguhTodos, setTangguhTodos] = useState<Todo[]>([]);
  const [deptSummary, setDeptSummary] = useState<VDeptSummary[]>([]);
  const [monthlyScores, setMonthlyScores] = useState<VWeeklyScore[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leaderboard, setLeaderboard] = useState<VLeaderboard[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [
      { data: deptRows },
      { data: profileRows },
      { data: defRows },
      { data: scoreRows },
      { data: statusRows },
      { data: summaryRows },
      { data: subRows },
      { data: todoRows },
      { data: deptSumRows },
      { data: monthScoreRows },
      { data: campaignRows },
      { data: leaderRows },
    ] = await Promise.all([
      supabase.from("departments").select("*").order("sort_order"),
      supabase.from("profiles").select("*").eq("active", true),
      supabase.from("kpi_definitions").select("*").eq("active", true).eq("status", "active"),
      supabase
        .from("v_weekly_score")
        .select("*")
        .eq("year", year)
        .eq("month", month)
        .eq("week", week),
      supabase
        .from("v_kpi_status")
        .select("*")
        .eq("year", year)
        .eq("month", month)
        .eq("week", week),
      supabase
        .from("v_week_summary")
        .select("*")
        .eq("year", year)
        .eq("month", month)
        .eq("week", week),
      supabase
        .from("weekly_submissions")
        .select("*")
        .eq("year", year)
        .eq("month", month)
        .eq("week", week),
      supabase
        .from("todos")
        .select("*")
        .eq("year", year)
        .eq("month", month)
        .eq("week", week)
        .eq("status", "tangguh"),
      supabase
        .from("v_dept_summary")
        .select("*")
        .eq("year", year)
        .eq("month", month)
        .eq("week", week),
      supabase.from("v_weekly_score").select("*").eq("year", year).eq("month", month),
      supabase.from("campaigns").select("*").eq("year", year).eq("month", month),
      supabase
        .from("v_leaderboard")
        .select("*")
        .eq("year", year)
        .eq("month", month)
        .eq("week", week)
        .order("rank"),
    ]);

    setDepartments((deptRows as Department[]) ?? []);
    setProfiles((profileRows as Profile[]) ?? []);
    setKpiDefs((defRows as KpiDefinition[]) ?? []);
    setWeeklyScores((scoreRows as VWeeklyScore[]) ?? []);
    setKpiStatusRows((statusRows as VKpiStatus[]) ?? []);
    setWeekSummaries((summaryRows as VWeekSummary[]) ?? []);
    setSubmissions((subRows as WeeklySubmission[]) ?? []);
    setTangguhTodos((todoRows as Todo[]) ?? []);
    setDeptSummary((deptSumRows as VDeptSummary[]) ?? []);
    setMonthlyScores((monthScoreRows as VWeeklyScore[]) ?? []);
    setCampaigns((campaignRows as Campaign[]) ?? []);
    setLeaderboard((leaderRows as VLeaderboard[]) ?? []);
    setLoading(false);
  }, [year, month, week, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const deptColor = useMemo(() => {
    const map = new Map<string, string>();
    departments.forEach((d) => map.set(d.code, d.color));
    return map;
  }, [departments]);

  const profileMap = useMemo(() => {
    const map = new Map<string, Profile>();
    profiles.forEach((p) => map.set(p.id, p));
    return map;
  }, [profiles]);

  const filteredProfiles = useMemo(
    () => profiles.filter((p) => !deptFilter || p.dept_code === deptFilter),
    [profiles, deptFilter]
  );
  const filteredUserIds = useMemo(
    () => new Set(filteredProfiles.map((p) => p.id)),
    [filteredProfiles]
  );

  const filteredScores = useMemo(
    () => weeklyScores.filter((r) => filteredUserIds.has(r.user_id)),
    [weeklyScores, filteredUserIds]
  );
  const filteredSummaries = useMemo(
    () => weekSummaries.filter((r) => filteredUserIds.has(r.user_id)),
    [weekSummaries, filteredUserIds]
  );
  const filteredSubmissions = useMemo(
    () => submissions.filter((r) => filteredUserIds.has(r.user_id)),
    [submissions, filteredUserIds]
  );
  const filteredTangguh = useMemo(
    () => tangguhTodos.filter((r) => filteredUserIds.has(r.user_id)),
    [tangguhTodos, filteredUserIds]
  );
  const filteredKpiStatus = useMemo(
    () => kpiStatusRows.filter((r) => filteredUserIds.has(r.user_id)),
    [kpiStatusRows, filteredUserIds]
  );
  const filteredDeptSummary = useMemo(
    () => deptSummary.filter((r) => !deptFilter || r.dept_code === deptFilter),
    [deptSummary, deptFilter]
  );

  // ---- Stat card 1: Skor Keseluruhan ----
  const overallScore = avg(
    filteredScores.map((s) => s.kpi_score ?? 0).filter((_, i) => filteredScores[i].kpi_score !== null)
  );
  const scoreStatus = scoreStatusLabel(overallScore);

  // ---- Stat card 2: KPI Dicapai ----
  const totalAchieved = filteredScores.reduce((sum, s) => sum + (s.kpi_achieved ?? 0), 0);
  const totalFilled = filteredScores.reduce((sum, s) => sum + (s.kpi_filled ?? 0), 0);

  // ---- Stat card 3: To-Do Siap ----
  const todoPct = avg(filteredSummaries.map((s) => s.pct ?? 0));
  const todoSiap = filteredSummaries.reduce((sum, s) => sum + s.siap, 0);
  const todoTotal = filteredSummaries.reduce((sum, s) => sum + s.total, 0);

  // ---- Stat card 4: Data KPI Diisi ----
  const defsByPosition = useMemo(() => {
    const map = new Map<string, number>();
    kpiDefs.forEach((d) => map.set(d.position_code, (map.get(d.position_code) ?? 0) + 1));
    return map;
  }, [kpiDefs]);
  const totalExpectedEntries = filteredProfiles.reduce(
    (sum, p) => sum + (p.position_code ? defsByPosition.get(p.position_code) ?? 0 : 0),
    0
  );
  const filledEntries = filteredKpiStatus.filter((r) => r.actual !== null).length;
  const submissionRate =
    totalExpectedEntries > 0 ? (filledEntries / totalExpectedEntries) * 100 : null;

  // ---- Stat card 5: Hantar Tepat Masa ----
  const onTimeCount = filteredSubmissions.filter((s) => s.on_time).length;
  const submittedCount = filteredSubmissions.filter((s) => s.submitted_at).length;
  const onTimeRate =
    filteredProfiles.length > 0 ? (onTimeCount / filteredProfiles.length) * 100 : null;

  // ---- Stat card 6: Isu Perlu Tindakan ----
  const lowKpiWithRemark = filteredKpiStatus.filter(
    (r) => (r.status === "oren" || r.status === "merah") && (r.remark ?? "").trim().length > 0
  ).length;
  const isuCount = filteredTangguh.length + lowKpiWithRemark;

  // ---- Bar / Radar chart data (per department) ----
  const barData: ChartDatum[] = useMemo(
    () =>
      filteredDeptSummary
        .map((d) => ({
          code: d.dept_code ?? "-",
          label:
            departments.find((dep) => dep.code === d.dept_code)?.short_name ??
            d.dept_code ??
            "-",
          value: d.avg_score ?? 0,
          color: deptColor.get(d.dept_code ?? "") ?? "#94a3b8",
        }))
        .sort(
          (a, b) =>
            (departments.find((d) => d.code === a.code)?.sort_order ?? 0) -
            (departments.find((d) => d.code === b.code)?.sort_order ?? 0)
        ),
    [filteredDeptSummary, departments, deptColor]
  );

  // ---- Line chart: trend across M1-M4 for the month ----
  const lineSeries: SeriesDatum[] = useMemo(() => {
    const byDept = new Map<string, (number | null)[]>();
    departments.forEach((d) => byDept.set(d.code, [null, null, null, null]));
    const overall: (number | null)[] = [null, null, null, null];

    for (let w = 1; w <= 4; w++) {
      const rowsThisWeek = monthlyScores.filter(
        (r) => r.week === w && filteredUserIds.has(r.user_id)
      );
      if (rowsThisWeek.length > 0) {
        overall[w - 1] = Number(
          (avg(rowsThisWeek.map((r) => r.kpi_score ?? 0)) ?? 0).toFixed(1)
        );
      }
      departments.forEach((d) => {
        if (deptFilter && d.code !== deptFilter) return;
        const deptRows = rowsThisWeek.filter((r) => r.dept_code === d.code);
        if (deptRows.length > 0) {
          const arr = byDept.get(d.code)!;
          arr[w - 1] = Number((avg(deptRows.map((r) => r.kpi_score ?? 0)) ?? 0).toFixed(1));
        }
      });
    }

    const series: SeriesDatum[] = departments
      .filter((d) => !deptFilter || d.code === deptFilter)
      .map((d) => ({
        code: d.code,
        label: d.short_name,
        color: d.color,
        values: byDept.get(d.code) ?? [null, null, null, null],
      }));

    series.push({
      code: "OVERALL",
      label: "Keseluruhan",
      color: "#F9F9FA",
      values: overall,
    });

    return series;
  }, [monthlyScores, departments, filteredUserIds, deptFilter]);

  const radarData: ChartDatum[] = barData;

  const todoTableRows = useMemo(
    () =>
      filteredProfiles
        .map((p) => {
          const summary = weekSummaries.find((s) => s.user_id === p.id);
          return { profile: p, summary };
        })
        .sort((a, b) => a.profile.full_name.localeCompare(b.profile.full_name)),
    [filteredProfiles, weekSummaries]
  );

  const deptOptions = departments;
  const years = Array.from({ length: 4 }, (_, i) => getCurrentYear() - 2 + i);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">
          {monthName(month)} {year} · Minggu {week}
        </p>
        <h2 className="text-xl font-bold text-white">Dashboard Utama</h2>
        <p className="text-sm text-muted">
          Pantauan prestasi keseluruhan pasukan Masdora.
        </p>
      </div>

      <div className="card flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Tahun</label>
          <select className="input" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Bulan</label>
          <select className="input" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {monthName(m)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Minggu</label>
          <select className="input" value={week} onChange={(e) => setWeek(Number(e.target.value))}>
            {[1, 2, 3, 4].map((w) => (
              <option key={w} value={w}>
                Minggu {w}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Jabatan</label>
          <select
            className="input"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="">Semua Jabatan</option>
            {deptOptions.map((d) => (
              <option key={d.code} value={d.code}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Memuatkan...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard
              index={0}
              icon="🏅"
              label="Skor Keseluruhan"
              value={overallScore !== null ? overallScore.toFixed(1) : "-"}
              caption={scoreStatus.label}
              pill={scoreStatus.pill}
            />
            <StatCard
              index={1}
              icon="🎯"
              label="KPI Dicapai"
              value={`${totalAchieved}/${totalFilled}`}
              caption="KPI dicapai"
            />
            <StatCard
              index={2}
              icon="📋"
              label="To-Do Siap"
              value={todoPct !== null ? `${todoPct.toFixed(0)}%` : "-"}
              caption={`${todoSiap}/${todoTotal} kerja siap`}
            />
            <StatCard
              index={3}
              icon="📝"
              label="Data KPI Diisi"
              value={submissionRate !== null ? `${submissionRate.toFixed(0)}%` : "-"}
              caption={`${filledEntries}/${totalExpectedEntries} diisi`}
            />
            <StatCard
              index={4}
              icon="⏱️"
              label="Hantar Tepat Masa"
              value={onTimeRate !== null ? `${onTimeRate.toFixed(0)}%` : "-"}
              caption={`${onTimeCount}/${submittedCount} hantar tepat`}
            />
            <StatCard
              index={5}
              icon="⚠️"
              label="Isu Perlu Tindakan"
              value={String(isuCount)}
              caption="tugasan/KPI perlu tindakan"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card">
              <h3 className="mb-3 font-semibold text-white">
                Prestasi Mengikut Jabatan
              </h3>
              <BarChart data={barData} />
            </div>
            <div className="card flex flex-col items-center justify-center">
              <h3 className="mb-3 self-start font-semibold text-white">
                Pencapaian Minggu {week}
              </h3>
              <DonutChart pct={overallScore ?? 0} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card">
              <h3 className="mb-3 font-semibold text-white">Trend Mingguan</h3>
              <LineChart series={lineSeries} />
            </div>
            <div className="card">
              <h3 className="mb-3 font-semibold text-white">Peta Prestasi</h3>
              <RadarChart data={radarData} />
            </div>
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-white">Ringkasan Jabatan</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredDeptSummary.length === 0 ? (
                <div className="card text-sm text-muted">
                  Tiada data jabatan untuk tempoh ini.
                </div>
              ) : (
                filteredDeptSummary.map((d, i) => {
                  const dept = departments.find((x) => x.code === d.dept_code);
                  const status = scoreStatusLabel(d.avg_score);
                  const deptSubs = submissions.filter(
                    (s) => profileMap.get(s.user_id)?.dept_code === d.dept_code
                  );
                  const onTime = deptSubs.filter((s) => s.on_time).length;
                  return (
                    <div
                      key={d.dept_code ?? "-"}
                      className="card card-hover animate-rise flex items-center gap-3"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <span
                        className="h-8 w-1.5 flex-shrink-0 rounded-full"
                        style={{ background: dept?.color ?? "#94a3b8" }}
                      />
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-bold text-slate-100">
                              {dept?.name ?? d.dept_code}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {d.headcount} ahli · {onTime}/{deptSubs.length || d.headcount} tepat masa
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-lg font-black text-white">
                            {d.avg_score ?? "-"}%
                          </span>
                          <StatusBadge status={status.pill} />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-white">Kempen Bulanan</h3>
            {campaigns.length === 0 ? (
              <div className="card text-sm text-muted">
                Tiada kempen untuk bulan ini.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {campaigns.map((c, i) => (
                  <div
                    key={c.id}
                    className="card card-hover animate-rise"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-slate-100">{c.name}</p>
                      <span className="pill pill-kosong">{c.type}</span>
                    </div>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-500"
                        style={{ width: `${c.progress}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {c.progress}% · {c.status}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-white">Leaderboard Pantas</h3>
            {leaderboard.length === 0 ? (
              <div className="card text-sm text-muted">
                Tiada data leaderboard untuk tempoh ini.
              </div>
            ) : (
              <div className="card divide-y divide-white/5">
                {leaderboard.slice(0, 3).map((row, i) => (
                  <div
                    key={row.user_id}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 transition first:pt-2 last:pb-2 hover:bg-white/5"
                  >
                    <span className="w-6 text-lg">{MEDALS[i] ?? `#${row.rank}`}</span>
                    <AvatarInitials
                      name={row.full_name}
                      deptColor={deptColor.get(row.dept_code ?? "")}
                      size={32}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        {row.full_name}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {row.position_code ?? "-"}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-brand-400">
                      {row.total_score}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-white">To-Do Mingguan</h3>
              <Link href="/dashboard/todos" className="text-xs font-medium text-brand-400 hover:underline">
                Halaman To-Do →
              </Link>
            </div>
            <div className="card overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Jawatan</th>
                    <th>Siap</th>
                    <th>%</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {todoTableRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-muted">
                        Tiada data untuk tempoh ini.
                      </td>
                    </tr>
                  ) : (
                    todoTableRows.map(({ profile, summary }) => {
                      const status: KpiStatusColor = !summary?.submitted_at
                        ? "kosong"
                        : summary.on_time
                        ? "hijau"
                        : "oren";
                      return (
                        <tr key={profile.id}>
                          <td>
                            <div className="flex items-center gap-2">
                              <AvatarInitials
                                name={profile.full_name}
                                deptColor={deptColor.get(profile.dept_code ?? "")}
                                size={26}
                              />
                              <span>{profile.full_name}</span>
                            </div>
                          </td>
                          <td>{profile.position_code ?? "-"}</td>
                          <td>
                            {summary
                              ? `${summary.siap}/${summary.total}${
                                  summary.tangguh ? ` · ${summary.tangguh}⚠` : ""
                                }`
                              : "-"}
                          </td>
                          <td>{summary?.pct ?? 0}%</td>
                          <td>
                            <span className={`pill pill-${status}`}>
                              {!summary?.submitted_at
                                ? "Belum Hantar"
                                : summary.on_time
                                ? "Tepat Masa"
                                : "Lewat"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const STAT_ACCENTS = [
  "from-masdora-orange/20 to-masdora-orange/5 border-masdora-orange/25",
  "from-masdora-olive/25 to-masdora-olive/5 border-masdora-olive/35",
  "from-masdora-yellow/18 to-masdora-yellow/5 border-masdora-yellow/25",
  "from-masdora-orange/20 to-masdora-orange/5 border-masdora-orange/25",
  "from-masdora-gray/15 to-masdora-gray/5 border-masdora-gray/25",
  "from-masdora-alert/20 to-masdora-alert/5 border-masdora-alert/25",
];

function StatCard({
  icon,
  label,
  value,
  caption,
  pill,
  index = 0,
}: {
  icon: string;
  label: string;
  value: string;
  caption: string;
  pill?: KpiStatusColor;
  index?: number;
}) {
  const accent = STAT_ACCENTS[index % STAT_ACCENTS.length];
  return (
    <div
      className={`animate-rise rounded-2xl border bg-gradient-to-br p-4 ${accent}`}
      style={{ animationDelay: `${index * 60}ms` }}
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
      {pill ? (
        <span className={`pill pill-${pill} mt-1`}>{caption}</span>
      ) : (
        <p className="mt-1 text-[11px] text-slate-400">{caption}</p>
      )}
    </div>
  );
}
