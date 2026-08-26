"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

interface RecoveryRecord {
  id: number;
  source_id: string;
  customer_name: string | null;
  customer_contact: string | null;
  status: string | null;
  amount_rm: number | string | null;
  contacted_at: string | null;
  handler_code: string | null;
  note: string | null;
  updated_at: string;
}

const CRM_URL = "https://masdora.zo.space/team/recovery-crm";

/** Bentuk balasan /api/crm-sync?debug=1 */
interface DiagnosisCrm {
  logMasukBerjaya?: boolean;
  rekodDikenali?: number;
  statusPasukan?: number;
  jejak?: {
    statusPost: number;
    adaCookie: boolean;
    ikutPengalihan: string | null;
    statusAkhir: number;
    panjangHtml: number;
    masihBorangLogMasuk: boolean;
    cebisan: string;
  };
  struktur?: {
    headers: string[];
    rowCount: number;
    tableCount: number;
    jsonEmbedded: boolean;
    jsonCebisan: string | null;
    statusCebisan?: string[];
    endpoints?: string[];
    sample: string[][];
  };
  error?: string;
}

const cardMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const },
};

type Tier = "pulih" | "proses" | "gagal" | "baru";

const TIERS: { key: Tier; label: string; pill: string; icon: string }[] = [
  { key: "baru", label: "Baru", pill: "pill-kosong", icon: "🆕" },
  { key: "proses", label: "Sedang Dihubungi", pill: "pill-kuning", icon: "⏳" },
  { key: "pulih", label: "Berjaya Pulih", pill: "pill-hijau", icon: "✅" },
  { key: "gagal", label: "Tidak Berjaya", pill: "pill-merah", icon: "❌" },
];

const TIER_MAP = Object.fromEntries(TIERS.map((t) => [t.key, t]));

/**
 * Padankan apa sahaja status dari CRM kepada 4 kategori paparan.
 *
 * CRM menarik data dari Shopify, jadi statusnya termasuk istilah Shopify
 * seperti PAID, PENDING, EXPIRED, REFUNDED, VOIDED — di samping istilah
 * CRM sendiri seperti ABANDONED, Open, Recovered, Lost.
 */
function tierOf(status: string | null): Tier {
  const s = (status ?? "").toLowerCase();
  if (!s) return "baru";

  // Duit sudah masuk
  if (/(paid|recover|won|pulih|berjaya|bayar|success)/.test(s)) return "pulih";

  // Kes mati — dibatalkan, dipulangkan, atau hilang
  if (/(void|refund|cancel|lost|gagal|fail|tolak|reject|batal)/.test(s))
    return "gagal";

  // Sedang disusuli oleh Maisarah
  if (/(contact|hubung|follow|progress|ongoing|proses)/.test(s))
    return "proses";

  // Kes menunggu tindakan — troli ditinggalkan, bayaran tertunggak
  if (/(abandon|expire|unpaid|pending|open|new|baru)/.test(s)) return "baru";

  return "proses";
}

function formatRM(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return `RM ${v.toLocaleString("ms-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function RecoveryPage() {
  const supabase = createClient();

  const [records, setRecords] = useState<RecoveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<Tier | "">("");
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  /** Hasil pemeriksaan — dipapar dalam halaman supaya mudah dikongsi. */
  const [diagnosis, setDiagnosis] = useState<DiagnosisCrm | null>(null);
  const [checking, setChecking] = useState(false);

  /**
   * Tarik data terkini dari CRM, kemudian baca dari database.
   *
   * Dashboard log masuk sendiri ke CRM di sebelah pelayan — tiada apa yang
   * perlu diubah pada CRM, dan kata laluannya tidak pernah sampai ke
   * pelayar ini.
   */
  const segerak = useCallback(async (paksa = false) => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch(`/api/crm-sync${paksa ? "?force=1" : ""}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (json.ok) {
        if (json.dilangkau) setSyncMsg(json.sebab);
        else if (json.disegerakkan)
          setSyncMsg(`${json.disegerakkan} rekod ditarik dari CRM.`);
      } else {
        setSyncMsg(json.error ?? "Gagal menarik data dari CRM.");
      }
    } catch {
      setSyncMsg("Gagal menghubungi CRM.");
    }
    setSyncing(false);
  }, []);

  /** Periksa apa yang pelayan CRM sebenarnya balas — tanpa menyimpan apa-apa. */
  const periksa = useCallback(async () => {
    setChecking(true);
    setDiagnosis(null);
    try {
      const res = await fetch("/api/crm-sync?debug=1", { cache: "no-store" });
      setDiagnosis((await res.json()) as DiagnosisCrm);
    } catch {
      setDiagnosis({ error: "Gagal menghubungi pelayan." });
    }
    setChecking(false);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from("recovery_records")
      .select("*")
      .order("contacted_at", { ascending: false, nullsFirst: false })
      .limit(500);

    if (qErr) {
      setError(
        "Gagal memuatkan data. Pastikan jadual recovery_records sudah dicipta di Supabase."
      );
      setRecords([]);
    } else {
      setRecords((data as RecoveryRecord[]) ?? []);
    }
    setLoading(false);
  }, [supabase]);

  // Buka halaman = tarik dari CRM dahulu, kemudian papar.
  useEffect(() => {
    (async () => {
      await segerak();
      await load();
    })();
  }, [segerak, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (tierFilter && tierOf(r.status) !== tierFilter) return false;
      if (q) {
        const hay =
          `${r.customer_name ?? ""} ${r.customer_contact ?? ""} ${r.status ?? ""} ${r.note ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [records, tierFilter, search]);

  const counts = useMemo(() => {
    const c: Record<Tier, number> = { baru: 0, proses: 0, pulih: 0, gagal: 0 };
    filtered.forEach((r) => c[tierOf(r.status)]++);
    return c;
  }, [filtered]);

  const totalRecovered = filtered
    .filter((r) => tierOf(r.status) === "pulih")
    .reduce((s, r) => s + Number(r.amount_rm ?? 0), 0);

  /**
   * Bila kali terakhir CRM menghantar data ke sini.
   *
   * Tanpa ini, halaman kosong bermakna dua perkara yang sangat berbeza —
   * "belum ada customer untuk dihubungi" atau "saluran data rosak" — dan
   * tiada cara untuk membezakannya.
   */
  const lastSync = useMemo(() => {
    if (records.length === 0) return null;
    const terkini = records
      .map((r) => r.updated_at)
      .filter(Boolean)
      .sort()
      .at(-1);
    if (!terkini) return null;
    const d = new Date(terkini);
    if (Number.isNaN(d.getTime())) return null;
    const jamLalu = (Date.now() - d.getTime()) / 3_600_000;
    return {
      teks: d.toLocaleString("ms-MY"),
      basi: jamLalu > 48,
      jamLalu: Math.round(jamLalu),
    };
  }, [records]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Recovery CRM</h2>
          <p className="text-sm text-muted">
            Data dari sistem Recovery CRM — dikemas kini automatik.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              await segerak(true);
              await load();
            }}
            className="btn-secondary"
            disabled={loading || syncing}
          >
            {syncing
              ? "Menarik dari CRM..."
              : loading
              ? "Memuatkan..."
              : "Tarik Data CRM"}
          </button>
          <button
            onClick={periksa}
            disabled={checking}
            className="btn-secondary"
            title="Lihat apa yang pelayan CRM sebenarnya balas"
          >
            {checking ? "Memeriksa..." : "Periksa"}
          </button>
          <a
            href={CRM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            Buka CRM
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

      {/* Keadaan saluran data — supaya "kosong" tidak mengelirukan */}
      {!loading && !error && (
        <motion.div
          {...cardMotion}
          className={`card text-sm ${
            records.length === 0
              ? "border-masdora-alert/40"
              : lastSync?.basi
              ? "border-masdora-yellow/40"
              : ""
          }`}
        >
          {records.length === 0 ? (
            <>
              <p className="font-bold text-red-200">
                Belum ada data ditarik dari CRM
              </p>
              <p className="mt-1 text-xs text-slate-300">
                {syncMsg ??
                  "Dashboard akan log masuk ke CRM dan menarik data secara automatik sebaik CRM_TEAM_PASSWORD ditetapkan di Vercel."}
              </p>
              <button
                onClick={periksa}
                disabled={checking}
                className="btn-secondary mt-3"
              >
                {checking ? "Memeriksa..." : "Periksa Punca"}
              </button>
            </>
          ) : lastSync ? (
            <p className={lastSync.basi ? "text-amber-200" : "text-slate-400"}>
              {lastSync.basi ? "⚠️ " : "✓ "}
              Data terakhir diterima dari CRM:{" "}
              <strong className="text-white">{lastSync.teks}</strong>
              {lastSync.basi && (
                <span>
                  {" "}
                  — sudah {lastSync.jamLalu} jam. Sila semak sama ada CRM masih
                  menghantar.
                </span>
              )}
            </p>
          ) : null}
        </motion.div>
      )}

      {/* Hasil pemeriksaan — dipapar di skrin supaya mudah dikongsi */}
      {diagnosis && (
        <motion.div {...cardMotion} className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white">Hasil Pemeriksaan CRM</h3>
            <button
              className="text-xs font-bold text-slate-400 hover:text-white"
              onClick={() => setDiagnosis(null)}
            >
              Tutup
            </button>
          </div>

          {diagnosis.error ? (
            <p className="text-sm text-red-300">{diagnosis.error}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Fakta
                  label="Log masuk"
                  nilai={diagnosis.logMasukBerjaya ? "Berjaya" : "Gagal"}
                  baik={!!diagnosis.logMasukBerjaya}
                />
                <Fakta
                  label="Rekod dikenali"
                  nilai={String(diagnosis.rekodDikenali ?? 0)}
                  baik={(diagnosis.rekodDikenali ?? 0) > 0}
                />
                <Fakta
                  label="Status pasukan"
                  nilai={String(diagnosis.statusPasukan ?? 0)}
                  baik={(diagnosis.statusPasukan ?? 0) > 0}
                />
                <Fakta
                  label="Saiz halaman"
                  nilai={`${Math.round(
                    (diagnosis.jejak?.panjangHtml ?? 0) / 1024
                  )} KB`}
                  baik={(diagnosis.jejak?.panjangHtml ?? 0) > 20000}
                />
              </div>

              {(diagnosis.struktur?.headers?.length ?? 0) > 0 && (
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Lajur yang dibaca
                  </p>
                  <p className="text-xs text-slate-300">
                    {diagnosis.struktur!.headers.join(" · ")}
                  </p>
                </div>
              )}

              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Apa yang pelayan CRM balas
                </p>
                <p className="max-h-40 overflow-auto rounded-lg border border-white/10 bg-black/30 p-2 font-mono text-[11px] leading-relaxed text-slate-300">
                  {diagnosis.jejak?.cebisan || "(kosong)"}
                </p>
              </div>

              <p className="text-[11px] text-slate-500">
                Status POST {diagnosis.jejak?.statusPost} · cookie{" "}
                {diagnosis.jejak?.adaCookie ? "ada" : "tiada"} · borang log
                masuk {diagnosis.jejak?.masihBorangLogMasuk ? "masih ada" : "tiada"}
                {diagnosis.struktur?.jsonEmbedded ? " · ada JSON terbenam" : ""}
              </p>
              {(diagnosis.struktur?.endpoints?.length ?? 0) > 0 && (
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    URL yang dipanggil oleh CRM
                  </p>
                  <p className="font-mono text-[11px] text-slate-300">
                    {diagnosis.struktur!.endpoints!.join(" · ")}
                  </p>
                </div>
              )}

              {(diagnosis.struktur?.statusCebisan?.length ?? 0) > 0 && (
                <div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Di mana status team disimpan
                  </p>
                  <div className="max-h-48 space-y-1 overflow-auto">
                    {diagnosis.struktur!.statusCebisan!.map((c, i) => (
                      <p
                        key={i}
                        className="rounded border border-white/10 bg-black/30 p-2 font-mono text-[10px] leading-relaxed text-slate-300"
                      >
                        {c}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[11px] text-amber-200">
                Hantar tangkapan skrin kotak ini kepada saya — ia cukup untuk
                saya tahu langkah seterusnya.
              </p>
            </>
          )}
        </motion.div>
      )}

      {/* Dua nombor utama */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <motion.div
          {...cardMotion}
          className="rounded-2xl border border-masdora-orange/25 bg-gradient-to-br from-masdora-orange/20 to-masdora-orange/5 p-6"
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
            Jumlah kes recovery
          </p>
          <p className="mt-1 text-4xl font-black text-white">
            {filtered.length.toLocaleString("ms-MY")}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {counts.pulih} berjaya pulih · {counts.baru} menunggu tindakan
          </p>
        </motion.div>

        <motion.div
          {...cardMotion}
          transition={{ ...cardMotion.transition, delay: 0.06 }}
          className="rounded-2xl border border-masdora-olive/35 bg-gradient-to-br from-masdora-olive/25 to-masdora-olive/5 p-6"
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
            Jualan pulih
          </p>
          <p className="mt-1 text-4xl font-black text-white">
            {formatRM(totalRecovered)}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            dari {counts.pulih} customer yang berjaya dipulihkan
          </p>
        </motion.div>
      </div>

      {/* Tapisan status */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TIERS.map((t, i) => {
          const active = tierFilter === t.key;
          return (
            <motion.button
              key={t.key}
              {...cardMotion}
              transition={{ ...cardMotion.transition, delay: i * 0.05 }}
              onClick={() => setTierFilter(active ? "" : t.key)}
              className={`rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition ${
                active ? "ring-2 ring-white/40" : "hover:bg-white/[0.07]"
              }`}
            >
              <p className="text-[11px] font-semibold text-slate-400">
                {t.icon} {t.label}
              </p>
              <p className="mt-1 text-xl font-black text-white">
                {counts[t.key]}
              </p>
            </motion.button>
          );
        })}
      </div>

      <motion.div {...cardMotion} className="card">
        <label className="label">Cari</label>
        <input
          className="input"
          placeholder="Nama customer, nombor telefon, catatan..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </motion.div>

      {loading ? (
        <p className="text-sm text-muted">Memuatkan data...</p>
      ) : filtered.length === 0 ? (
        <motion.div {...cardMotion} className="card text-center text-sm text-muted">
          {records.length === 0
            ? "Belum ada data dari Recovery CRM. Data akan muncul di sini secara automatik selepas CRM disambungkan."
            : "Tiada rekod yang sepadan dengan tapisan ini."}
        </motion.div>
      ) : (
        <motion.div {...cardMotion} className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Tarikh</th>
                <th>Customer</th>
                <th>Hubungan</th>
                <th>Status</th>
                <th>Jumlah (RM)</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const tier = TIER_MAP[tierOf(r.status)];
                return (
                  <tr key={r.id}>
                    <td>{r.contacted_at ?? "—"}</td>
                    <td className="font-semibold text-slate-100">
                      {r.customer_name ?? "—"}
                    </td>
                    <td>{r.customer_contact ?? "—"}</td>
                    <td>
                      <span className={`pill ${tier.pill}`}>
                        {tier.icon} {r.status || tier.label}
                      </span>
                    </td>
                    <td className="font-bold text-brand-400">
                      {Number(r.amount_rm ?? 0) > 0 ? formatRM(r.amount_rm) : "—"}
                    </td>
                    <td className="max-w-xs truncate" title={r.note ?? ""}>
                      {r.note || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </motion.div>
      )}
    </div>
  );
}

/** Satu fakta ringkas dalam panel pemeriksaan. */
function Fakta({
  label,
  nilai,
  baik,
}: {
  label: string;
  nilai: string;
  baik: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-2.5 ${
        baik
          ? "border-masdora-olive/35 bg-masdora-olive/10"
          : "border-masdora-alert/35 bg-masdora-alert/10"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-black text-white">
        {baik ? "✓ " : "✕ "}
        {nilai}
      </p>
    </div>
  );
}
