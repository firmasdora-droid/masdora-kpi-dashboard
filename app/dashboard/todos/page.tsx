"use client";

/**
 * To-Do List harian.
 *
 * Manager menetapkan kerja tetap dan sasarannya; ahli hanya memasukkan
 * KUANTITI kerja yang disiapkan setiap hari. Dashboard mengira sendiri
 * pencapaian harian, mingguan dan bulanan — jadi tiada siapa perlu
 * mengira peratus secara manual, dan tiada siapa boleh mengubah sasaran.
 *
 * Ahli tetap boleh menambah kerja mereka sendiri; kerja itu tidak dikunci.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import {
  julatMinggu,
  julatBulan,
  lengkapkanSasaran,
  statusHantarHarian,
  bakiMasaHantar,
  HARI_KERJA_SEMINGGU,
  HARI_KERJA_SEBULAN,
} from "@/lib/period";
import TeamTodoReport from "@/components/dashboard/TeamTodoReport";
import type {
  DailySubmission,
  Profile,
  TaskLog,
  TaskTemplate,
} from "@/types/database";

const cardMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const },
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

/** Warna kemajuan: hijau bila capai, kuning bila hampir, merah bila jauh. */
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

/** Satu bar kemajuan dengan label "x / y" dan baki. */
function Kemajuan({
  label,
  capai,
  sasaran,
  unit,
  dikira,
}: {
  label: string;
  capai: number;
  sasaran: number | null;
  unit: string;
  dikira?: boolean;
}) {
  if (sasaran === null || sasaran <= 0) {
    return (
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <p className="text-sm text-slate-500">Tiada sasaran</p>
      </div>
    );
  }

  const pct = Math.round((capai / sasaran) * 100);
  const baki = Math.max(0, sasaran - capai);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {label}
          {dikira && (
            <span
              className="ml-1 text-slate-600"
              title="Dikira daripada sasaran harian"
            >
              (dikira)
            </span>
          )}
        </p>
        <p className={`text-xs font-black ${teksPct(pct)}`}>{pct}%</p>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          className={`h-full rounded-full ${warnaPct(pct)}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, pct)}%` }}
          transition={{ duration: 0.6 }}
        />
      </div>
      <p className="mt-1 text-[11px] text-slate-400">
        {nf(capai)} / {nf(sasaran)} {unit}
        {baki > 0 ? (
          <span className="text-slate-500"> · {nf(baki)} lagi</span>
        ) : (
          <span className="text-masdora-olive"> · tercapai</span>
        )}
      </p>
    </div>
  );
}

export default function TodoListPage() {
  const supabase = createClient();

  const [role, setRole] = useState<string | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [tarikh, setTarikh] = useState(hariIni());
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [logsHari, setLogsHari] = useState<TaskLog[]>([]);
  const [logsMinggu, setLogsMinggu] = useState<TaskLog[]>([]);
  const [logsBulan, setLogsBulan] = useState<TaskLog[]>([]);
  const [submission, setSubmission] = useState<DailySubmission | null>(null);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [kerjaBaru, setKerjaBaru] = useState("");

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      if (user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle<Pick<Profile, "role">>();
        setRole(prof?.role ?? null);
      }
      setRoleLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const minggu = julatMinggu(tarikh);
    const bulan = julatBulan(tarikh);

    const [
      { data: tpl, error: tplErr },
      { data: lh },
      { data: lm },
      { data: lb },
      { data: sub },
    ] = await Promise.all([
      supabase
        .from("task_templates")
        .select("*")
        .eq("user_id", userId)
        .eq("active", true)
        .order("sort_order"),
      supabase
        .from("task_logs")
        .select("*")
        .eq("user_id", userId)
        .eq("log_date", tarikh),
      supabase
        .from("task_logs")
        .select("*")
        .eq("user_id", userId)
        .gte("log_date", minggu.mula)
        .lte("log_date", minggu.tamat),
      supabase
        .from("task_logs")
        .select("*")
        .eq("user_id", userId)
        .gte("log_date", bulan.mula)
        .lte("log_date", bulan.tamat),
      supabase
        .from("daily_submissions")
        .select("*")
        .eq("user_id", userId)
        .eq("log_date", tarikh)
        .maybeSingle<DailySubmission>(),
    ]);

    if (tplErr) {
      setMessage(
        /task_templates|does not exist/i.test(tplErr.message)
          ? "Jadual kerja belum disediakan dalam database. Sila run fail add-todo-targets.sql dalam Supabase SQL Editor."
          : "Gagal memuatkan: " + tplErr.message
      );
    } else {
      setMessage(null);
    }

    setTemplates((tpl as TaskTemplate[]) ?? []);
    setLogsHari((lh as TaskLog[]) ?? []);
    setLogsMinggu((lm as TaskLog[]) ?? []);
    setLogsBulan((lb as TaskLog[]) ?? []);
    setSubmission(sub ?? null);
    setLoading(false);
  }, [supabase, userId, tarikh]);

  useEffect(() => {
    load();
  }, [load]);

  /** Jumlah kuantiti bagi satu kerja dalam satu set log. */
  const jumlah = useCallback(
    (logs: TaskLog[], templateId: number) =>
      logs
        .filter((l) => l.template_id === templateId)
        .reduce((s, l) => s + Number(l.qty ?? 0), 0),
    []
  );

  /** Ringkasan keseluruhan: berapa kerja sudah capai sasaran harian. */
  const ringkasan = useMemo(() => {
    let adaSasaran = 0;
    let tercapai = 0;
    let jumPct = 0;

    templates.forEach((t) => {
      const s = lengkapkanSasaran(t);
      if (!s.harian || s.harian <= 0) return;
      adaSasaran++;
      const capai = jumlah(logsHari, t.id);
      const pct = Math.min(100, (capai / s.harian) * 100);
      jumPct += pct;
      if (capai >= s.harian) tercapai++;
    });

    return {
      adaSasaran,
      tercapai,
      purataPct: adaSasaran > 0 ? Math.round(jumPct / adaSasaran) : 0,
    };
  }, [templates, logsHari, jumlah]);

  async function simpanQty(t: TaskTemplate, nilai: string) {
    if (!userId) return;
    const qty = Number(nilai);
    if (!Number.isFinite(qty) || qty < 0) return;

    const { error } = await supabase.from("task_logs").upsert(
      {
        user_id: userId,
        template_id: t.id,
        log_date: tarikh,
        qty,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,template_id,log_date" }
    );

    if (error) {
      setMessage("Gagal menyimpan: " + error.message);
      return;
    }
    setMessage(null);
    load();
  }

  async function hantarLaporan() {
    if (!userId) return;
    const { error } = await supabase.from("daily_submissions").upsert(
      { user_id: userId, log_date: tarikh, submitted_at: new Date().toISOString() },
      { onConflict: "user_id,log_date" }
    );
    if (error) {
      setMessage("Gagal menghantar: " + error.message);
      return;
    }
    setMessage("Laporan hari ini berjaya dihantar.");
    load();
  }

  async function tambahKerja() {
    if (!userId || !kerjaBaru.trim()) return;
    const { error } = await supabase.from("task_templates").insert({
      user_id: userId,
      title: kerjaBaru.trim(),
      unit: "unit",
      // Kerja yang ahli tambah sendiri TIDAK dikunci, jadi mereka boleh
      // mengubah atau membuangnya — tidak seperti kerja tetap dari manager.
      locked: false,
      active: true,
      sort_order: 900,
    });
    if (error) {
      setMessage("Gagal menambah kerja: " + error.message);
      return;
    }
    setKerjaBaru("");
    load();
  }

  async function buangKerja(t: TaskTemplate) {
    const { error } = await supabase
      .from("task_templates")
      .delete()
      .eq("id", t.id);
    if (error) {
      setMessage("Gagal membuang: " + error.message);
      return;
    }
    load();
  }

  if (!roleLoaded) {
    return <p className="text-sm text-muted">Memuatkan...</p>;
  }

  // Manager & CEO tidak mengisi to-do sendiri — mereka melihat laporan pasukan.
  if (role === "manager" || role === "ceo") {
    return <TeamTodoReport />;
  }

  const minggu = julatMinggu(tarikh);
  const bulan = julatBulan(tarikh);
  const statusHantar = statusHantarHarian(tarikh, submission?.submitted_at);
  const baki = bakiMasaHantar(tarikh);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">To-Do List</h2>
          <p className="text-sm text-muted">
            Masukkan kuantiti kerja anda setiap hari. Dashboard mengira
            sendiri pencapaian harian, mingguan dan bulanan.
          </p>
        </div>
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
      </div>

      {message && (
        <motion.div
          {...cardMotion}
          className="card border-masdora-orange/40 text-sm text-amber-100"
        >
          {message}
        </motion.div>
      )}

      {/* ---------- Banner penghantaran harian ---------- */}
      <motion.div
        {...cardMotion}
        className={`rounded-2xl border p-5 ${
          statusHantar === "cuti"
            ? "border-white/10 bg-white/[0.04]"
            : statusHantar === "tepat"
            ? "border-masdora-olive/40 bg-gradient-to-br from-masdora-olive/20 to-masdora-olive/5"
            : statusHantar === "lewat"
            ? "border-masdora-yellow/45 bg-gradient-to-br from-masdora-yellow/20 to-masdora-yellow/5"
            : "border-masdora-alert/45 bg-gradient-to-br from-masdora-alert/20 to-masdora-alert/5"
        }`}
      >
        {statusHantar === "cuti" ? (
          <div>
            <p className="font-bold text-slate-200">
              🌴 {tarikhCantik(tarikh)} — hari cuti
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              Tiada laporan diperlukan pada hari Ahad. Kalau anda tetap bekerja
              hari ini, anda masih boleh isi kuantiti dan menghantarnya.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p
                className={`font-bold ${
                  statusHantar === "tepat"
                    ? "text-emerald-200"
                    : statusHantar === "lewat"
                    ? "text-amber-200"
                    : "text-red-200"
                }`}
              >
                {statusHantar === "tepat" &&
                  `✅ Laporan ${tarikhCantik(tarikh)} dihantar tepat masa`}
                {statusHantar === "lewat" &&
                  (submission
                    ? `⚠️ Laporan ${tarikhCantik(tarikh)} dihantar LEWAT`
                    : `⚠️ Laporan ${tarikhCantik(tarikh)} TIDAK dihantar — tarikh akhir sudah lepas`)}
                {statusHantar === "menunggu" &&
                  `⏳ Laporan ${tarikhCantik(tarikh)} belum dihantar`}
                {statusHantar === "belum" &&
                  `⚠️ Laporan hari ini BELUM dihantar — sudah lepas 5 petang`}
              </p>
              <p className="mt-0.5 text-xs text-slate-300">
                {submission?.submitted_at ? (
                  new Date(submission.submitted_at).toLocaleString("ms-MY")
                ) : (
                  <>
                    Tarikh akhir: <strong>sebelum 5:00 petang</strong> setiap
                    hari kecuali Ahad.
                    {baki && (
                      <span className="ml-1 font-bold text-amber-300">
                        Baki masa: {baki}
                      </span>
                    )}
                  </>
                )}
              </p>
            </div>
            <motion.button
              className="btn-primary px-6 py-3"
              onClick={hantarLaporan}
              animate={
                submission
                  ? {}
                  : {
                      boxShadow: [
                        "0 0 0px rgba(242,97,34,0)",
                        "0 0 20px rgba(242,97,34,0.6)",
                        "0 0 0px rgba(242,97,34,0)",
                      ],
                    }
              }
              transition={{ duration: 2, repeat: Infinity }}
            >
              {submission ? "Hantar Semula" : "Hantar Laporan"}
            </motion.button>
          </div>
        )}
      </motion.div>

      {/* ---------- Ringkasan hari ini ---------- */}
      {ringkasan.adaSasaran > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <motion.div
            {...cardMotion}
            className="rounded-2xl border border-masdora-orange/25 bg-gradient-to-br from-masdora-orange/20 to-masdora-orange/5 p-4"
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Sasaran harian tercapai
            </p>
            <p className="mt-1 text-2xl font-black text-white">
              {ringkasan.tercapai}/{ringkasan.adaSasaran}
            </p>
          </motion.div>
          <motion.div
            {...cardMotion}
            transition={{ ...cardMotion.transition, delay: 0.06 }}
            className="rounded-2xl border border-masdora-olive/35 bg-gradient-to-br from-masdora-olive/25 to-masdora-olive/5 p-4"
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Purata pencapaian hari ini
            </p>
            <p className="mt-1 text-2xl font-black text-white">
              {ringkasan.purataPct}%
            </p>
          </motion.div>
          <motion.div
            {...cardMotion}
            transition={{ ...cardMotion.transition, delay: 0.12 }}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Tempoh dikira
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Minggu: {minggu.mula.slice(8)}–{minggu.tamat.slice(8)}{" "}
              {minggu.tamat.slice(5, 7)}
            </p>
            <p className="text-[11px] text-slate-400">
              Bulan: {bulan.mula.slice(0, 7)}
            </p>
          </motion.div>
        </div>
      )}

      {/* ---------- Senarai kerja ---------- */}
      {loading ? (
        <p className="text-sm text-muted">Memuatkan...</p>
      ) : templates.length === 0 ? (
        <motion.div {...cardMotion} className="card text-center text-sm text-muted">
          Belum ada kerja ditetapkan untuk anda. Beritahu Marketing Manager.
        </motion.div>
      ) : (
        <div className="space-y-3">
          {templates.map((t, i) => {
            const s = lengkapkanSasaran(t);
            const capaiHari = jumlah(logsHari, t.id);
            const capaiMinggu = jumlah(logsMinggu, t.id);
            const capaiBulan = jumlah(logsBulan, t.id);
            const logHari = logsHari.find((l) => l.template_id === t.id);

            return (
              <motion.div
                key={t.id}
                {...cardMotion}
                transition={{
                  ...cardMotion.transition,
                  delay: Math.min(i * 0.04, 0.3),
                }}
                className="card"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-100">
                      {t.title}
                      {!t.locked && (
                        <span className="ml-2 pill pill-kosong">kerja saya</span>
                      )}
                    </p>
                    {t.note && (
                      <p className="mt-0.5 text-[11px] text-slate-500">{t.note}</p>
                    )}
                  </div>

                  <div className="flex items-end gap-2">
                    <div>
                      <label className="label">Kuantiti hari ini</label>
                      <KuantitiInput
                        nilaiAwal={logHari?.qty ?? 0}
                        unit={t.unit}
                        onSimpan={(v) => simpanQty(t, v)}
                      />
                    </div>
                    {!t.locked && (
                      <button
                        onClick={() => buangKerja(t)}
                        className="mb-1 rounded-lg border border-masdora-alert/40 px-2 py-1 text-[11px] font-bold text-red-300 hover:bg-masdora-alert/15"
                      >
                        Buang
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 border-t border-white/5 pt-4 sm:grid-cols-3">
                  <Kemajuan
                    label="Hari ini"
                    capai={capaiHari}
                    sasaran={s.harian}
                    unit={t.unit}
                  />
                  <Kemajuan
                    label="Minggu ini"
                    capai={capaiMinggu}
                    sasaran={s.mingguan}
                    unit={t.unit}
                    dikira={s.dikira.mingguan}
                  />
                  <Kemajuan
                    label="Bulan ini"
                    capai={capaiBulan}
                    sasaran={s.bulanan}
                    unit={t.unit}
                    dikira={s.dikira.bulanan}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ---------- Tambah kerja sendiri ---------- */}
      <motion.div {...cardMotion} className="card">
        <h3 className="mb-1 font-semibold text-white">Tambah Kerja Saya</h3>
        <p className="mb-3 text-xs text-muted">
          Untuk kerja tambahan yang tiada dalam senarai tetap. Kerja yang anda
          tambah boleh dibuang semula oleh anda sendiri.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            className="input min-w-[240px] flex-1"
            placeholder="Contoh: Bantu susun stok gudang"
            value={kerjaBaru}
            onChange={(e) => setKerjaBaru(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") tambahKerja();
            }}
          />
          <button
            className="btn-primary"
            onClick={tambahKerja}
            disabled={!kerjaBaru.trim()}
          >
            Tambah
          </button>
        </div>
      </motion.div>

      <p className="text-center text-[11px] text-muted">
        Laporan wajib dihantar sebelum 5:00 petang setiap hari kecuali Ahad.
        Sasaran ditetapkan oleh Marketing Manager dan tidak boleh diubah di
        sini. Sasaran mingguan &amp; bulanan yang bertanda &ldquo;dikira&rdquo;
        dianggarkan daripada sasaran harian ({HARI_KERJA_SEMINGGU} hari
        seminggu, {HARI_KERJA_SEBULAN} hari sebulan).
      </p>
    </div>
  );
}

/**
 * Kotak kuantiti dengan simpanan pada blur.
 *
 * Menyimpan pada setiap ketukan kekunci menyebabkan medan berkelip dan
 * menulis ke database berpuluh kali — masalah yang sama pernah berlaku
 * pada medan peratus dahulu.
 */
function KuantitiInput({
  nilaiAwal,
  unit,
  onSimpan,
}: {
  nilaiAwal: number;
  unit: string;
  onSimpan: (nilai: string) => void;
}) {
  const [nilai, setNilai] = useState(String(nilaiAwal));

  useEffect(() => {
    setNilai(String(nilaiAwal));
  }, [nilaiAwal]);

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={0}
        step="any"
        className="input w-28 text-right"
        value={nilai}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setNilai(e.target.value)}
        onBlur={() => {
          if (nilai !== String(nilaiAwal)) onSimpan(nilai || "0");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      <span className="text-xs text-slate-500">{unit}</span>
    </div>
  );
}
