"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import {
  getCurrentYear,
  getCurrentMonth,
  getCurrentWeekOfMonth,
  monthName,
} from "@/lib/period";
import WeekPicker, { WeekValue } from "@/components/WeekPicker";
import AvatarInitials from "@/components/AvatarInitials";
import type {
  Department,
  Profile,
  Todo,
  WeeklySubmission,
} from "@/types/database";

const cardMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const },
};

/** Jawatan pengurusan — mereka tidak perlu isi to-do sendiri. */
const MANAGEMENT_ROLES = ["manager", "ceo"];

interface MemberRow {
  profile: Profile;
  todos: Todo[];
  submission: WeeklySubmission | null;
  siap: number;
  total: number;
  pct: number;
}

export default function TeamTodoReport() {
  const supabase = createClient();

  const [week, setWeek] = useState<WeekValue>({
    year: getCurrentYear(),
    month: getCurrentMonth(),
    week: getCurrentWeekOfMonth(),
  });
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [subs, setSubs] = useState<WeeklySubmission[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deptFilter, setDeptFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [
      { data: profileRows },
      { data: todoRows },
      { data: subRows },
      { data: deptRows },
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("active", true).order("full_name"),
      supabase
        .from("todos")
        .select("*")
        .eq("year", week.year)
        .eq("month", week.month)
        .eq("week", week.week)
        .order("sort_order"),
      supabase
        .from("weekly_submissions")
        .select("*")
        .eq("year", week.year)
        .eq("month", week.month)
        .eq("week", week.week),
      supabase.from("departments").select("*").order("sort_order"),
    ]);

    setProfiles((profileRows as Profile[]) ?? []);
    setTodos((todoRows as Todo[]) ?? []);
    setSubs((subRows as WeeklySubmission[]) ?? []);
    setDepartments((deptRows as Department[]) ?? []);
    setLoading(false);
  }, [supabase, week]);

  useEffect(() => {
    load();
  }, [load]);

  const deptColor = useMemo(() => {
    const m = new Map<string, string>();
    departments.forEach((d) => m.set(d.code, d.color));
    return m;
  }, [departments]);

  /** Hanya ahli team yang wajib isi — pengurusan dikecualikan. */
  const rows: MemberRow[] = useMemo(() => {
    return profiles
      .filter((p) => !MANAGEMENT_ROLES.includes(p.role))
      .filter((p) => !deptFilter || p.dept_code === deptFilter)
      .map((p) => {
        const mine = todos.filter((t) => t.user_id === p.id);
        const siap = mine.filter((t) => t.status === "siap").length;
        const total = mine.length;
        const pct =
          total > 0
            ? Math.round(mine.reduce((s, t) => s + (t.pct ?? 0), 0) / total)
            : 0;
        return {
          profile: p,
          todos: mine,
          submission: subs.find((s) => s.user_id === p.id) ?? null,
          siap,
          total,
          pct,
        };
      })
      .sort((a, b) => {
        // Yang belum hantar naik atas supaya mudah dikejar
        const aSub = a.submission?.submitted_at ? 1 : 0;
        const bSub = b.submission?.submitted_at ? 1 : 0;
        if (aSub !== bSub) return aSub - bSub;
        return b.pct - a.pct;
      });
  }, [profiles, todos, subs, deptFilter]);

  const submitted = rows.filter((r) => r.submission?.submitted_at).length;
  const onTime = rows.filter((r) => r.submission?.on_time).length;
  const notSubmitted = rows.length - submitted;
  const avgPct =
    rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + r.pct, 0) / rows.length)
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Weekly To-Do List Team</h2>
        <p className="text-sm text-muted">
          Apa yang team kemas kini — dipapar terus, tanpa perlu tanya.
        </p>
      </div>

      <motion.div {...cardMotion} className="card flex flex-wrap items-end gap-4">
        <WeekPicker value={week} onChange={setWeek} />
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
      </motion.div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          index={0}
          label="Belum Hantar"
          value={String(notSubmitted)}
          caption="perlu dikejar"
          accent="from-masdora-alert/20 to-masdora-alert/5 border-masdora-alert/25"
        />
        <StatCard
          index={1}
          label="Hantar Tepat Masa"
          value={String(onTime)}
          caption="sebelum Jumaat 5 petang"
          accent="from-masdora-olive/25 to-masdora-olive/5 border-masdora-olive/35"
        />
        <StatCard
          index={2}
          label="Jumlah Hantar"
          value={`${submitted}/${rows.length}`}
          caption="ahli team"
          accent="from-masdora-yellow/18 to-masdora-yellow/5 border-masdora-yellow/25"
        />
        <StatCard
          index={3}
          label="Purata Siap"
          value={`${avgPct}%`}
          caption="penyiapan kerja"
          accent="from-masdora-orange/20 to-masdora-orange/5 border-masdora-orange/25"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted">Memuatkan...</p>
      ) : rows.length === 0 ? (
        <motion.div {...cardMotion} className="card text-center text-sm text-muted">
          Tiada ahli team untuk tapisan ini.
        </motion.div>
      ) : (
        <div className="space-y-3">
          {rows.map((r, i) => {
            const isOpen = expanded === r.profile.id;
            const sub = r.submission;
            const statusPill = !sub?.submitted_at
              ? { label: "Belum hantar", cls: "pill-merah" }
              : sub.on_time
              ? { label: "Tepat masa", cls: "pill-hijau" }
              : { label: "Lewat", cls: "pill-oren" };

            return (
              <motion.div
                key={r.profile.id}
                {...cardMotion}
                transition={{
                  ...cardMotion.transition,
                  delay: Math.min(i * 0.04, 0.4),
                }}
                className="card"
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : r.profile.id)}
                  className="flex w-full items-center gap-3 text-left"
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
                      {r.profile.position_code ?? "-"} · {r.siap}/{r.total} kerja
                      siap
                    </p>
                    <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        className="h-full rounded-full bg-masdora-olive"
                        initial={{ width: 0 }}
                        animate={{ width: `${r.pct}%` }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1">
                    <span className={`pill ${statusPill.cls}`}>
                      {statusPill.label}
                    </span>
                    <span className="text-lg font-black text-white">
                      {r.pct}%
                    </span>
                  </div>
                  <span className="ml-1 flex-shrink-0 text-slate-500">
                    {isOpen ? "▲" : "▼"}
                  </span>
                </button>

                {isOpen && (
                  <div className="mt-4 space-y-2 border-t border-white/5 pt-4">
                    {r.todos.length === 0 ? (
                      <p className="text-sm text-muted">
                        Belum ada tugasan dimasukkan untuk minggu ini.
                      </p>
                    ) : (
                      r.todos.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                        >
                          <span
                            className={`h-2 w-2 flex-shrink-0 rounded-full ${
                              t.status === "siap"
                                ? "bg-masdora-olive"
                                : t.status === "tangguh"
                                ? "bg-red-400"
                                : t.status === "proses"
                                ? "bg-amber-400"
                                : "bg-slate-500"
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-slate-200">
                              {t.title}
                            </p>
                            {t.note && (
                              <p className="truncate text-[11px] text-slate-500">
                                {t.note}
                              </p>
                            )}
                          </div>
                          <span className="flex-shrink-0 text-[11px] text-slate-500">
                            {t.day || "-"}
                          </span>
                          <span className="flex-shrink-0 text-xs font-bold text-slate-300">
                            {t.pct}%
                          </span>
                        </div>
                      ))
                    )}

                    {sub?.notes && (
                      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Catatan minggu ini
                        </p>
                        <p className="text-sm text-slate-300">{sub.notes}</p>
                      </div>
                    )}

                    {sub?.submitted_at && (
                      <p className="text-[11px] text-slate-500">
                        Dihantar pada{" "}
                        {new Date(sub.submitted_at).toLocaleString("ms-MY")}
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
        Tarikh akhir penghantaran: <strong>setiap Jumaat sebelum 5:00 petang</strong>
        {" · "}
        {monthName(week.month)} {week.year}, Minggu {week.week}
      </p>
    </div>
  );
}

function StatCard({
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
