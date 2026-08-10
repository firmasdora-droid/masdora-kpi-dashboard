"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import AvatarInitials from "@/components/AvatarInitials";
import type { Profile } from "@/types/database";

type TaskStatus = "selesai" | "semakan" | "proses" | "baru";

interface GraphicTask {
  rowIndex: number;
  taskId: string;
  title: string;
  quantity: string;
  category: string;
  requestFrom: string;
  doneBy: string;
  assignDate: string;
  deadline: string;
  deadlineIso: string | null;
  status: TaskStatus;
  statusRaw: string;
  notes: string;
  overdue: boolean;
  daysLeft: number | null;
}

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1Uw09DxFrFDpdTQR8hf3lF3KHEcixJMoy-9OsYHb8UhU/edit";

const cardMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const },
};

const STATUSES: {
  key: TaskStatus;
  label: string;
  pill: string;
  icon: string;
  accent: string;
}[] = [
  {
    key: "baru",
    label: "Belum Mula",
    pill: "pill-kosong",
    icon: "🆕",
    accent: "from-masdora-gray/15 to-masdora-gray/5 border-masdora-gray/25",
  },
  {
    key: "proses",
    label: "Sedang Buat",
    pill: "pill-kuning",
    icon: "⏳",
    accent: "from-masdora-yellow/18 to-masdora-yellow/5 border-masdora-yellow/25",
  },
  {
    key: "semakan",
    label: "Menunggu Semakan",
    pill: "pill-oren",
    icon: "👀",
    accent: "from-masdora-orange/20 to-masdora-orange/5 border-masdora-orange/25",
  },
  {
    key: "selesai",
    label: "Selesai",
    pill: "pill-hijau",
    icon: "✅",
    accent: "from-masdora-olive/25 to-masdora-olive/5 border-masdora-olive/35",
  },
];

const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.key, s]));

function deadlineLabel(t: GraphicTask): string | null {
  if (t.status === "selesai" || t.daysLeft === null) return null;
  if (t.daysLeft < 0) return `Lewat ${Math.abs(t.daysLeft)} hari`;
  if (t.daysLeft === 0) return "Hari ini!";
  if (t.daysLeft === 1) return "Esok";
  if (t.daysLeft <= 7) return `${t.daysLeft} hari lagi`;
  return null;
}

export default function TugasanGrafikPage() {
  const supabase = createClient();

  const [tasks, setTasks] = useState<GraphicTask[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<TaskStatus | "">("");
  const [byFilter, setByFilter] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [search, setSearch] = useState("");
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  const load = useCallback(
    async (fresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const [json, { data: auth }] = await Promise.all([
          fetch(`/api/graphic-tasks${fresh ? "?fresh=1" : ""}`, {
            cache: "no-store",
          }).then((r) => r.json()),
          supabase.auth.getUser(),
        ]);

        if (auth.user) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", auth.user.id)
            .maybeSingle<Profile>();
          setProfile(prof ?? null);
        }

        if (!json.ok) {
          setError(json.error ?? "Gagal memuatkan data.");
          setTasks([]);
        } else {
          setTasks(json.tasks as GraphicTask[]);
          setRefreshedAt(
            new Date().toLocaleTimeString("ms-MY", {
              hour: "2-digit",
              minute: "2-digit",
            })
          );
        }
      } catch {
        setError("Gagal menghubungi Google Sheet.");
      }
      setLoading(false);
    },
    [supabase]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Designer lihat tugasan sendiri secara lalai; manager/CEO lihat semua.
  useEffect(() => {
    if (byFilter || !profile || tasks.length === 0) return;
    if (profile.role === "manager" || profile.role === "ceo") return;
    const first = profile.full_name.split(/\s+/)[0].toLowerCase();
    const mine = tasks.find((t) => t.doneBy.toLowerCase().includes(first));
    if (mine) setByFilter(mine.doneBy);
  }, [profile, tasks, byFilter]);

  const designers = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.doneBy).filter(Boolean))).sort(),
    [tasks]
  );
  const categories = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.category).filter(Boolean))).sort(),
    [tasks]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (byFilter && t.doneBy !== byFilter) return false;
      if (catFilter && t.category !== catFilter) return false;
      if (onlyOverdue && !t.overdue) return false;
      if (q) {
        const hay = `${t.taskId} ${t.title} ${t.category} ${t.requestFrom} ${t.notes}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tasks, statusFilter, byFilter, catFilter, onlyOverdue, search]);

  const counts = useMemo(() => {
    const c: Record<TaskStatus, number> = {
      selesai: 0,
      semakan: 0,
      proses: 0,
      baru: 0,
    };
    tasks
      .filter((t) => !byFilter || t.doneBy === byFilter)
      .forEach((t) => c[t.status]++);
    return c;
  }, [tasks, byFilter]);

  const overdueCount = tasks.filter(
    (t) => t.overdue && (!byFilter || t.doneBy === byFilter)
  ).length;

  /** Beban kerja setiap designer (tugasan belum selesai). */
  const workload = useMemo(() => {
    const map = new Map<string, { open: number; done: number }>();
    tasks.forEach((t) => {
      if (!t.doneBy) return;
      const cur = map.get(t.doneBy) ?? { open: 0, done: 0 };
      if (t.status === "selesai") cur.done += 1;
      else cur.open += 1;
      map.set(t.doneBy, cur);
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.open - a.open);
  }, [tasks]);
  const maxOpen = Math.max(1, ...workload.map((w) => w.open));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Tugasan Grafik</h2>
          <p className="text-sm text-muted">
            Terus dari Google Sheet Task List — kemas kini di sheet, dashboard
            ikut sendiri.
            {refreshedAt && (
              <span className="ml-1 text-slate-500">
                (dikemas kini {refreshedAt})
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => load(true)}
            className="btn-secondary"
            disabled={loading}
          >
            {loading ? "Memuatkan..." : "Muat Semula"}
          </button>
          <a
            href={SHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            Buka Sheet
          </a>
        </div>
      </div>

      {error && (
        <motion.div
          {...cardMotion}
          className="card border-red-500/30 text-sm text-red-300"
        >
          {error}
        </motion.div>
      )}

      {/* Amaran tugasan lewat */}
      {overdueCount > 0 && (
        <motion.button
          {...cardMotion}
          onClick={() => setOnlyOverdue((v) => !v)}
          className={`w-full rounded-2xl border border-masdora-alert/40 bg-gradient-to-br from-masdora-alert/25 to-masdora-alert/5 p-4 text-left transition hover:brightness-125 ${
            onlyOverdue ? "ring-2 ring-white/40" : ""
          }`}
        >
          <p className="text-sm font-bold text-red-200">
            ⚠️ {overdueCount} tugasan sudah lewat tarikh akhir
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {onlyOverdue ? "Klik untuk tunjuk semua" : "Klik untuk tunjuk yang lewat sahaja"}
          </p>
        </motion.button>
      )}

      {/* Kad status — klik untuk tapis */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATUSES.map((s, i) => {
          const active = statusFilter === s.key;
          return (
            <motion.button
              key={s.key}
              {...cardMotion}
              transition={{ ...cardMotion.transition, delay: i * 0.06 }}
              onClick={() => setStatusFilter(active ? "" : s.key)}
              className={`rounded-2xl border bg-gradient-to-br p-4 text-left transition ${
                s.accent
              } ${active ? "ring-2 ring-white/40" : "hover:brightness-125"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  {s.label}
                </span>
                <span className="text-lg" aria-hidden>
                  {s.icon}
                </span>
              </div>
              <p className="mt-2 text-2xl font-black text-white">
                {counts[s.key]}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {active ? "klik untuk buang tapisan" : "klik untuk tapis"}
              </p>
            </motion.button>
          );
        })}
      </div>

      {/* Beban kerja — hanya berguna bila lihat semua designer */}
      {!byFilter && workload.length > 1 && (
        <motion.div {...cardMotion} className="card">
          <h3 className="mb-4 font-semibold text-white">Beban Kerja Designer</h3>
          <div className="space-y-3">
            {workload.map((w, i) => (
              <div key={w.name} className="flex items-center gap-3">
                <AvatarInitials name={w.name} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-slate-100">
                      {w.name}
                    </span>
                    <span className="text-xs text-slate-400">
                      <span className="font-black text-white">{w.open}</span> belum
                      siap · {w.done} selesai
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-masdora-orange to-masdora-orange/60"
                      initial={{ width: 0 }}
                      animate={{ width: `${(w.open / maxOpen) * 100}%` }}
                      transition={{ duration: 0.7, delay: i * 0.08 }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div {...cardMotion} className="card flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Designer</label>
          <select
            className="input"
            value={byFilter}
            onChange={(e) => setByFilter(e.target.value)}
          >
            <option value="">Semua Designer</option>
            {designers.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Kategori</label>
          <select
            className="input"
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
          >
            <option value="">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[200px] flex-1">
          <label className="label">Cari</label>
          <input
            className="input"
            placeholder="Task ID, nama tugasan, catatan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </motion.div>

      {loading ? (
        <p className="text-sm text-muted">Memuatkan data...</p>
      ) : filtered.length === 0 ? (
        <motion.div {...cardMotion} className="card text-center text-sm text-muted">
          {tasks.length === 0
            ? "Belum ada tugasan direkod dalam sheet."
            : "Tiada tugasan untuk tapisan ini."}
        </motion.div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t, i) => {
            const meta = STATUS_MAP[t.status];
            const dl = deadlineLabel(t);
            return (
              <motion.div
                key={`${t.rowIndex}-${t.taskId}`}
                {...cardMotion}
                transition={{
                  ...cardMotion.transition,
                  delay: Math.min(i * 0.03, 0.35),
                }}
                className={`card ${t.overdue ? "border-masdora-alert/40" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {t.taskId && (
                        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                          {t.taskId}
                        </span>
                      )}
                      {t.category && (
                        <span className="pill pill-kosong">{t.category}</span>
                      )}
                      {t.quantity && (
                        <span className="text-[11px] text-slate-500">
                          × {t.quantity}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 font-bold text-slate-100">{t.title}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {[
                        t.doneBy && `Oleh: ${t.doneBy}`,
                        t.requestFrom && `Diminta: ${t.requestFrom}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1">
                    <span className={`pill ${meta.pill}`}>
                      {meta.icon} {t.statusRaw || meta.label}
                    </span>
                    {t.deadline && (
                      <span className="text-[11px] text-slate-500">
                        📅 {t.deadline}
                      </span>
                    )}
                    {dl && (
                      <span
                        className={`text-[11px] font-bold ${
                          t.overdue ? "text-red-400" : "text-masdora-orange"
                        }`}
                      >
                        {dl}
                      </span>
                    )}
                  </div>
                </div>

                {t.notes && (
                  <p className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-2 text-xs text-slate-300">
                    {t.notes}
                  </p>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
