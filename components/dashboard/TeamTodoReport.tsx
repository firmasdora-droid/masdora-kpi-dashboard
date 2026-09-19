"use client";

/**
 * Laporan To-Do harian pasukan — untuk Marketing Manager & CEO.
 *
 * Menunjukkan siapa sudah hantar laporan hari ini, dan pencapaian setiap
 * orang terhadap sasaran harian, mingguan dan bulanan mereka.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import {
  julatMinggu,
  julatBulan,
  lengkapkanSasaran,
  statusHantarHarian,
  hariCuti,
  type StatusHantar,
} from "@/lib/period";
import AvatarInitials from "@/components/AvatarInitials";
import type {
  DailySubmission,
  Department,
  Profile,
  TaskLog,
  TaskTemplate,
} from "@/types/database";

const cardMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const },
};

const MANAGEMENT_ROLES = ["manager", "ceo"];

/** Paparan status penghantaran harian. */
const LABEL_STATUS: Record<StatusHantar, string> = {
  cuti: "Cuti",
  tepat: "Tepat masa",
  lewat: "Lewat",
  belum: "Belum hantar",
  menunggu: "Menunggu",
};

const PILL_STATUS: Record<StatusHantar, string> = {
  cuti: "pill-kosong",
  tepat: "pill-hijau",
  lewat: "pill-oren",
  belum: "pill-merah",
  menunggu: "pill-kuning",
};
const HARI = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];

function hariIni(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function tarikhCantik(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return `${HARI[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function nf(n: number): string {
  return Number.isInteger(n)
    ? n.toLocaleString("ms-MY")
    : n.toLocaleString("ms-MY", { maximumFractionDigits: 2 });
}

function warnaPct(pct: number): string {
  if (pct >= 100) return "bg-masdora-olive";
  if (pct >= 70) return "bg-masdora-yellow";
  if (pct >= 40) return "bg-masdora-orange";
  return "bg-masdora-alert";
}

function teksPct(pct: number): string {
  if (pct >= 100) return "text-masdora-olive";
  if (pct >= 70) return "text-amber-200";
  if (pct >= 40) return "text-masdora-orange";
  return "text-red-300";
}

interface BarisAhli {
  profile: Profile;
  templates: TaskTemplate[];
  pctHari: number;
  pctMinggu: number;
  pctBulan: number;
  bilKerja: number;
  capaiHari: number;
  submission: DailySubmission | null;
  status: StatusHantar;
  /** Kerja yang jauh ketinggalan bulan ini — untuk disenaraikan kepada manager. */
  risiko: { title: string; capai: number; sasaran: number; unit: string }[];
}

export default function TeamTodoReport() {
  const supabase = createClient();

  const [tarikh, setTarikh] = useState(hariIni());
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [logsHari, setLogsHari] = useState<TaskLog[]>([]);
  const [logsMinggu, setLogsMinggu] = useState<TaskLog[]>([]);
  const [logsBulan, setLogsBulan] = useState<TaskLog[]>([]);
  const [subs, setSubs] = useState<DailySubmission[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deptFilter, setDeptFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const minggu = julatMinggu(tarikh);
    const bulan = julatBulan(tarikh);

    const [
      { data: profileRows },
      { data: tplRows, error: tplErr },
      { data: lh },
      { data: lm },
      { data: lb },
      { data: subRows },
      { data: deptRows },
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("active", true).order("full_name"),
      supabase.from("task_templates").select("*").eq("active", true).order("sort_order"),
      supabase.from("task_logs").select("*").eq("log_date", tarikh),
      supabase
        .from("task_logs")
        .select("*")
        .gte("log_date", minggu.mula)
        .lte("log_date", minggu.tamat),
      supabase
        .from("task_logs")
        .select("*")
        .gte("log_date", bulan.mula)
        .lte("log_date", bulan.tamat),
      supabase.from("daily_submissions").select("*").eq("log_date", tarikh),
      supabase.from("departments").select("*").order("sort_order"),
    ]);

    setError(
      tplErr
        ? /task_templates|does not exist/i.test(tplErr.message)
          ? "Jadual kerja belum disediakan. Sila run fail add-todo-targets.sql dalam Supabase SQL Editor."
          : "Gagal memuatkan: " + tplErr.message
        : null
    );

    setProfiles((profileRows as Profile[]) ?? []);
    setTemplates((tplRows as TaskTemplate[]) ?? []);
    setLogsHari((lh as TaskLog[]) ?? []);
    setLogsMinggu((lm as TaskLog[]) ?? []);
    setLogsBulan((lb as TaskLog[]) ?? []);
    setSubs((subRows as DailySubmission[]) ?? []);
    setDepartments((deptRows as Department[]) ?? []);
    setLoading(false);
  }, [supabase, tarikh]);

  useEffect(() => {
    load();
  }, [load]);

  const deptColor = useMemo(() => {
    const m = new Map<string, string>();
    departments.forEach((d) => m.set(d.code, d.color));
    return m;
  }, [departments]);

  const rows: BarisAhli[] = useMemo(() => {
    const jum = (logs: TaskLog[], uid: string, tid: number) =>
      logs
        .filter((l) => l.user_id === uid && l.template_id === tid)
        .reduce((s, l) => s + Number(l.qty ?? 0), 0);

    return profiles
      .filter((p) => !MANAGEMENT_ROLES.includes(p.role))
      .filter((p) => !deptFilter || p.dept_code === deptFilter)
      .map((p) => {
        const mine = templates.filter((t) => t.user_id === p.id);
        const sub = subs.find((x) => x.user_id === p.id) ?? null;

        let nHari = 0, sHari = 0;
        let nMinggu = 0, sMinggu = 0;
        let nBulan = 0, sBulan = 0;
        let capaiHari = 0;
        const risiko: BarisAhli["risiko"] = [];

        mine.forEach((t) => {
          const s = lengkapkanSasaran(t);
          const cH = jum(logsHari, p.id, t.id);
          const cM = jum(logsMinggu, p.id, t.id);
          const cB = jum(logsBulan, p.id, t.id);

          if (s.harian && s.harian > 0) {
            nHari++;
            sHari += Math.min(100, (cH / s.harian) * 100);
            if (cH >= s.harian) capaiHari++;
          }
          if (s.mingguan && s.mingguan > 0) {
            nMinggu++;
            sMinggu += Math.min(100, (cM / s.mingguan) * 100);
          }
          if (s.bulanan && s.bulanan > 0) {
            nBulan++;
            sBulan += Math.min(100, (cB / s.bulanan) * 100);
            // Di bawah 40% bulan ini — cukup jauh untuk perlu perhatian.
            if ((cB / s.bulanan) * 100 < 40) {
              risiko.push({
                title: t.title,
                capai: cB,
                sasaran: s.bulanan,
                unit: t.unit,
              });
            }
          }
        });

        return {
          profile: p,
          templates: mine,
          bilKerja: mine.length,
          capaiHari,
          pctHari: nHari ? Math.round(sHari / nHari) : 0,
          pctMinggu: nMinggu ? Math.round(sMinggu / nMinggu) : 0,
          pctBulan: nBulan ? Math.round(sBulan / nBulan) : 0,
          submission: sub,
          status: statusHantarHarian(tarikh, sub?.submitted_at),
          risiko,
        };
      })
      .sort((a, b) => {
        // Yang belum hantar naik atas supaya mudah dikejar.
        const berat: Record<StatusHantar, number> = {
          belum: 0, lewat: 1, menunggu: 2, tepat: 3, cuti: 4,
        };
        const aS = berat[a.status];
        const bS = berat[b.status];
        if (aS !== bS) return aS - bS;
        return a.pctHari - b.pctHari;
      });
  }, [profiles, templates, logsHari, logsMinggu, logsBulan, subs, deptFilter, tarikh]);

  // Ahad hari cuti — tiada laporan diperlukan, jadi ia tidak dikira
  // sebagai "belum hantar".
  const cuti = hariCuti(tarikh);
  const belumHantar = cuti
    ? 0
    : rows.filter((r) => r.status === "belum" || r.status === "lewat").length;
  const purataHari = rows.length
    ? Math.round(rows.reduce((s, r) => s + r.pctHari, 0) / rows.length)
    : 0;
  const purataBulan = rows.length
    ? Math.round(rows.reduce((s, r) => s + r.pctBulan, 0) / rows.length)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">To-Do List Pasukan</h2>
        <p className="text-sm text-muted">
          Laporan harian setiap ahli dan pencapaian mereka terhadap sasaran.
        </p>
      </div>

      {error && (
        <motion.div
          {...cardMotion}
          className="card border-masdora-alert/40 text-sm text-red-200"
        >
          {error}
        </motion.div>
      )}

      <motion.div {...cardMotion} className="card flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Tarikh</label>
          <input
            type="date"
            className="input"
            value={tarikh}
            max={hariIni()}
            onChange={(e) => setTarikh(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Jabatan</label>
          <select
            className="input"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="">Semua Jabatan</option>
            {departments.map((d) => (
              <option key={d.code} value={d.code}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <button onClick={load} className="btn-secondary" disabled={loading}>
          {loading ? "Memuatkan..." : "Muat Semula"}
        </button>
        <span className="ml-auto text-xs text-muted">
          {tarikhCantik(tarikh)}
        </span>
      </motion.div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          index={0}
          label="Belum Hantar"
          value={String(belumHantar)}
          caption={cuti ? "hari cuti — tiada laporan" : `daripada ${rows.length} ahli`}
          accent="from-masdora-alert/20 to-masdora-alert/5 border-masdora-alert/25"
        />
        <Stat
          index={1}
          label="Sudah Hantar"
          value={String(rows.filter((r) => r.submission).length)}
          caption="laporan hari ini"
          accent="from-masdora-olive/25 to-masdora-olive/5 border-masdora-olive/35"
        />
        <Stat
          index={2}
          label="Purata Hari Ini"
          value={`${purataHari}%`}
          caption="terhadap sasaran harian"
          accent="from-masdora-yellow/18 to-masdora-yellow/5 border-masdora-yellow/25"
        />
        <Stat
          index={3}
          label="Purata Bulan Ini"
          value={`${purataBulan}%`}
          caption="terhadap sasaran bulanan"
          accent="from-masdora-orange/20 to-masdora-orange/5 border-masdora-orange/25"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted">Memuatkan...</p>
      ) : rows.length === 0 ? (
        <motion.div {...cardMotion} className="card text-center text-sm text-muted">
          Tiada ahli untuk tapisan ini.
        </motion.div>
      ) : (
        <div className="space-y-3">
          {rows.map((r, i) => {
            const isOpen = expanded === r.profile.id;
            return (
              <motion.div
                key={r.profile.id}
                {...cardMotion}
                transition={{
                  ...cardMotion.transition,
                  delay: Math.min(i * 0.04, 0.35),
                }}
                className="card"
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : r.profile.id)}
                  className="flex w-full flex-wrap items-center gap-3 text-left"
                >
                  <AvatarInitials
                    name={r.profile.full_name}
                    deptColor={deptColor.get(r.profile.dept_code ?? "")}
                    size={38}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-slate-100">
                      {r.profile.full_name}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {r.profile.position_code ?? "-"} · {r.capaiHari}/
                      {r.bilKerja} kerja capai sasaran harian
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <MiniPct label="Hari" pct={r.pctHari} />
                    <MiniPct label="Minggu" pct={r.pctMinggu} />
                    <MiniPct label="Bulan" pct={r.pctBulan} />
                  </div>

                  <span className={`pill ${PILL_STATUS[r.status]}`}>
                    {LABEL_STATUS[r.status]}
                  </span>
                  <span className="text-slate-500">{isOpen ? "▲" : "▼"}</span>
                </button>

                {isOpen && (
                  <div className="mt-4 space-y-2 border-t border-white/5 pt-4">
                    {r.templates.length === 0 ? (
                      <p className="text-sm text-muted">
                        Belum ada kerja ditetapkan untuk ahli ini.
                      </p>
                    ) : (
                      r.templates.map((t) => {
                        const s = lengkapkanSasaran(t);
                        const cH = logsHari
                          .filter(
                            (l) =>
                              l.user_id === r.profile.id && l.template_id === t.id
                          )
                          .reduce((x, l) => x + Number(l.qty ?? 0), 0);
                        const cB = logsBulan
                          .filter(
                            (l) =>
                              l.user_id === r.profile.id && l.template_id === t.id
                          )
                          .reduce((x, l) => x + Number(l.qty ?? 0), 0);

                        return (
                          <div
                            key={t.id}
                            className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                          >
                            <span className="min-w-0 flex-1 truncate text-sm text-slate-200">
                              {t.title}
                              {!t.locked && (
                                <span className="ml-2 text-[10px] text-slate-500">
                                  (kerja sendiri)
                                </span>
                              )}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              Hari: <strong className="text-white">{nf(cH)}</strong>
                              {s.harian ? ` / ${nf(s.harian)}` : ""}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              Bulan:{" "}
                              <strong className="text-white">{nf(cB)}</strong>
                              {s.bulanan ? ` / ${nf(s.bulanan)}` : ""}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {t.unit}
                            </span>
                          </div>
                        );
                      })
                    )}

                    {r.risiko.length > 0 && (
                      <div className="rounded-lg border border-masdora-alert/30 bg-masdora-alert/10 p-3">
                        <p className="text-xs font-bold text-red-200">
                          Jauh ketinggalan bulan ini ({r.risiko.length})
                        </p>
                        <ul className="mt-1 space-y-0.5">
                          {r.risiko.map((x) => (
                            <li key={x.title} className="text-[11px] text-slate-300">
                              {x.title} — {nf(x.capai)} / {nf(x.sasaran)} {x.unit}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {r.submission && (
                      <p className="text-[11px] text-slate-500">
                        Dihantar pada{" "}
                        {new Date(r.submission.submitted_at).toLocaleString("ms-MY")}
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-muted">
        Laporan wajib dihantar sebelum 5:00 petang setiap hari kecuali Ahad.
        Sasaran ditetapkan oleh Marketing Manager dan tidak boleh diubah oleh
        ahli.
      </p>
    </div>
  );
}

function MiniPct({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="w-20">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">
          {label}
        </span>
        <span className={`text-[11px] font-black ${teksPct(pct)}`}>{pct}%</span>
      </div>
      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          className={`h-full rounded-full ${warnaPct(pct)}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, pct)}%` }}
          transition={{ duration: 0.6 }}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  caption,
  accent,
  index = 0,
}: {
  label: string;
  value: string;
  caption: string;
  accent: string;
  index?: number;
}) {
  return (
    <motion.div
      {...cardMotion}
      transition={{ ...cardMotion.transition, delay: index * 0.06 }}
      className={`rounded-2xl border bg-gradient-to-br p-4 ${accent}`}
    >
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-[11px] text-slate-400">{caption}</p>
    </motion.div>
  );
}
