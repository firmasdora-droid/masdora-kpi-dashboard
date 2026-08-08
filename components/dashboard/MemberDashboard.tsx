"use client";

import { useCallback, useEffect, useState } from "react";
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
  Todo,
  VSalesRankMonthly,
  VWeekSummary,
} from "@/types/database";

const cardMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const },
};

const MEDALS = ["🥇", "🥈", "🥉"];

function formatRM(n: number | string | null | undefined): string {
  return `RM ${Number(n ?? 0).toLocaleString("ms-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function MemberDashboard({
  userId,
  fullName,
}: {
  userId: string;
  fullName: string;
}) {
  const supabase = createClient();

  const year = getCurrentYear();
  const month = getCurrentMonth();
  const week = getCurrentWeekOfMonth();

  const [summary, setSummary] = useState<VWeekSummary | null>(null);
  const [openTodos, setOpenTodos] = useState<Todo[]>([]);
  const [salesRank, setSalesRank] = useState<VSalesRankMonthly[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [
      { data: summaryRows },
      { data: todoRows },
      { data: rankRows },
      { data: campaignRows },
    ] = await Promise.all([
      supabase
        .from("v_week_summary")
        .select("*")
        .eq("user_id", userId)
        .eq("year", year)
        .eq("month", month)
        .eq("week", week),
      supabase
        .from("todos")
        .select("*")
        .eq("user_id", userId)
        .eq("year", year)
        .eq("month", month)
        .eq("week", week)
        .neq("status", "siap")
        .order("sort_order")
        .limit(6),
      supabase
        .from("v_sales_rank_monthly")
        .select("*")
        .eq("year", year)
        .eq("month", month)
        .order("rank")
        .limit(5),
      supabase
        .from("campaigns")
        .select("*")
        .eq("year", year)
        .eq("month", month)
        .order("progress", { ascending: false })
        .limit(3),
    ]);

    setSummary(((summaryRows as VWeekSummary[]) ?? [])[0] ?? null);
    setOpenTodos((todoRows as Todo[]) ?? []);
    setSalesRank((rankRows as VSalesRankMonthly[]) ?? []);
    setCampaigns((campaignRows as Campaign[]) ?? []);
    setLoading(false);
  }, [supabase, userId, year, month, week]);

  useEffect(() => {
    load();
  }, [load]);

  const myRank = salesRank.find((r) => r.user_id === userId) ?? null;
  const todoPct = summary?.pct ?? 0;
  const firstName = fullName.split(/\s+/)[0];

  if (loading) {
    return <p className="text-sm text-muted">Memuatkan dashboard...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">
          {monthName(month)} {year} · Minggu {week}
        </p>
        <h2 className="text-xl font-bold text-white">
          Selamat kembali, {firstName} 👋
        </h2>
        <p className="text-sm text-muted">
          Ringkasan kerja anda minggu ini.
        </p>
      </div>

      {/* Ringkasan peribadi */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <motion.div
          {...cardMotion}
          className="rounded-2xl border border-masdora-orange/25 bg-gradient-to-br from-masdora-orange/20 to-masdora-orange/5 p-5"
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
            To-Do Minggu Ini
          </p>
          <p className="mt-1 text-3xl font-black text-white">
            {Math.round(Number(todoPct))}%
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {summary ? `${summary.siap}/${summary.total} kerja siap` : "Belum ada to-do"}
          </p>
        </motion.div>

        <motion.div
          {...cardMotion}
          transition={{ ...cardMotion.transition, delay: 0.06 }}
          className="rounded-2xl border border-masdora-olive/35 bg-gradient-to-br from-masdora-olive/25 to-masdora-olive/5 p-5"
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
            Jualan Saya Bulan Ini
          </p>
          <p className="mt-1 text-3xl font-black text-white">
            {myRank ? formatRM(myRank.total_rm) : formatRM(0)}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {myRank?.target_rm
              ? `${myRank.pct_target ?? 0}% dari sasaran ${formatRM(myRank.target_rm)}`
              : "Tiada sasaran ditetapkan"}
          </p>
        </motion.div>

        <motion.div
          {...cardMotion}
          transition={{ ...cardMotion.transition, delay: 0.12 }}
          className="rounded-2xl border border-masdora-yellow/25 bg-gradient-to-br from-masdora-yellow/18 to-masdora-yellow/5 p-5"
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
            Kedudukan Jualan
          </p>
          <p className="mt-1 text-3xl font-black text-white">
            {myRank ? `#${myRank.rank}` : "—"}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {myRank ? "kedudukan bulan ini" : "belum ada rekod jualan"}
          </p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Kerja belum siap */}
        <motion.div {...cardMotion} className="card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-white">Kerja Belum Siap</h3>
            <Link
              href="/dashboard/todos"
              className="text-xs font-semibold text-brand-400 hover:underline"
            >
              Semua To-Do →
            </Link>
          </div>
          {openTodos.length === 0 ? (
            <p className="text-sm text-muted">
              Tiada kerja tertunggak. Bagus! 🎉
            </p>
          ) : (
            <div className="space-y-2">
              {openTodos.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                >
                  <span
                    className={`h-2 w-2 flex-shrink-0 rounded-full ${
                      t.status === "tangguh"
                        ? "bg-red-400"
                        : t.status === "proses"
                        ? "bg-amber-400"
                        : "bg-slate-500"
                    }`}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-200">
                    {t.title}
                  </span>
                  <span className="flex-shrink-0 text-xs font-bold text-slate-400">
                    {t.pct}%
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Leaderboard jualan */}
        <motion.div
          {...cardMotion}
          transition={{ ...cardMotion.transition, delay: 0.06 }}
          className="card"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-white">Leaderboard Jualan</h3>
            <Link
              href="/dashboard/leaderboard"
              className="text-xs font-semibold text-brand-400 hover:underline"
            >
              Lihat semua →
            </Link>
          </div>
          {salesRank.length === 0 ? (
            <p className="text-sm text-muted">
              Belum ada rekod jualan untuk bulan ini.
            </p>
          ) : (
            <div className="space-y-2">
              {salesRank.map((r, i) => {
                const isMe = r.user_id === userId;
                return (
                  <motion.div
                    key={r.user_id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                    className={`flex items-center gap-3 rounded-xl border p-3 ${
                      isMe
                        ? "border-masdora-orange/40 bg-masdora-orange/10"
                        : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <span className="w-6 text-center text-sm">
                      {MEDALS[i] ?? `#${r.rank}`}
                    </span>
                    <AvatarInitials name={r.full_name} size={30} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-100">
                      {r.full_name}
                      {isMe && (
                        <span className="ml-1.5 text-[10px] font-bold text-masdora-orange">
                          ANDA
                        </span>
                      )}
                    </span>
                    <span className="flex-shrink-0 text-sm font-black text-white">
                      {formatRM(r.total_rm)}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Kempen bulan ini */}
      {campaigns.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold text-white">Kempen Bulan Ini</h3>
            <Link
              href="/dashboard/campaigns"
              className="text-xs font-semibold text-brand-400 hover:underline"
            >
              Semua kempen →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {campaigns.map((c, i) => (
              <motion.div
                key={c.id}
                {...cardMotion}
                transition={{ ...cardMotion.transition, delay: i * 0.05 }}
                className="card"
              >
                <p className="truncate font-bold text-slate-100">{c.name}</p>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600"
                    initial={{ width: 0 }}
                    animate={{ width: `${c.progress}%` }}
                    transition={{ duration: 0.7, delay: 0.2 + i * 0.08 }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {c.progress}% · {c.status}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
