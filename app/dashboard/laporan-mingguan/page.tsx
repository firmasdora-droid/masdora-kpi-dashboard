"use client";

/**
 * Laporan Ringkas Mingguan — untuk Marketing Manager & CEO.
 *
 * Menghimpunkan SEMUA sumber dalam satu dokumen sedia-cetak:
 *   To-Do Team · Jualan · Prestasi Konten · Tugasan Grafik ·
 *   Isu Pelanggan · Recovery CRM · Kempen & Pelancaran
 *
 * Laporan dipapar atas "kertas putih" walaupun dashboard bertema gelap,
 * supaya PDF yang dihantar kepada CEO kelihatan seperti dokumen sebenar.
 * Cetakan dikendalikan oleh @media print dalam globals.css (#laporan-cetak).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getCurrentYear,
  getCurrentMonth,
  getCurrentWeekOfMonth,
  monthName,
  weekDateRange,
  isInWeek,
  shiftWeek,
  type WeekRange,
} from "@/lib/period";
import MasdoraLogomark from "@/components/MasdoraLogomark";
import type { Profile, Sale, Todo, WeeklySubmission } from "@/types/database";

// ---------------------------------------------------------------- jenis data

interface RecoveryRecord {
  id: number;
  customer_name: string | null;
  status: string | null;
  amount_rm: number;
  contacted_at: string | null;
  handler_code: string | null;
}

interface ContentPost {
  postedAt: string;
  monthTab: string;
  handler: string;
  account: string;
  contentType: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

interface GraphicTask {
  taskId: string;
  title: string;
  doneBy: string;
  category: string;
  status: "selesai" | "semakan" | "proses" | "baru";
  statusRaw: string;
  assignDate: string;
  deadline: string;
  deadlineIso: string | null;
  overdue: boolean;
}

interface CsIssue {
  reportedAt: string;
  username: string;
  platform: string;
  description: string;
  handler: string;
  status: string;
}

interface CampaignItem {
  product: string;
  category: string;
  month: string;
  launchIso: string | null;
  launchDate: string;
  status: string;
  statusRaw: string;
}

const MANAGEMENT_ROLES = ["manager", "ceo"];

// ---------------------------------------------------------------- pembantu

function rm(n: number): string {
  return `RM ${n.toLocaleString("ms-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function num(n: number): string {
  return n.toLocaleString("ms-MY");
}

/**
 * "3/1/2026, 3.00pm" (hari/bulan/tahun) -> "2026-01-03"
 *
 * Team kadang-kadang tersalah taip pemisah ("05//02/26", "31/04.26"), jadi
 * pemisah berganda dan titik dinormalkan dahulu sebelum dibaca.
 */
function parseContentDate(raw: string): string | null {
  const bersih = raw.trim().replace(/[.\-/]{1,3}/g, "/");
  const m = bersih.match(/^(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{2,4})/);
  if (!m) return null;
  const day = Number(m[1]);
  const mon = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  if (!day || !mon || mon > 12 || day > 31) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${year}-${p(mon)}-${p(day)}`;
}

/** "10/08/2026" -> "2026-08-10" */
function parseDmy(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!m) return null;
  let year = Number(m[3]);
  if (year < 100) year += 2000;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${year}-${p(Number(m[2]))}-${p(Number(m[1]))}`;
}

function sortedEntries(m: Map<string, number>): [string, number][] {
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
}

// ---------------------------------------------------------------- halaman

export default function LaporanMingguanPage() {
  const supabase = createClient();

  const [period, setPeriod] = useState({
    year: getCurrentYear(),
    month: getCurrentMonth(),
    week: getCurrentWeekOfMonth(),
  });

  const [me, setMe] = useState<Profile | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [subs, setSubs] = useState<WeeklySubmission[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [recovery, setRecovery] = useState<RecoveryRecord[]>([]);
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [tasks, setTasks] = useState<GraphicTask[]>([]);
  const [issues, setIssues] = useState<CsIssue[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string>("");

  const range: WeekRange = useMemo(
    () => weekDateRange(period.year, period.month, period.week),
    [period]
  );

  const todayIso = new Date().toISOString().slice(0, 10);
  const isFuture = range.startIso > todayIso;
  const isPartial = range.startIso <= todayIso && range.endIso >= todayIso;

  // ---------- kebenaran ----------
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setAllowed(false);
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle<Profile>();
      setMe(prof ?? null);
      setAllowed(!!prof && MANAGEMENT_ROLES.includes(prof.role));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- kumpul data ----------
  const load = useCallback(async () => {
    setLoading(true);
    const warn: string[] = [];

    const [
      { data: profileRows },
      { data: todoRows },
      { data: subRows },
      { data: saleRows, error: saleErr },
      { data: recoveryRows, error: recErr },
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("active", true).order("full_name"),
      supabase
        .from("todos")
        .select("*")
        .eq("year", period.year)
        .eq("month", period.month)
        .eq("week", period.week),
      supabase
        .from("weekly_submissions")
        .select("*")
        .eq("year", period.year)
        .eq("month", period.month)
        .eq("week", period.week),
      supabase
        .from("sales")
        .select("*")
        .gte("date", range.startIso)
        .lte("date", range.endIso),
      supabase
        .from("recovery_records")
        .select("id, customer_name, status, amount_rm, contacted_at, handler_code")
        .gte("contacted_at", range.startIso)
        .lte("contacted_at", range.endIso),
    ]);

    if (saleErr) warn.push("Jualan: " + saleErr.message);
    if (recErr) warn.push("Recovery CRM: " + recErr.message);

    setProfiles((profileRows as Profile[]) ?? []);
    setTodos((todoRows as Todo[]) ?? []);
    setSubs((subRows as WeeklySubmission[]) ?? []);
    setSales((saleRows as Sale[]) ?? []);
    setRecovery((recoveryRows as RecoveryRecord[]) ?? []);

    // Setiap sumber Google Sheet gagal secara berasingan, supaya satu sheet
    // yang bermasalah tidak mematikan seluruh laporan.
    async function sheet<T>(
      url: string,
      key: string,
      nama: string
    ): Promise<T[]> {
      try {
        const res = await fetch(url, { cache: "no-store" });
        const json = await res.json();
        if (!json.ok) {
          warn.push(`${nama}: ${json.error ?? "gagal dibaca"}`);
          return [];
        }
        return (json[key] as T[]) ?? [];
      } catch {
        warn.push(`${nama}: gagal dihubungi`);
        return [];
      }
    }

    const [postRows, taskRows, issueRows, campaignRows] = await Promise.all([
      sheet<ContentPost>("/api/content-log", "posts", "Prestasi Konten"),
      sheet<GraphicTask>("/api/graphic-tasks", "tasks", "Tugasan Grafik"),
      sheet<CsIssue>("/api/cs-issues", "issues", "Isu Pelanggan"),
      sheet<CampaignItem>("/api/campaign-log", "items", "Kempen & Pelancaran"),
    ]);

    setPosts(postRows);
    setTasks(taskRows);
    setIssues(issueRows);
    setCampaigns(campaignRows);
    setWarnings(warn);
    setGeneratedAt(new Date().toLocaleString("ms-MY"));
    setLoading(false);
  }, [supabase, period, range.startIso, range.endIso]);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  // ---------- To-Do Team ----------
  const team = useMemo(
    () => profiles.filter((p) => !MANAGEMENT_ROLES.includes(p.role)),
    [profiles]
  );

  const todoRows = useMemo(
    () =>
      team
        .map((p) => {
          const mine = todos.filter((t) => t.user_id === p.id);
          const sub = subs.find((s) => s.user_id === p.id) ?? null;
          const pct =
            mine.length > 0
              ? Math.round(
                  mine.reduce((s, t) => s + (t.pct ?? 0), 0) / mine.length
                )
              : 0;
          return {
            profile: p,
            total: mine.length,
            siap: mine.filter((t) => t.status === "siap").length,
            tangguh: mine.filter((t) => t.status === "tangguh").length,
            pct,
            sub,
          };
        })
        .sort((a, b) => {
          const aS = a.sub?.submitted_at ? 1 : 0;
          const bS = b.sub?.submitted_at ? 1 : 0;
          if (aS !== bS) return aS - bS;
          return b.pct - a.pct;
        }),
    [team, todos, subs]
  );

  const submittedCount = todoRows.filter((r) => r.sub?.submitted_at).length;
  const onTimeCount = todoRows.filter((r) => r.sub?.on_time).length;
  const avgPct =
    todoRows.length > 0
      ? Math.round(todoRows.reduce((s, r) => s + r.pct, 0) / todoRows.length)
      : 0;

  // ---------- Jualan ----------
  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((p) => m.set(p.id, p.full_name));
    return m;
  }, [profiles]);

  const salesTotal = sales.reduce((s, x) => s + Number(x.amount_rm ?? 0), 0);

  const salesByPerson = useMemo(() => {
    const m = new Map<string, number>();
    sales.forEach((s) => {
      const key = nameById.get(s.user_id) ?? "Tidak dikenali";
      m.set(key, (m.get(key) ?? 0) + Number(s.amount_rm ?? 0));
    });
    return sortedEntries(m);
  }, [sales, nameById]);

  const salesByPlatform = useMemo(() => {
    const m = new Map<string, number>();
    sales.forEach((s) => {
      const key = s.platform ?? "-";
      m.set(key, (m.get(key) ?? 0) + Number(s.amount_rm ?? 0));
    });
    return sortedEntries(m);
  }, [sales]);

  // ---------- Prestasi Konten ----------
  const contentWeek = useMemo(() => {
    let kosong = 0; // tarikh tidak diisi oleh team
    let rosak = 0; // tarikh diisi tetapi formatnya salah
    const dalam = posts.filter((p) => {
      const iso = parseContentDate(p.postedAt);
      if (!iso) {
        if (p.postedAt.trim() === "") kosong++;
        else rosak++;
        return false;
      }
      return isInWeek(iso, range);
    });
    return { dalam, kosong, rosak };
  }, [posts, range]);

  const contentTotals = useMemo(() => {
    const d = contentWeek.dalam;
    return {
      bilangan: d.length,
      views: d.reduce((s, p) => s + p.views, 0),
      likes: d.reduce((s, p) => s + p.likes, 0),
      comments: d.reduce((s, p) => s + p.comments, 0),
      shares: d.reduce((s, p) => s + p.shares, 0),
    };
  }, [contentWeek]);

  const contentByHandler = useMemo(() => {
    const m = new Map<string, { bilangan: number; views: number }>();
    contentWeek.dalam.forEach((p) => {
      const cur = m.get(p.handler) ?? { bilangan: 0, views: 0 };
      cur.bilangan += 1;
      cur.views += p.views;
      m.set(p.handler, cur);
    });
    return Array.from(m.entries()).sort((a, b) => b[1].views - a[1].views);
  }, [contentWeek]);

  // ---------- Tugasan Grafik ----------
  const tasksWeek = useMemo(
    () =>
      tasks.filter((t) => {
        const assign = parseDmy(t.assignDate);
        return isInWeek(assign, range) || isInWeek(t.deadlineIso, range);
      }),
    [tasks, range]
  );

  const taskCounts = useMemo(() => {
    const c = { selesai: 0, semakan: 0, proses: 0, baru: 0 };
    tasksWeek.forEach((t) => c[t.status]++);
    return c;
  }, [tasksWeek]);

  const taskOverdue = tasksWeek.filter((t) => t.overdue);

  const tasksByDesigner = useMemo(() => {
    const m = new Map<string, { selesai: number; belum: number }>();
    tasksWeek.forEach((t) => {
      if (!t.doneBy) return;
      const cur = m.get(t.doneBy) ?? { selesai: 0, belum: 0 };
      if (t.status === "selesai") cur.selesai += 1;
      else cur.belum += 1;
      m.set(t.doneBy, cur);
    });
    return Array.from(m.entries()).sort(
      (a, b) => b[1].selesai + b[1].belum - (a[1].selesai + a[1].belum)
    );
  }, [tasksWeek]);

  // ---------- Isu Pelanggan ----------
  const issuesWeek = useMemo(
    () => issues.filter((i) => isInWeek(i.reportedAt, range)),
    [issues, range]
  );

  const issuesByStatus = useMemo(() => {
    const m = new Map<string, number>();
    issuesWeek.forEach((i) => m.set(i.status, (m.get(i.status) ?? 0) + 1));
    return sortedEntries(m);
  }, [issuesWeek]);

  const issuesByHandler = useMemo(() => {
    const m = new Map<string, number>();
    issuesWeek.forEach((i) => m.set(i.handler, (m.get(i.handler) ?? 0) + 1));
    return sortedEntries(m);
  }, [issuesWeek]);

  // ---------- Recovery CRM ----------
  const recoveryTotal = recovery.reduce(
    (s, r) => s + Number(r.amount_rm ?? 0),
    0
  );
  const recoveryByStatus = useMemo(() => {
    const m = new Map<string, number>();
    recovery.forEach((r) => {
      const k = r.status || "Tiada status";
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return sortedEntries(m);
  }, [recovery]);

  // ---------- Kempen ----------
  const campaignsWeek = useMemo(
    () => campaigns.filter((c) => isInWeek(c.launchIso, range)),
    [campaigns, range]
  );
  const campaignsNext = useMemo(() => {
    return campaigns
      .filter((c) => c.launchIso && c.launchIso > range.endIso)
      .sort((a, b) => (a.launchIso ?? "").localeCompare(b.launchIso ?? ""))
      .slice(0, 6);
  }, [campaigns, range.endIso]);

  // ---------- paparan ----------
  if (allowed === null) {
    return <p className="text-sm text-muted">Memuatkan...</p>;
  }
  if (!allowed) {
    return (
      <div className="card">
        <p className="font-bold text-white">Halaman ini terhad</p>
        <p className="mt-1 text-sm text-muted">
          Laporan Mingguan hanya untuk Marketing Manager & CEO.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ---------------- Kawalan (tidak dicetak) ---------------- */}
      <div className="tiada-cetak space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white">Laporan Mingguan</h2>
          <p className="text-sm text-muted">
            Satu laporan lengkap semua bahagian — sedia untuk dihantar kepada
            CEO dalam bentuk PDF.
          </p>
        </div>

        <div className="card flex flex-wrap items-end gap-3">
          <button
            className="btn-secondary"
            onClick={() => setPeriod((p) => shiftWeek(p, -1))}
          >
            ‹ Minggu Sebelum
          </button>
          <button
            className="btn-secondary"
            onClick={() =>
              setPeriod({
                year: getCurrentYear(),
                month: getCurrentMonth(),
                week: getCurrentWeekOfMonth(),
              })
            }
          >
            Minggu Ini
          </button>
          <button
            className="btn-secondary"
            onClick={() => setPeriod((p) => shiftWeek(p, 1))}
          >
            Minggu Depan ›
          </button>

          <div>
            <label className="label">Bulan</label>
            <select
              className="input"
              value={period.month}
              onChange={(e) =>
                setPeriod({ ...period, month: Number(e.target.value) })
              }
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {monthName(m)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Minggu</label>
            <select
              className="input"
              value={period.week}
              onChange={(e) =>
                setPeriod({ ...period, week: Number(e.target.value) })
              }
            >
              {[1, 2, 3, 4].map((w) => (
                <option key={w} value={w}>
                  Minggu {w}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Tahun</label>
            <select
              className="input"
              value={period.year}
              onChange={(e) =>
                setPeriod({ ...period, year: Number(e.target.value) })
              }
            >
              {[getCurrentYear() - 1, getCurrentYear(), getCurrentYear() + 1].map(
                (y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                )
              )}
            </select>
          </div>

          <button className="btn-secondary" onClick={load} disabled={loading}>
            {loading ? "Memuatkan..." : "Muat Semula"}
          </button>
          <button
            className="btn-primary"
            onClick={() => window.print()}
            disabled={loading}
          >
            Simpan / Hantar PDF
          </button>
        </div>

        <div className="card text-xs text-slate-400">
          <p className="font-bold text-slate-200">Cara simpan sebagai PDF</p>
          <p className="mt-1">
            Tekan <strong>Simpan / Hantar PDF</strong> → pada tetingkap cetak,
            pilih <strong>Destination / Printer</strong> ={" "}
            <strong>Save as PDF</strong> → <strong>Save</strong>. Fail PDF itu
            terus boleh dihantar kepada CEO melalui WhatsApp atau emel.
          </p>
        </div>

        {warnings.length > 0 && (
          <div className="card border-masdora-alert/40">
            <p className="text-sm font-bold text-red-200">
              Sebahagian data tidak dapat dibaca — laporan masih dijana untuk
              bahagian lain:
            </p>
            <ul className="mt-2 list-disc pl-5 text-xs text-slate-300">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ================= LAPORAN (bahagian yang dicetak) ================= */}
      <div
        id="laporan-cetak"
        className="cetak-warna rounded-2xl bg-white p-8 text-[13px] leading-relaxed text-slate-800"
        style={{ colorScheme: "light" }}
      >
        {/* ---- Kepala ---- */}
        <div className="cetak-blok flex items-start justify-between border-b-2 border-[#F26122] pb-4">
          <div className="flex items-center gap-3">
            <MasdoraLogomark size={40} color="#F26122" />
            <div>
              <p className="text-lg font-black tracking-tight text-[#F26122]">
                MASDORA
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                Laporan Mingguan Pasukan
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-base font-black text-slate-900">
              Minggu {period.week} · {monthName(period.month)} {period.year}
            </p>
            <p className="text-xs text-slate-600">{range.label}</p>
            <p className="mt-1 text-[10px] text-slate-500">
              Disediakan oleh: {me?.full_name ?? "-"}
            </p>
            {generatedAt && (
              <p className="text-[10px] text-slate-500">
                Dijana: {generatedAt}
              </p>
            )}
          </div>
        </div>

        {(isFuture || isPartial) && (
          <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-900">
            {isFuture
              ? "Minggu ini BELUM bermula. Laporan menunjukkan rancangan yang sudah dimasukkan (to-do, deadline tugasan, pelancaran kempen) — bukan keputusan sebenar."
              : "Minggu ini MASIH BERJALAN. Angka di bawah adalah setakat hari ini dan masih boleh berubah sebelum Jumaat 5:00 petang."}
          </p>
        )}

        {loading ? (
          <p className="mt-6 text-sm text-slate-500">Mengumpul data...</p>
        ) : (
          <>
            {/* ---- 1. Ringkasan Eksekutif ---- */}
            <Seksyen no="1" tajuk="Ringkasan Eksekutif">
              <div className="grid grid-cols-3 gap-3">
                <Kotak
                  label="Jualan Minggu Ini"
                  nilai={rm(salesTotal)}
                  kecil={`${sales.length} rekod`}
                />
                <Kotak
                  label="Penghantaran To-Do"
                  nilai={`${submittedCount}/${todoRows.length}`}
                  kecil={`${onTimeCount} tepat masa`}
                />
                <Kotak
                  label="Purata Kerja Siap"
                  nilai={`${avgPct}%`}
                  kecil={`${todos.length} tugasan direkod`}
                />
                <Kotak
                  label="Konten Disiarkan"
                  nilai={num(contentTotals.bilangan)}
                  kecil={`${num(contentTotals.views)} tontonan`}
                />
                <Kotak
                  label="Tugasan Grafik"
                  nilai={`${taskCounts.selesai}/${tasksWeek.length}`}
                  kecil={
                    taskOverdue.length > 0
                      ? `${taskOverdue.length} lewat tarikh akhir`
                      : "tiada yang lewat"
                  }
                />
                <Kotak
                  label="Isu Pelanggan Baru"
                  nilai={num(issuesWeek.length)}
                  kecil={`Recovery: ${rm(recoveryTotal)}`}
                />
              </div>
            </Seksyen>

            {/* ---- 2. To-Do List Team ---- */}
            <Seksyen
              no="2"
              tajuk="Weekly To-Do List Team"
              nota="Tarikh akhir penghantaran: Jumaat sebelum 5:00 petang."
            >
              {todoRows.length === 0 ? (
                <Kosong>Tiada ahli team aktif direkod.</Kosong>
              ) : (
                <Jadual
                  kepala={[
                    "Nama",
                    "Jawatan",
                    "Tugasan",
                    "Siap",
                    "Tangguh",
                    "% Siap",
                    "Status Hantar",
                  ]}
                  baris={todoRows.map((r) => [
                    r.profile.full_name,
                    r.profile.position_code ?? "-",
                    num(r.total),
                    num(r.siap),
                    r.tangguh > 0 ? num(r.tangguh) : "-",
                    `${r.pct}%`,
                    r.sub?.submitted_at
                      ? r.sub.on_time
                        ? "Tepat masa"
                        : "Lewat"
                      : r.total > 0
                      ? "Lupa tekan hantar"
                      : "Tiada aktiviti",
                  ])}
                  tebalAkhir
                />
              )}
            </Seksyen>

            {/* ---- 3. Jualan ---- */}
            <Seksyen
              no="3"
              tajuk="Jualan"
              nota={`Jumlah keseluruhan minggu ini: ${rm(salesTotal)}`}
            >
              {sales.length === 0 ? (
                <Kosong>Tiada jualan direkod dalam tempoh ini.</Kosong>
              ) : (
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <SubTajuk>Mengikut Ahli</SubTajuk>
                    <Jadual
                      kepala={["Nama", "Jumlah"]}
                      baris={salesByPerson.map(([n, v]) => [n, rm(v)])}
                    />
                  </div>
                  <div>
                    <SubTajuk>Mengikut Platform</SubTajuk>
                    <Jadual
                      kepala={["Platform", "Jumlah"]}
                      baris={salesByPlatform.map(([n, v]) => [n, rm(v)])}
                    />
                  </div>
                </div>
              )}
            </Seksyen>

            {/* ---- 4. Prestasi Konten ---- */}
            <Seksyen
              no="4"
              tajuk="Prestasi Konten"
              nota={
                [
                  contentWeek.kosong > 0
                    ? `${contentWeek.kosong} baris sheet belum diisi tarikh`
                    : null,
                  contentWeek.rosak > 0
                    ? `${contentWeek.rosak} baris ada tarikh yang tersalah taip`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined
              }
            >
              {contentTotals.bilangan === 0 ? (
                <Kosong>
                  Tiada konten bertarikh dalam minggu ini.
                </Kosong>
              ) : (
                <>
                  <div className="mb-3 grid grid-cols-5 gap-3">
                    <Kotak label="Siaran" nilai={num(contentTotals.bilangan)} />
                    <Kotak label="Tontonan" nilai={num(contentTotals.views)} />
                    <Kotak label="Suka" nilai={num(contentTotals.likes)} />
                    <Kotak label="Komen" nilai={num(contentTotals.comments)} />
                    <Kotak label="Kongsi" nilai={num(contentTotals.shares)} />
                  </div>
                  <SubTajuk>Mengikut Ahli</SubTajuk>
                  <Jadual
                    kepala={["Nama", "Siaran", "Tontonan"]}
                    baris={contentByHandler.map(([n, v]) => [
                      n,
                      num(v.bilangan),
                      num(v.views),
                    ])}
                  />
                </>
              )}
            </Seksyen>

            {/* ---- 5. Tugasan Grafik ---- */}
            <Seksyen
              no="5"
              tajuk="Tugasan Grafik"
              nota="Termasuk tugasan yang diberi ATAU bertarikh akhir dalam minggu ini."
            >
              {tasksWeek.length === 0 ? (
                <Kosong>Tiada tugasan grafik dalam tempoh ini.</Kosong>
              ) : (
                <>
                  <div className="mb-3 grid grid-cols-4 gap-3">
                    <Kotak label="Selesai" nilai={num(taskCounts.selesai)} />
                    <Kotak label="Semakan" nilai={num(taskCounts.semakan)} />
                    <Kotak label="Dalam Proses" nilai={num(taskCounts.proses)} />
                    <Kotak label="Belum Mula" nilai={num(taskCounts.baru)} />
                  </div>

                  {tasksByDesigner.length > 0 && (
                    <>
                      <SubTajuk>Mengikut Designer</SubTajuk>
                      <Jadual
                        kepala={["Designer", "Selesai", "Belum Siap"]}
                        baris={tasksByDesigner.map(([n, v]) => [
                          n,
                          num(v.selesai),
                          num(v.belum),
                        ])}
                      />
                    </>
                  )}

                  {taskOverdue.length > 0 && (
                    <div className="mt-3">
                      <SubTajuk merah>
                        Lewat Tarikh Akhir ({taskOverdue.length})
                      </SubTajuk>
                      <Jadual
                        kepala={["ID", "Tugasan", "Designer", "Tarikh Akhir"]}
                        baris={taskOverdue.map((t) => [
                          t.taskId,
                          t.title,
                          t.doneBy || "-",
                          t.deadline || "-",
                        ])}
                      />
                    </div>
                  )}
                </>
              )}
            </Seksyen>

            {/* ---- 6. Isu Pelanggan ---- */}
            <Seksyen no="6" tajuk="Isu Pelanggan">
              {issuesWeek.length === 0 ? (
                <Kosong>Tiada isu pelanggan baru dilaporkan.</Kosong>
              ) : (
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <SubTajuk>Mengikut Status</SubTajuk>
                    <Jadual
                      kepala={["Status", "Bilangan"]}
                      baris={issuesByStatus.map(([n, v]) => [n, num(v)])}
                    />
                  </div>
                  <div>
                    <SubTajuk>Mengikut Handler</SubTajuk>
                    <Jadual
                      kepala={["Handler", "Bilangan"]}
                      baris={issuesByHandler.map(([n, v]) => [n, num(v)])}
                    />
                  </div>
                </div>
              )}
            </Seksyen>

            {/* ---- 7. Recovery CRM ---- */}
            <Seksyen
              no="7"
              tajuk="Recovery CRM"
              nota={`${recovery.length} rekod dihubungi · nilai ${rm(
                recoveryTotal
              )}`}
            >
              {recovery.length === 0 ? (
                <Kosong>Tiada rekod recovery dalam tempoh ini.</Kosong>
              ) : (
                <Jadual
                  kepala={["Status", "Bilangan"]}
                  baris={recoveryByStatus.map(([n, v]) => [n, num(v)])}
                />
              )}
            </Seksyen>

            {/* ---- 8. Kempen ---- */}
            <Seksyen no="8" tajuk="Kempen & Pelancaran">
              <SubTajuk>Dilancarkan Minggu Ini</SubTajuk>
              {campaignsWeek.length === 0 ? (
                <Kosong>Tiada pelancaran dalam minggu ini.</Kosong>
              ) : (
                <Jadual
                  kepala={["Produk", "Kategori", "Tarikh", "Status"]}
                  baris={campaignsWeek.map((c) => [
                    c.product,
                    c.category,
                    c.launchDate,
                    c.statusRaw || c.status,
                  ])}
                />
              )}

              {campaignsNext.length > 0 && (
                <div className="mt-3">
                  <SubTajuk>Akan Datang</SubTajuk>
                  <Jadual
                    kepala={["Produk", "Kategori", "Tarikh", "Status"]}
                    baris={campaignsNext.map((c) => [
                      c.product,
                      c.category,
                      c.launchDate,
                      c.statusRaw || c.status,
                    ])}
                  />
                </div>
              )}
            </Seksyen>

            {/* ---- Kaki ---- */}
            <div className="cetak-blok mt-6 border-t border-slate-300 pt-3 text-[10px] text-slate-500">
              <p>
                Masdora Team Dashboard · Laporan dijana secara automatik daripada
                data langsung (Supabase + Google Sheet pasukan).
              </p>
              {warnings.length > 0 && (
                <p className="mt-1 text-amber-700">
                  Nota: {warnings.length} sumber data tidak dapat dibaca semasa
                  laporan ini dijana.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- bahagian UI

function Seksyen({
  no,
  tajuk,
  nota,
  children,
}: {
  no: string;
  tajuk: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="cetak-blok mt-6">
      <div className="mb-2 flex items-baseline gap-2 border-b border-slate-200 pb-1">
        <span className="flex h-5 w-5 items-center justify-center rounded bg-[#F26122] text-[10px] font-black text-white">
          {no}
        </span>
        <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">
          {tajuk}
        </h3>
      </div>
      {nota && <p className="mb-2 text-[11px] italic text-slate-500">{nota}</p>}
      {children}
    </div>
  );
}

function SubTajuk({
  children,
  merah,
}: {
  children: React.ReactNode;
  merah?: boolean;
}) {
  return (
    <p
      className={`mb-1 text-[11px] font-bold uppercase tracking-wider ${
        merah ? "text-red-700" : "text-slate-600"
      }`}
    >
      {children}
    </p>
  );
}

function Kotak({
  label,
  nilai,
  kecil,
}: {
  label: string;
  nilai: string;
  kecil?: string;
}) {
  return (
    <div className="cetak-warna rounded-lg border border-slate-200 bg-slate-50 p-2.5">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-base font-black text-slate-900">{nilai}</p>
      {kecil && <p className="text-[9px] text-slate-500">{kecil}</p>}
    </div>
  );
}

function Kosong({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-300 p-3 text-center text-[11px] text-slate-500">
      {children}
    </p>
  );
}

function Jadual({
  kepala,
  baris,
  tebalAkhir,
}: {
  kepala: string[];
  baris: (string | number)[][];
  /** Tonjolkan lajur terakhir (contoh: status penghantaran). */
  tebalAkhir?: boolean;
}) {
  return (
    <table className="w-full border-collapse text-[11px]">
      <thead>
        <tr className="cetak-warna bg-slate-100">
          {kepala.map((h, i) => (
            <th
              key={i}
              className="border border-slate-300 px-2 py-1 text-left font-bold text-slate-700"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {baris.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td
                key={j}
                className={`border border-slate-200 px-2 py-1 text-slate-700 ${
                  tebalAkhir && j === r.length - 1 ? "font-bold" : ""
                }`}
              >
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
