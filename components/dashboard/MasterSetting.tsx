"use client";

/**
 * MASTER SETTING — papan kawalan Marketing Manager.
 *
 * Semua nombor yang memandu dashboard ditetapkan di sini, dalam satu
 * tempat, tanpa perlu menulis SQL:
 *
 *   1) Kerja & Sasaran To-Do  — senarai kerja setiap ahli + sasaran
 *      harian/mingguan/bulanan. Ahli TIDAK boleh mengubahnya.
 *   2) Kuantiti Harian        — pembetulan angka yang ahli masukkan,
 *      termasuk menanda / membatalkan penghantaran harian.
 *   3) Sasaran Jualan         — sasaran RM bulanan setiap orang.
 *   4) KPI                    — sasaran asas KPI mengikut jawatan.
 *
 * Halaman ini dikawal dua lapis: guard halaman (server) + RLS database.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { perluTodoList } from "@/lib/roles";
import { lengkapkanSasaran } from "@/lib/period";
import type {
  DailySubmission,
  KpiDefinition,
  Profile,
  Position,
  SalesTarget,
  TaskLog,
  TaskTemplate,
} from "@/types/database";

const cardMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const },
};

type Tab = "todo" | "kuantiti" | "jualan" | "kpi";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "todo", label: "Kerja & Sasaran To-Do", icon: "📋" },
  { key: "kuantiti", label: "Kuantiti Harian", icon: "✏️" },
  { key: "jualan", label: "Sasaran Jualan", icon: "💰" },
  { key: "kpi", label: "KPI Jawatan", icon: "🎯" },
];

function hariIni(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Borang satu baris kerja. Rentetan kosong bermakna "tiada sasaran". */
interface BorangKerja {
  title: string;
  unit: string;
  target_daily: string;
  target_weekly: string;
  target_monthly: string;
  sort_order: string;
  note: string;
  active: boolean;
}

function keBorang(t: TaskTemplate): BorangKerja {
  const s = (v: number | null) => (v === null ? "" : String(v));
  return {
    title: t.title,
    unit: t.unit,
    target_daily: s(t.target_daily),
    target_weekly: s(t.target_weekly),
    target_monthly: s(t.target_monthly),
    sort_order: String(t.sort_order),
    note: t.note ?? "",
    active: t.active,
  };
}

function nombor(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function MasterSetting() {
  const supabase = createClient();

  const [tab, setTab] = useState<Tab>("todo");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesej, setMesej] = useState<string | null>(null);
  const [ralat, setRalat] = useState<string | null>(null);

  const lapor = useCallback((teks: string) => {
    setRalat(null);
    setMesej(teks);
    setTimeout(() => setMesej(null), 4000);
  }, []);

  useEffect(() => {
    (async () => {
      const [{ data: prof }, { data: pos }] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("positions").select("*").order("name"),
      ]);
      setProfiles((prof as Profile[]) ?? []);
      setPositions((pos as Position[]) ?? []);
      setLoading(false);
    })();
  }, [supabase]);

  const ahli = useMemo(
    () =>
      profiles.filter(
        (p) => p.active !== false && p.role !== "ceo" && p.role !== "manager"
      ),
    [profiles]
  );

  if (loading) {
    return <p className="text-sm text-muted">Memuatkan tetapan...</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Master Setting</h2>
        <p className="text-sm text-muted">
          Semua sasaran dan kuantiti dashboard ditetapkan di sini. Hanya
          Marketing Manager boleh membuka dan mengubah halaman ini — ahli
          hanya memasukkan kuantiti kerja mereka.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={tab === t.key ? "pill pill-oren" : "pill pill-kosong"}
          >
            <span aria-hidden className="mr-1">
              {t.icon}
            </span>
            {t.label}
          </button>
        ))}
      </div>

      {mesej && (
        <p className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
          ✓ {mesej}
        </p>
      )}
      {ralat && (
        <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm text-red-200">
          {ralat}
        </p>
      )}

      {tab === "todo" && (
        <TabKerja ahli={ahli} lapor={lapor} setRalat={setRalat} />
      )}
      {tab === "kuantiti" && (
        <TabKuantiti ahli={ahli} lapor={lapor} setRalat={setRalat} />
      )}
      {tab === "jualan" && (
        <TabJualan ahli={ahli} lapor={lapor} setRalat={setRalat} />
      )}
      {tab === "kpi" && (
        <TabKpi positions={positions} lapor={lapor} setRalat={setRalat} />
      )}
    </div>
  );
}

// ======================================================= 1) Kerja & Sasaran

function TabKerja({
  ahli,
  lapor,
  setRalat,
}: {
  ahli: Profile[];
  lapor: (t: string) => void;
  setRalat: (t: string | null) => void;
}) {
  const supabase = createClient();
  const layak = useMemo(
    () => ahli.filter((p) => perluTodoList(p.position_code)),
    [ahli]
  );
  const [uid, setUid] = useState<string>("");
  const [kerja, setKerja] = useState<TaskTemplate[]>([]);
  const [borang, setBorang] = useState<Record<number, BorangKerja>>({});
  const [sibuk, setSibuk] = useState(false);
  const [baru, setBaru] = useState<BorangKerja>({
    title: "",
    unit: "unit",
    target_daily: "",
    target_weekly: "",
    target_monthly: "",
    sort_order: "50",
    note: "",
    active: true,
  });

  useEffect(() => {
    if (!uid && layak.length > 0) setUid(layak[0].id);
  }, [layak, uid]);

  const muat = useCallback(async () => {
    if (!uid) return;
    const { data } = await supabase
      .from("task_templates")
      .select("*")
      .eq("user_id", uid)
      .order("sort_order");
    const rows = (data as TaskTemplate[]) ?? [];
    setKerja(rows);
    const b: Record<number, BorangKerja> = {};
    rows.forEach((r) => {
      b[r.id] = keBorang(r);
    });
    setBorang(b);
  }, [supabase, uid]);

  useEffect(() => {
    muat();
  }, [muat]);

  async function simpan(t: TaskTemplate) {
    const b = borang[t.id];
    if (!b) return;
    if (!b.title.trim()) {
      setRalat("Nama kerja tidak boleh kosong.");
      return;
    }
    setSibuk(true);
    const { error } = await supabase
      .from("task_templates")
      .update({
        title: b.title.trim(),
        unit: b.unit.trim() || "unit",
        target_daily: nombor(b.target_daily),
        target_weekly: nombor(b.target_weekly),
        target_monthly: nombor(b.target_monthly),
        sort_order: nombor(b.sort_order) ?? 0,
        note: b.note.trim() || null,
        active: b.active,
        // Kerja yang manager tetapkan sentiasa dikunci: ahli tidak boleh
        // mengubah atau memadamnya.
        locked: true,
      })
      .eq("id", t.id);
    setSibuk(false);
    if (error) {
      setRalat("Gagal menyimpan: " + error.message);
      return;
    }
    lapor(`"${b.title.trim()}" dikemas kini.`);
    muat();
  }

  async function padam(t: TaskTemplate) {
    if (
      !window.confirm(
        `Padam kerja "${t.title}"? Kuantiti harian yang sudah direkod bagi kerja ini akan turut hilang.`
      )
    )
      return;
    setSibuk(true);
    const { error } = await supabase
      .from("task_templates")
      .delete()
      .eq("id", t.id);
    setSibuk(false);
    if (error) {
      setRalat("Gagal memadam: " + error.message);
      return;
    }
    lapor(`"${t.title}" dipadam.`);
    muat();
  }

  async function tambah() {
    if (!uid || !baru.title.trim()) {
      setRalat("Isi nama kerja dahulu.");
      return;
    }
    setSibuk(true);
    const { error } = await supabase.from("task_templates").insert({
      user_id: uid,
      title: baru.title.trim(),
      unit: baru.unit.trim() || "unit",
      target_daily: nombor(baru.target_daily),
      target_weekly: nombor(baru.target_weekly),
      target_monthly: nombor(baru.target_monthly),
      sort_order: nombor(baru.sort_order) ?? 50,
      note: baru.note.trim() || null,
      active: true,
      locked: true,
    });
    setSibuk(false);
    if (error) {
      setRalat("Gagal menambah: " + error.message);
      return;
    }
    lapor(`"${baru.title.trim()}" ditambah.`);
    setBaru({ ...baru, title: "", note: "" });
    muat();
  }

  /** Salin senarai kerja orang ini kepada ahli lain. */
  async function salinKe(targetId: string) {
    const nama = layak.find((p) => p.id === targetId)?.full_name ?? "ahli itu";
    if (
      !window.confirm(
        `Salin ${kerja.length} kerja ini kepada ${nama}? Kerja sedia ada mereka tidak dipadam.`
      )
    )
      return;
    setSibuk(true);
    const { error } = await supabase.from("task_templates").insert(
      kerja.map((t) => ({
        user_id: targetId,
        title: t.title,
        unit: t.unit,
        target_daily: t.target_daily,
        target_weekly: t.target_weekly,
        target_monthly: t.target_monthly,
        sort_order: t.sort_order,
        note: t.note,
        active: t.active,
        locked: true,
      }))
    );
    setSibuk(false);
    if (error) {
      setRalat("Gagal menyalin: " + error.message);
      return;
    }
    lapor(`Disalin kepada ${nama}.`);
  }

  const ubah = (id: number, patch: Partial<BorangKerja>) =>
    setBorang((b) => ({ ...b, [id]: { ...b[id], ...patch } }));

  return (
    <motion.div {...cardMotion} className="space-y-4">
      <div className="card space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px]">
            <label className="label">Ahli</label>
            <select
              className="input"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
            >
              {layak.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                  {p.position_code ? ` · ${p.position_code}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[220px]">
            <label className="label">Salin senarai ini kepada</label>
            <select
              className="input"
              value=""
              onChange={(e) => {
                const pilih = e.target.value;
                e.target.value = "";
                if (pilih) salinKe(pilih);
              }}
              disabled={kerja.length === 0}
            >
              <option value="">- Pilih ahli -</option>
              {layak
                .filter((p) => p.id !== uid)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-muted">
          Biarkan kotak sasaran kosong kalau tiada sasaran bagi tempoh itu.
          Dashboard mengira sendiri yang selebihnya: sasaran harian × 6 hari =
          seminggu, × 26 hari = sebulan (Ahad tidak dikira).
        </p>
      </div>

      {kerja.length === 0 ? (
        <p className="card text-sm text-muted">
          Ahli ini belum mempunyai senarai kerja. Tambah di bawah.
        </p>
      ) : (
        <div className="space-y-3">
          {kerja.map((t) => {
            const b = borang[t.id];
            if (!b) return null;
            const kira = lengkapkanSasaran({
              target_daily: nombor(b.target_daily),
              target_weekly: nombor(b.target_weekly),
              target_monthly: nombor(b.target_monthly),
            });
            return (
              <div key={t.id} className="card space-y-3">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="md:col-span-2">
                    <label className="label">Kerja</label>
                    <input
                      className="input"
                      value={b.title}
                      onChange={(e) => ubah(t.id, { title: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Unit</label>
                    <input
                      className="input"
                      value={b.unit}
                      onChange={(e) => ubah(t.id, { unit: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Urutan</label>
                    <input
                      className="input"
                      inputMode="numeric"
                      value={b.sort_order}
                      onChange={(e) =>
                        ubah(t.id, { sort_order: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <div>
                    <label className="label">Sasaran sehari</label>
                    <input
                      className="input"
                      inputMode="decimal"
                      value={b.target_daily}
                      onChange={(e) =>
                        ubah(t.id, { target_daily: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Sasaran seminggu</label>
                    <input
                      className="input"
                      inputMode="decimal"
                      placeholder={
                        kira.dikira.mingguan && kira.mingguan !== null
                          ? `auto: ${kira.mingguan}`
                          : ""
                      }
                      value={b.target_weekly}
                      onChange={(e) =>
                        ubah(t.id, { target_weekly: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Sasaran sebulan</label>
                    <input
                      className="input"
                      inputMode="decimal"
                      placeholder={
                        kira.dikira.bulanan && kira.bulanan !== null
                          ? `auto: ${kira.bulanan}`
                          : ""
                      }
                      value={b.target_monthly}
                      onChange={(e) =>
                        ubah(t.id, { target_monthly: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Nota</label>
                    <input
                      className="input"
                      value={b.note}
                      onChange={(e) => ubah(t.id, { note: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={b.active}
                      onChange={(e) => ubah(t.id, { active: e.target.checked })}
                    />
                    Aktif
                  </label>
                  {!t.locked && (
                    <span className="pill pill-kuning">Ditambah oleh ahli</span>
                  )}
                  <div className="ml-auto flex gap-2">
                    <button
                      className="btn-secondary"
                      disabled={sibuk}
                      onClick={() => padam(t)}
                    >
                      Padam
                    </button>
                    <button
                      className="btn-primary"
                      disabled={sibuk}
                      onClick={() => simpan(t)}
                    >
                      Simpan
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card space-y-3">
        <h3 className="text-sm font-bold text-white">Tambah kerja baharu</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="label">Kerja</label>
            <input
              className="input"
              value={baru.title}
              onChange={(e) => setBaru({ ...baru, title: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Unit</label>
            <input
              className="input"
              value={baru.unit}
              onChange={(e) => setBaru({ ...baru, unit: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Sasaran sehari</label>
            <input
              className="input"
              inputMode="decimal"
              value={baru.target_daily}
              onChange={(e) =>
                setBaru({ ...baru, target_daily: e.target.value })
              }
            />
          </div>
          <div>
            <label className="label">Sasaran seminggu</label>
            <input
              className="input"
              inputMode="decimal"
              value={baru.target_weekly}
              onChange={(e) =>
                setBaru({ ...baru, target_weekly: e.target.value })
              }
            />
          </div>
          <div>
            <label className="label">Sasaran sebulan</label>
            <input
              className="input"
              inputMode="decimal"
              value={baru.target_monthly}
              onChange={(e) =>
                setBaru({ ...baru, target_monthly: e.target.value })
              }
            />
          </div>
        </div>
        <button className="btn-primary" disabled={sibuk} onClick={tambah}>
          Tambah kerja
        </button>
      </div>
    </motion.div>
  );
}

// ========================================================= 2) Kuantiti harian

function TabKuantiti({
  ahli,
  lapor,
  setRalat,
}: {
  ahli: Profile[];
  lapor: (t: string) => void;
  setRalat: (t: string | null) => void;
}) {
  const supabase = createClient();
  const layak = useMemo(
    () => ahli.filter((p) => perluTodoList(p.position_code)),
    [ahli]
  );
  const [uid, setUid] = useState("");
  const [tarikh, setTarikh] = useState(hariIni());
  const [kerja, setKerja] = useState<TaskTemplate[]>([]);
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [hantar, setHantar] = useState<DailySubmission | null>(null);
  const [nilai, setNilai] = useState<Record<number, string>>({});
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    if (!uid && layak.length > 0) setUid(layak[0].id);
  }, [layak, uid]);

  const muat = useCallback(async () => {
    if (!uid) return;
    const [{ data: t }, { data: l }, { data: s }] = await Promise.all([
      supabase
        .from("task_templates")
        .select("*")
        .eq("user_id", uid)
        .eq("active", true)
        .order("sort_order"),
      supabase
        .from("task_logs")
        .select("*")
        .eq("user_id", uid)
        .eq("log_date", tarikh),
      supabase
        .from("daily_submissions")
        .select("*")
        .eq("user_id", uid)
        .eq("log_date", tarikh)
        .maybeSingle(),
    ]);
    const rows = (t as TaskTemplate[]) ?? [];
    const lrows = (l as TaskLog[]) ?? [];
    setKerja(rows);
    setLogs(lrows);
    setHantar((s as DailySubmission) ?? null);
    const v: Record<number, string> = {};
    rows.forEach((r) => {
      const found = lrows.find((x) => x.template_id === r.id);
      v[r.id] = found ? String(found.qty) : "";
    });
    setNilai(v);
  }, [supabase, uid, tarikh]);

  useEffect(() => {
    muat();
  }, [muat]);

  async function simpanSemua() {
    const baris = kerja
      .filter((t) => (nilai[t.id] ?? "") !== "")
      .map((t) => ({
        user_id: uid,
        template_id: t.id,
        log_date: tarikh,
        qty: Number(nilai[t.id]) || 0,
        updated_at: new Date().toISOString(),
      }));
    if (baris.length === 0) {
      setRalat("Tiada kuantiti untuk disimpan.");
      return;
    }
    setSibuk(true);
    const { error } = await supabase
      .from("task_logs")
      .upsert(baris, { onConflict: "user_id,template_id,log_date" });
    setSibuk(false);
    if (error) {
      setRalat("Gagal menyimpan: " + error.message);
      return;
    }
    lapor(`${baris.length} kuantiti disimpan untuk ${tarikh}.`);
    muat();
  }

  async function tandaHantar() {
    setSibuk(true);
    const { error } = await supabase.from("daily_submissions").upsert(
      {
        user_id: uid,
        log_date: tarikh,
        submitted_at: new Date().toISOString(),
        note: "Ditanda oleh Marketing Manager",
      },
      { onConflict: "user_id,log_date" }
    );
    setSibuk(false);
    if (error) {
      setRalat("Gagal menanda: " + error.message);
      return;
    }
    lapor("Ditanda sebagai sudah hantar.");
    muat();
  }

  async function batalHantar() {
    if (!hantar) return;
    setSibuk(true);
    const { error } = await supabase
      .from("daily_submissions")
      .delete()
      .eq("id", hantar.id);
    setSibuk(false);
    if (error) {
      setRalat("Gagal membatalkan: " + error.message);
      return;
    }
    lapor("Penghantaran dibatalkan.");
    muat();
  }

  return (
    <motion.div {...cardMotion} className="space-y-4">
      <div className="card flex flex-wrap items-end gap-3">
        <div className="min-w-[200px]">
          <label className="label">Ahli</label>
          <select
            className="input"
            value={uid}
            onChange={(e) => setUid(e.target.value)}
          >
            {layak.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Tarikh</label>
          <input
            type="date"
            className="input"
            value={tarikh}
            onChange={(e) => setTarikh(e.target.value)}
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {hantar ? (
            <>
              <span className="pill pill-hijau">Sudah hantar</span>
              <button
                className="btn-secondary"
                disabled={sibuk}
                onClick={batalHantar}
              >
                Batalkan
              </button>
            </>
          ) : (
            <>
              <span className="pill pill-merah">Belum hantar</span>
              <button
                className="btn-secondary"
                disabled={sibuk}
                onClick={tandaHantar}
              >
                Tanda sudah hantar
              </button>
            </>
          )}
        </div>
      </div>

      {kerja.length === 0 ? (
        <p className="card text-sm text-muted">
          Ahli ini tiada kerja aktif pada tarikh ini.
        </p>
      ) : (
        <div className="card space-y-3">
          {kerja.map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center gap-3 border-b border-white/5 pb-3 last:border-0 last:pb-0"
            >
              <div className="min-w-[200px] flex-1">
                <p className="text-sm font-semibold text-white">{t.title}</p>
                <p className="text-xs text-muted">
                  {t.unit}
                  {t.target_daily !== null
                    ? ` · sasaran ${t.target_daily}/hari`
                    : t.target_monthly !== null
                    ? ` · sasaran ${t.target_monthly}/bulan`
                    : ""}
                </p>
              </div>
              <input
                className="input w-28"
                inputMode="decimal"
                placeholder="0"
                value={nilai[t.id] ?? ""}
                onChange={(e) =>
                  setNilai((v) => ({ ...v, [t.id]: e.target.value }))
                }
              />
            </div>
          ))}
          <button className="btn-primary" disabled={sibuk} onClick={simpanSemua}>
            Simpan kuantiti
          </button>
          <p className="text-xs text-muted">
            {logs.length} rekod sedia ada pada tarikh ini.
          </p>
        </div>
      )}
    </motion.div>
  );
}

// ========================================================== 3) Sasaran jualan

function TabJualan({
  ahli,
  lapor,
  setRalat,
}: {
  ahli: Profile[];
  lapor: (t: string) => void;
  setRalat: (t: string | null) => void;
}) {
  const supabase = createClient();
  const now = new Date();
  const [tahun, setTahun] = useState(now.getFullYear());
  const [bulan, setBulan] = useState(now.getMonth() + 1);
  const [sasaran, setSasaran] = useState<SalesTarget[]>([]);
  const [nilai, setNilai] = useState<Record<string, string>>({});
  const [pukal, setPukal] = useState("100000");
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async () => {
    const { data } = await supabase
      .from("sales_targets")
      .select("*")
      .eq("year", tahun)
      .eq("month", bulan);
    const rows = (data as SalesTarget[]) ?? [];
    setSasaran(rows);
    const v: Record<string, string> = {};
    ahli.forEach((p) => {
      const f = rows.find((r) => r.user_id === p.id);
      v[p.id] = f ? String(f.target_rm) : "";
    });
    setNilai(v);
  }, [supabase, tahun, bulan, ahli]);

  useEffect(() => {
    muat();
  }, [muat]);

  async function simpan() {
    const baris = ahli
      .filter((p) => (nilai[p.id] ?? "").trim() !== "")
      .map((p) => ({
        user_id: p.id,
        year: tahun,
        month: bulan,
        target_rm: Number(nilai[p.id]) || 0,
        updated_at: new Date().toISOString(),
      }));
    if (baris.length === 0) {
      setRalat("Tiada sasaran untuk disimpan.");
      return;
    }
    setSibuk(true);
    const { error } = await supabase
      .from("sales_targets")
      .upsert(baris, { onConflict: "user_id,year,month" });
    setSibuk(false);
    if (error) {
      setRalat("Gagal menyimpan: " + error.message);
      return;
    }
    lapor(`${baris.length} sasaran disimpan untuk ${bulan}/${tahun}.`);
    muat();
  }

  /** Tetapkan sasaran yang sama untuk semua bulan yang tinggal dalam tahun ini. */
  async function sepanjangTahun() {
    const baris: {
      user_id: string;
      year: number;
      month: number;
      target_rm: number;
    }[] = [];
    ahli.forEach((p) => {
      const v = (nilai[p.id] ?? "").trim();
      if (v === "") return;
      for (let m = bulan; m <= 12; m++) {
        baris.push({
          user_id: p.id,
          year: tahun,
          month: m,
          target_rm: Number(v) || 0,
        });
      }
    });
    if (baris.length === 0) {
      setRalat("Isi sasaran dahulu.");
      return;
    }
    if (
      !window.confirm(
        `Tetapkan sasaran ini untuk bulan ${bulan} hingga 12 tahun ${tahun}? (${baris.length} baris)`
      )
    )
      return;
    setSibuk(true);
    const { error } = await supabase
      .from("sales_targets")
      .upsert(baris, { onConflict: "user_id,year,month" });
    setSibuk(false);
    if (error) {
      setRalat("Gagal menyimpan: " + error.message);
      return;
    }
    lapor(`Sasaran ditetapkan sehingga Disember ${tahun}.`);
    muat();
  }

  return (
    <motion.div {...cardMotion} className="space-y-4">
      <div className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Tahun</label>
          <input
            className="input w-28"
            inputMode="numeric"
            value={tahun}
            onChange={(e) => setTahun(Number(e.target.value) || tahun)}
          />
        </div>
        <div>
          <label className="label">Bulan</label>
          <select
            className="input w-28"
            value={bulan}
            onChange={(e) => setBulan(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Isi semua dengan (RM)</label>
          <div className="flex gap-2">
            <input
              className="input w-32"
              inputMode="numeric"
              value={pukal}
              onChange={(e) => setPukal(e.target.value)}
            />
            <button
              className="btn-secondary"
              onClick={() => {
                const v: Record<string, string> = {};
                ahli.forEach((p) => {
                  v[p.id] = pukal;
                });
                setNilai(v);
              }}
            >
              Isi
            </button>
          </div>
        </div>
        <p className="w-full text-xs text-muted">
          Sasaran mingguan dikira sendiri oleh dashboard: sasaran bulanan
          dibahagi 4.
        </p>
      </div>

      <div className="card space-y-3">
        {ahli.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center gap-3 border-b border-white/5 pb-3 last:border-0 last:pb-0"
          >
            <div className="min-w-[200px] flex-1">
              <p className="text-sm font-semibold text-white">{p.full_name}</p>
              <p className="text-xs text-muted">{p.position_code ?? "-"}</p>
            </div>
            <span className="text-xs text-muted">RM</span>
            <input
              className="input w-36"
              inputMode="numeric"
              placeholder="tiada sasaran"
              value={nilai[p.id] ?? ""}
              onChange={(e) =>
                setNilai((v) => ({ ...v, [p.id]: e.target.value }))
              }
            />
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={sibuk} onClick={simpan}>
            Simpan bulan ini
          </button>
          <button
            className="btn-secondary"
            disabled={sibuk}
            onClick={sepanjangTahun}
          >
            Guna sehingga Disember
          </button>
        </div>
        <p className="text-xs text-muted">
          {sasaran.length} sasaran direkod bagi bulan ini.
        </p>
      </div>
    </motion.div>
  );
}

// ================================================================== 4) KPI

function TabKpi({
  positions,
  lapor,
  setRalat,
}: {
  positions: Position[];
  lapor: (t: string) => void;
  setRalat: (t: string | null) => void;
}) {
  const supabase = createClient();
  const [kod, setKod] = useState("");
  const [kpi, setKpi] = useState<KpiDefinition[]>([]);
  const [nilai, setNilai] = useState<Record<string, string>>({});
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    if (!kod && positions.length > 0) setKod(positions[0].code);
  }, [positions, kod]);

  const muat = useCallback(async () => {
    if (!kod) return;
    const { data } = await supabase
      .from("kpi_definitions")
      .select("*")
      .eq("position_code", kod)
      .order("sort_order");
    const rows = (data as KpiDefinition[]) ?? [];
    setKpi(rows);
    const v: Record<string, string> = {};
    rows.forEach((r) => {
      v[r.id] = String(r.default_target);
    });
    setNilai(v);
  }, [supabase, kod]);

  useEffect(() => {
    muat();
  }, [muat]);

  async function simpan(k: KpiDefinition) {
    setSibuk(true);
    const { error } = await supabase
      .from("kpi_definitions")
      .update({ default_target: Number(nilai[k.id]) || 0 })
      .eq("id", k.id);
    setSibuk(false);
    if (error) {
      setRalat("Gagal menyimpan: " + error.message);
      return;
    }
    lapor(`Sasaran "${k.name}" dikemas kini.`);
    muat();
  }

  async function tukarAktif(k: KpiDefinition) {
    setSibuk(true);
    const { error } = await supabase
      .from("kpi_definitions")
      .update({ active: !k.active })
      .eq("id", k.id);
    setSibuk(false);
    if (error) {
      setRalat("Gagal mengubah: " + error.message);
      return;
    }
    muat();
  }

  return (
    <motion.div {...cardMotion} className="space-y-4">
      <div className="card">
        <label className="label">Jawatan</label>
        <select
          className="input max-w-sm"
          value={kod}
          onChange={(e) => setKod(e.target.value)}
        >
          {positions.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name} ({p.code})
            </option>
          ))}
        </select>
      </div>

      {kpi.length === 0 ? (
        <p className="card text-sm text-muted">
          Tiada KPI ditetapkan untuk jawatan ini.
        </p>
      ) : (
        <div className="card space-y-3">
          {kpi.map((k) => (
            <div
              key={k.id}
              className="flex flex-wrap items-center gap-3 border-b border-white/5 pb-3 last:border-0 last:pb-0"
            >
              <div className="min-w-[220px] flex-1">
                <p className="text-sm font-semibold text-white">{k.name}</p>
                <p className="text-xs text-muted">
                  {k.kpi_group} · {k.unit} · berat {k.weight}
                  {k.active ? "" : " · tidak aktif"}
                </p>
              </div>
              <input
                className="input w-28"
                inputMode="decimal"
                value={nilai[k.id] ?? ""}
                onChange={(e) =>
                  setNilai((v) => ({ ...v, [k.id]: e.target.value }))
                }
              />
              <button
                className="btn-secondary"
                disabled={sibuk}
                onClick={() => tukarAktif(k)}
              >
                {k.active ? "Nyahaktif" : "Aktifkan"}
              </button>
              <button
                className="btn-primary"
                disabled={sibuk}
                onClick={() => simpan(k)}
              >
                Simpan
              </button>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
