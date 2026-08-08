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

/** Padankan apa sahaja status dari CRM kepada 4 kategori paparan. */
function tierOf(status: string | null): Tier {
  const s = (status ?? "").toLowerCase();
  if (!s) return "baru";
  if (/(pulih|recover|berjaya|success|closed won|won|bayar|paid)/.test(s))
    return "pulih";
  if (/(gagal|fail|lost|tolak|reject|tak jadi|batal)/.test(s)) return "gagal";
  if (/(proses|hubung|contact|follow|pending|ongoing|progress)/.test(s))
    return "proses";
  if (/(baru|new|open)/.test(s)) return "baru";
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

  useEffect(() => {
    load();
  }, [load]);

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
          <button onClick={load} className="btn-secondary" disabled={loading}>
            {loading ? "Memuatkan..." : "Muat Semula"}
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

      {/* Dua nombor utama */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <motion.div
          {...cardMotion}
          className="rounded-2xl border border-masdora-orange/25 bg-gradient-to-br from-masdora-orange/20 to-masdora-orange/5 p-6"
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
            Customer dihubungi
          </p>
          <p className="mt-1 text-4xl font-black text-white">
            {filtered.length.toLocaleString("ms-MY")}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {counts.pulih} berjaya · {counts.proses} dalam proses
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
