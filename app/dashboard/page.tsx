import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentYear,
  getCurrentMonth,
  getCurrentWeekOfMonth,
  monthName,
} from "@/lib/period";
import type { VWeeklyScore, VWeekSummary, VLeaderboard } from "@/types/database";

export default async function OverviewPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const year = getCurrentYear();
  const month = getCurrentMonth();
  const week = getCurrentWeekOfMonth();

  let weeklyScore: VWeeklyScore | null = null;
  let weekSummary: VWeekSummary | null = null;
  let leaderboardRow: VLeaderboard | null = null;

  if (user) {
    const [scoreRes, summaryRes, leaderRes] = await Promise.all([
      supabase
        .from("v_weekly_score")
        .select("*")
        .eq("user_id", user.id)
        .eq("year", year)
        .eq("month", month)
        .eq("week", week)
        .maybeSingle<VWeeklyScore>(),
      supabase
        .from("v_week_summary")
        .select("*")
        .eq("user_id", user.id)
        .eq("year", year)
        .eq("month", month)
        .eq("week", week)
        .maybeSingle<VWeekSummary>(),
      supabase
        .from("v_leaderboard")
        .select("*")
        .eq("user_id", user.id)
        .eq("year", year)
        .eq("month", month)
        .eq("week", week)
        .maybeSingle<VLeaderboard>(),
    ]);

    weeklyScore = scoreRes.data ?? null;
    weekSummary = summaryRes.data ?? null;
    leaderboardRow = leaderRes.data ?? null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-brand-800">
          Ringkasan Minggu {week} - {monthName(month)} {year}
        </h2>
        <p className="text-sm text-gray-500">
          Prestasi anda untuk minggu semasa.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-xs text-gray-500">Skor KPI</p>
          <p className="mt-1 text-2xl font-bold text-brand-700">
            {weeklyScore?.kpi_score ?? "-"}
          </p>
          <p className="text-xs text-gray-400">
            {weeklyScore
              ? `${weeklyScore.kpi_achieved}/${weeklyScore.kpi_filled} KPI dicapai`
              : "Belum ada data KPI"}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">To-Do Selesai</p>
          <p className="mt-1 text-2xl font-bold text-brand-700">
            {weekSummary ? `${weekSummary.pct ?? 0}%` : "-"}
          </p>
          <p className="text-xs text-gray-400">
            {weekSummary
              ? `${weekSummary.siap}/${weekSummary.total} tugasan siap`
              : "Belum ada to-do"}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">Status Penghantaran</p>
          <p className="mt-1 text-2xl font-bold text-brand-700">
            {weekSummary?.submitted_at
              ? weekSummary.on_time
                ? "Tepat Masa"
                : "Lewat"
              : "Belum Hantar"}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">Ranking Leaderboard</p>
          <p className="mt-1 text-2xl font-bold text-brand-700">
            {leaderboardRow ? `#${leaderboardRow.rank}` : "-"}
          </p>
          <p className="text-xs text-gray-400">
            Skor keseluruhan: {leaderboardRow?.total_score ?? "-"}
          </p>
        </div>
      </div>

      <div className="card">
        <h3 className="mb-3 font-semibold text-brand-800">Pautan Pantas</h3>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/kpi" className="btn-secondary">
            Isi / Semak KPI
          </Link>
          <Link href="/dashboard/todos" className="btn-secondary">
            Urus To-Do Mingguan
          </Link>
          <Link href="/dashboard/leaderboard" className="btn-secondary">
            Lihat Leaderboard
          </Link>
          <Link href="/dashboard/sales" className="btn-secondary">
            Key-in Jualan
          </Link>
          <Link href="/dashboard/campaigns" className="btn-secondary">
            Lihat Kempen
          </Link>
        </div>
      </div>
    </div>
  );
}
