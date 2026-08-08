"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import {
  getCurrentYear,
  getCurrentMonth,
  getCurrentWeekOfMonth,
  monthName,
} from "@/lib/period";
import AvatarInitials from "@/components/AvatarInitials";
import type {
  Campaign,
  Department,
  KpiStatusColor,
  Profile,
  Todo,
  VWeekSummary,
  WeeklySubmission,
} from "@/types/database";

const MEDALS = ["🥇", "🥈", "🥉"];

const cardMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const },
};

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** Tiering for to-do completion percentage. */
function completionTier(pct: number | null): {
  label: string;
  pill: KpiStatusColor;
} {
  if (pct === null) return { label: "Tiada Data", pill: "kosong" };
  if (pct >= 100) return { label: "Lengkap", pill: "hijau" };
  if (pct >= 85) return { label: "Hampir", pill: "kuning" };
  if (pct >= 60) return { label: "Sederhana", pill: "oren" };
  return { label: "Rendah", pill: "merah" };
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
  const [weekSummaries, setWeekSummaries] = useState<VWeekSummary[]>([]);
  const [submissions, setSubmissions] = useState<WeeklySubmission[]>([]);
  const [tangguhTodos, setTangguhTodos] = useState<Todo[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [
      { data: deptRows },
      { data: profileRows },
      { data: summaryRows },
      { data: subRows },
      { data: todoRows },
      { data: campaignRows },
    ] = await Promise.all([
      supabase.from("departments").select("*").order("sort_order"),
      supabase.from("profiles").select("*").eq("active", true),
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
      supabase.from("campaigns").select("*").eq("year", year).eq("month", month),
    ]);

    setDepartments((deptRows as Department[]) ?? []);
    setProfiles((profileRows as Profile[]) ?? []);
    setWeekSummaries((summaryRows as VWeekSummary[]) ?? []);
    setSubmissions((subRows as WeeklySubmission[]) ?? []);
    setTangguhTodos((todoRows as Todo[]) ?? []);
    setCampaigns((campaignRows as Campaign[]) ?? []);
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

  // ---- Stat card 1: To-Do Siap ----
  const todoPct = avg(filteredSummaries.map((s) => s.pct ?? 0));
  const todoSiap = filteredSummaries.reduce((sum, s) => sum + s.siap, 0);
  const todoTotal = filteredSummaries.reduce((sum, s) => sum + s.total, 0);

  // ---- Stat card 2: Hantar Tepat Masa ----
  const onTimeCount = filteredSubmissions.filter((s) => s.on_time).length;
  const submittedCount = filteredSubmissions.filter((s) => s.submitted_at).length;
  const onTimeRate =
    filteredProfiles.length > 0 ? (onTimeCount / filteredProfiles.length) * 100 : null;

  // ---- Stat card 3: Isu Perlu Tindakan ----
  const isuCount = filteredTangguh.length;

  // ---- Ringkasan Jabatan: to-do completion per department ----
  const deptCompletion = useMemo(() => {
    const grouped = new Map<string, number[]>();
    filteredSummaries.forEach((s) => {
      const code = profileMap.get(s.user_id)?.dept_code ?? "-";
      const arr = grouped.get(code) ?? [];
      arr.push(s.pct ?? 0);
      grouped.set(code, arr);
    });
    return departments
      .filter((d) => grouped.has(d.code))
      .map((d) => {
        const pcts = grouped.get(d.code) ?? [];
        return {
          code: d.code,
          name: d.name,
          color: d.color,
          members: pcts.length,
          avgPct: avg(pcts),
        };
      })
      .sort((a, b) => (b.avgPct ?? -1) - (a.avgPct ?? -1));
  }, [filteredSummaries, profileMap, departments]);

  // ---- Leaderboard Pantas: top-3 by to-do completion ----
  const todoLeaders = useMemo(
    () =>
      filteredSummaries
        .map((s) => ({ summary: s, profile: profileMap.get(s.user_id) }))
        .filter((r) => r.profile)
        .sort((a, b) => (b.summary.pct ?? 0) - (a.summary.pct ?? 0))
        .slice(0, 3),
    [filteredSummaries, profileMap]
  );

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
          Pantauan penyiapan to-do dan kempen pasukan Masdora.
        </p>
      </div>

      <motion.div {...cardMotion} className="card flex flex-wrap items-end gap-4">
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
      </motion.div>

      {loading ? (
        <p className="text-sm text-muted">Memuatkan...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              index={0}
              icon="📋"
              label="To-Do Siap"
              value={todoPct !== null ? `${todoPct.toFixed(0)}%` : "-"}
              caption={`${todoSiap}/${todoTotal} kerja siap`}
            />
            <StatCard
              index={1}
              icon="⏱️"
              label="Hantar Tepat Masa"
              value={onTimeRate !== null ? `${onTimeRate.toFixed(0)}%` : "-"}
              caption={`${onTimeCount}/${submittedCount} hantar tepat`}
            />
            <StatCard
              index={2}
              icon="⚠️"
              label="Isu Perlu Tindakan"
              value={String(isuCount)}
              caption="tugasan tangguh perlu tindakan"
            />
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-white">Ringkasan Jabatan</h3>
            <p className="mb-2 text-xs text-slate-500">
              Purata penyiapan to-do mengikut jabatan bagi Minggu {week}.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {deptCompletion.length === 0 ? (
                <motion.div {...cardMotion} className="card text-sm text-muted">
                  Tiada data jabatan untuk tempoh ini.
                </motion.div>
              ) : (
                deptCompletion.map((d, i) => {
                  const tier = completionTier(d.avgPct);
                  return (
                    <motion.div
                      key={d.code}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.45,
                        delay: i * 0.06,
                        ease: [0.4, 0, 0.2, 1],
                      }}
                      className="card card-hover flex items-center gap-3"
                    >
                      <span
                        className="h-8 w-1.5 flex-shrink-0 rounded-full"
                        style={{ background: d.color }}
                      />
                      <div className="flex-1">
                        <p className="font-bold text-slate-100">{d.name}</p>
                        <p className="text-[11px] text-slate-500">{d.members} ahli</p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-lg font-black text-white">
                            {d.avgPct !== null ? `${d.avgPct.toFixed(0)}%` : "-"}
                          </span>
                          <span className={`pill pill-${tier.pill}`}>{tier.label}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-white">Kempen Bulanan</h3>
            {campaigns.length === 0 ? (
              <motion.div {...cardMotion} className="card text-sm text-muted">
                Tiada kempen untuk bulan ini.
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {campaigns.map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.45,
                      delay: i * 0.06,
                      ease: [0.4, 0, 0.2, 1],
                    }}
                    className="card card-hover"
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
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-white">Leaderboard Pantas</h3>
            <p className="mb-2 text-xs text-slate-500">
              Tiga teratas penyiapan to-do bagi Minggu {week}.
            </p>
            {todoLeaders.length === 0 ? (
              <motion.div {...cardMotion} className="card text-sm text-muted">
                Tiada data leaderboard untuk tempoh ini.
              </motion.div>
            ) : (
              <div className="card divide-y divide-white/5">
                {todoLeaders.map(({ summary, profile }, i) => (
                  <motion.div
                    key={summary.user_id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.45,
                      delay: i * 0.06,
                      ease: [0.4, 0, 0.2, 1],
                    }}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 transition first:pt-2 last:pb-2 hover:bg-white/5"
                  >
                    <span className="w-6 text-lg">{MEDALS[i] ?? `#${i + 1}`}</span>
                    <AvatarInitials
                      name={profile!.full_name}
                      deptColor={deptColor.get(profile!.dept_code ?? "")}
                      size={32}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        {profile!.full_name}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {profile!.position_code ?? "-"}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-brand-400">
                      {summary.pct ?? 0}%
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold text-white">
                  Weekly To-Do List Team
                </h3>
                <p className="text-[11px] text-slate-500">
                  Tarikh akhir: Jumaat sebelum 5:00 petang
                </p>
              </div>
              <Link href="/dashboard/todos" className="text-xs font-medium text-brand-400 hover:underline">
                Lihat laporan penuh →
              </Link>
            </div>
            <motion.div {...cardMotion} className="card overflow-x-auto">
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
                    todoTableRows.map(({ profile, summary }, i) => {
                      const status: KpiStatusColor = !summary?.submitted_at
                        ? "kosong"
                        : summary.on_time
                        ? "hijau"
                        : "oren";
                      return (
                        <motion.tr
                          key={profile.id}
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.45,
                            delay: i * 0.06,
                            ease: [0.4, 0, 0.2, 1],
                          }}
                        >
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
                        </motion.tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </motion.div>
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
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        delay: index * 0.06,
        ease: [0.4, 0, 0.2, 1],
      }}
      className={`rounded-2xl border bg-gradient-to-br p-4 ${accent}`}
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
    </motion.div>
  );
}
