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

/** Sasaran bulanan dipecah sama rata kepada 4 minggu. */
const MINGGU_SEBULAN = 4;

/**
 * Sasaran jualan lalai: RM100,000 sebulan.
 *
 * Ditetapkan dalam kod supaya angka Sasaran, % Sasaran dan GAP terus
 * kelihatan tanpa perlu memasukkan apa-apa ke database. Kalau sasaran
 * khusus DIADA dalam jadual `sales_targets`, nilai itu mengatasi lalai ini —
 * jadi sasaran individu masih boleh diubah tanpa menyentuh kod.
 */
const SASARAN_LALAI_RM = 100_000;

/** Jawatan yang mempunyai sasaran jualan: semua CS + videographer produk. */
const JAWATAN_BERSASARAN = [
  "CS_AGENT",
  "CS_WEB",
  "CS_SHOPEE",
  "CS_TIKTOK",
  "VID_PROD",
];

/** Sasaran berkesan bagi seseorang. */
function sasaranUntuk(
  sasaranDb: number | null | undefined,
  positionCode: string | null | undefined
): number | null {
  if (sasaranDb && sasaranDb > 0) return sasaranDb;
  if (positionCode && JAWATAN_BERSASARAN.includes(positionCode)) {
    return SASARAN_LALAI_RM;
  }
  return null;
}

function peratusSasaran(
  capai: number | null,
  sasaran: number | null
): number | null {
  if (!sasaran || sasaran <= 0) return null;
  return Math.round(((capai ?? 0) / sasaran) * 1000) / 10;
}

/**
 * Berapa lagi diperlukan untuk mencapai sasaran.
 *
 * Bila sasaran sudah dilepasi, GAP dipaparkan sebagai lebihan dan bukan
 * nombor negatif — "RM 0 lagi" mengelirukan bagi orang yang sudah menang.
 */
function GapSasaran({
  capai,
  sasaran,
}: {
  capai: number | null;
  sasaran: number | null;
}) {
  if (!sasaran || sasaran <= 0) {
    return <span className="text-slate-500">-</span>;
  }

  const baki = sasaran - (capai ?? 0);

  if (baki <= 0) {
    return (
      <span className="font-bold text-masdora-olive">
        ✓ Lebih {formatRM(Math.abs(baki))}
      </span>
    );
  }

  // Merah bila lebih separuh sasaran masih berbaki — perlu perhatian.
  const kritikal = baki > sasaran * 0.5;
  return (
    <span
      className={`font-bold ${kritikal ? "text-red-300" : "text-amber-200"}`}
    >
      {formatRM(baki)} lagi
    </span>
  );
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
  /** Sasaran & pencapaian BULANAN — untuk memaparkan GAP bulanan di sini. */
  const [bulanan, setBulanan] = useState<
    Map<string, { total: number; sasaran: number | null }>
  >(new Map());
  /**
   * Jawatan diperlukan berasingan kerana seseorang mungkin ada jualan
   * mingguan tetapi belum muncul dalam ringkasan bulanan.
   */
  const [jawatanMinggu, setJawatanMinggu] = useState<
    Map<string, string | null>
  >(new Map());

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data }, { data: bln }, { data: prof }] = await Promise.all([
      supabase
        .from("v_sales_rank_weekly")
        .select("*")
        .eq("year", week.year)
        .eq("month", week.month)
        .eq("week", week.week)
        .order("rank"),
      // GAP yang paling bermakna ialah GAP ke sasaran BULANAN, jadi
      // pencapaian sepanjang bulan diambil sekali walaupun paparan ini
      // mingguan.
      supabase
        .from("v_sales_rank_monthly")
        .select("user_id, total_rm, target_rm")
        .eq("year", week.year)
        .eq("month", week.month),
      supabase.from("profiles").select("id, position_code"),
    ]);

    setRows((data as VSalesRankWeekly[]) ?? []);

    const petaJawatan = new Map(
      ((prof as { id: string; position_code: string | null }[]) ?? []).map(
        (p) => [p.id, p.position_code]
      )
    );

    setBulanan(
      new Map(
        ((bln as { user_id: string; total_rm: number; target_rm: number | null }[]) ??
          []).map((b) => [
          b.user_id,
          {
            total: b.total_rm ?? 0,
            sasaran: sasaranUntuk(b.target_rm, petaJawatan.get(b.user_id)),
          },
        ])
      )
    );
    setJawatanMinggu(petaJawatan);
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
    {
      key: "target_minggu",
      header: "Sasaran Minggu",
      render: (r) => {
        const s =
          bulanan.get(r.user_id)?.sasaran ??
          sasaranUntuk(null, jawatanMinggu.get(r.user_id));
        return s ? (
          formatRM(s / MINGGU_SEBULAN)
        ) : (
          <span className="text-slate-500">-</span>
        );
      },
    },
    {
      key: "pct_minggu",
      header: "% Sasaran Minggu",
      render: (r) => {
        const s =
          bulanan.get(r.user_id)?.sasaran ??
          sasaranUntuk(null, jawatanMinggu.get(r.user_id));
        const { label, pill } = pctPill(
          peratusSasaran(r.total_rm, s ? s / MINGGU_SEBULAN : null)
        );
        return <span className={`pill pill-${pill}`}>{label}</span>;
      },
    },
    {
      key: "gap_minggu",
      header: "GAP Minggu",
      render: (r) => {
        const s =
          bulanan.get(r.user_id)?.sasaran ??
          sasaranUntuk(null, jawatanMinggu.get(r.user_id));
        return (
          <GapSasaran
            capai={r.total_rm}
            sasaran={s ? s / MINGGU_SEBULAN : null}
          />
        );
      },
    },
    {
      key: "gap_bulan",
      header: "GAP Bulan",
      render: (r) => {
        const b = bulanan.get(r.user_id);
        return <GapSasaran capai={b?.total ?? 0} sasaran={b?.sasaran ?? null} />;
      },
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
  /** user_id -> position_code, untuk menentukan siapa ada sasaran jualan. */
  const [jawatan, setJawatan] = useState<Map<string, string | null>>(new Map());

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data }, { data: prof }] = await Promise.all([
      supabase
        .from("v_sales_rank_monthly")
        .select("*")
        .eq("year", year)
        .eq("month", month)
        .order("rank"),
      supabase.from("profiles").select("id, position_code"),
    ]);
    setRows((data as VSalesRankMonthly[]) ?? []);
    setJawatan(
      new Map(
        ((prof as { id: string; position_code: string | null }[]) ?? []).map(
          (p) => [p.id, p.position_code]
        )
      )
    );
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
      render: (r) => formatRM(sasaranUntuk(r.target_rm, jawatan.get(r.user_id))),
    },
    {
      key: "pct_target",
      header: "% Sasaran",
      render: (r) => {
        const { label, pill } = pctPill(
          peratusSasaran(
            r.total_rm,
            sasaranUntuk(r.target_rm, jawatan.get(r.user_id))
          )
        );
        return <span className={`pill pill-${pill}`}>{label}</span>;
      },
    },
    {
      key: "gap",
      header: "GAP ke Sasaran",
      render: (r) => (
        <GapSasaran
          capai={r.total_rm}
          sasaran={sasaranUntuk(r.target_rm, jawatan.get(r.user_id))}
        />
      ),
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
