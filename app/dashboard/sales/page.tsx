"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { getCurrentYear, getCurrentMonth, monthName } from "@/lib/period";
import { canKeyInSale, isManager, isCeo, type Role } from "@/lib/roles";
import DataTable, { DataTableColumn } from "@/components/DataTable";
import type {
  Profile,
  SaleLookup,
  SalePlatform,
  VSalesMonthly,
} from "@/types/database";

const PLATFORMS: SalePlatform[] = [
  "live",
  "marketplace",
  "whatsapp",
  "web",
  "walkin",
];

const cardMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const },
};

interface MonthlyRow extends VSalesMonthly {
  full_name?: string;
}

export default function SalesPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [lookups, setLookups] = useState<SaleLookup[]>([]);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    date: today,
    amount_rm: "",
    platform: "live" as SalePlatform,
    team: "",
    host_name: "",
    live_account: "",
    session_start: "",
    session_end: "",
    note: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: prof } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle<Profile>();
    setProfile(prof ?? null);

    const { data: lookupRows } = await supabase
      .from("sale_lookups")
      .select("*")
      .order("type")
      .order("name");
    setLookups((lookupRows as SaleLookup[]) ?? []);

    const year = getCurrentYear();
    const month = getCurrentMonth();

    if (prof && (isManager(prof.role) || isCeo(prof.role))) {
      const [{ data: salesRows }, { data: profiles }] = await Promise.all([
        supabase
          .from("v_sales_monthly")
          .select("*")
          .eq("year", year)
          .eq("month", month),
        supabase.from("profiles").select("*"),
      ]);
      const profileMap = new Map(
        ((profiles as Profile[]) ?? []).map((p) => [p.id, p.full_name])
      );
      setMonthly(
        ((salesRows as VSalesMonthly[]) ?? []).map((r) => ({
          ...r,
          full_name: profileMap.get(r.user_id) ?? r.user_id,
        }))
      );
    } else if (prof) {
      const { data: salesRows } = await supabase
        .from("v_sales_monthly")
        .select("*")
        .eq("user_id", prof.id)
        .eq("year", year)
        .eq("month", month);
      setMonthly((salesRows as VSalesMonthly[]) ?? []);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const eligible =
    !!profile && canKeyInSale(profile.role as Role, profile.position_code);
  const showLiveFields = profile?.position_code === "VID_PROD";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setMessage(null);
    setSaving(true);

    const amount = Number(form.amount_rm);
    if (Number.isNaN(amount) || amount < 0) {
      setMessage("Jumlah (RM) tidak sah.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("sales").insert({
      user_id: profile.id,
      date: form.date,
      amount_rm: amount,
      platform: form.platform,
      team: form.team || null,
      host_name: form.host_name || null,
      live_account: form.live_account || null,
      session_start: form.session_start || null,
      session_end: form.session_end || null,
      note: form.note,
      created_by: profile.id,
    });

    setSaving(false);

    if (error) {
      setMessage("Gagal menyimpan jualan: " + error.message);
      return;
    }

    setMessage("Jualan berjaya direkodkan.");
    setForm({ ...form, amount_rm: "", note: "" });
    load();
  }

  const teams = lookups.filter((l) => l.type === "team");
  const hosts = lookups.filter((l) => l.type === "host");
  const accounts = lookups.filter((l) => l.type === "account");

  const monthlyColumns: DataTableColumn<MonthlyRow>[] = [
    ...(profile && (isManager(profile.role) || isCeo(profile.role))
      ? [{ key: "full_name", header: "Nama" } as DataTableColumn<MonthlyRow>]
      : []),
    { key: "month", header: "Bulan", render: (r) => monthName(r.month) },
    {
      key: "total_rm",
      header: "Jumlah (RM)",
      render: (r) => Number(r.total_rm).toLocaleString("ms-MY"),
    },
    { key: "entries", header: "Bilangan Rekod" },
  ];

  if (loading) {
    return <p className="text-sm text-muted">Memuatkan...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Key-in Jualan</h2>
        <p className="text-sm text-muted">
          Rekod jualan harian bagi jawatan yang layak.
        </p>
      </div>

      {eligible ? (
        <motion.form
          {...cardMotion}
          onSubmit={handleSubmit}
          className="card grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          <div>
            <label className="label">Tarikh</label>
            <input
              type="date"
              className="input"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Jumlah (RM)</label>
            <input
              type="number"
              step="0.01"
              min={0}
              className="input"
              value={form.amount_rm}
              onChange={(e) => setForm({ ...form, amount_rm: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Platform</label>
            <select
              className="input"
              value={form.platform}
              onChange={(e) =>
                setForm({ ...form, platform: e.target.value as SalePlatform })
              }
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          {showLiveFields && (
            <>
              <div>
                <label className="label">Team</label>
                <select
                  className="input"
                  value={form.team}
                  onChange={(e) => setForm({ ...form, team: e.target.value })}
                >
                  <option value="">- Pilih -</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Host Name</label>
                <select
                  className="input"
                  value={form.host_name}
                  onChange={(e) =>
                    setForm({ ...form, host_name: e.target.value })
                  }
                >
                  <option value="">- Pilih -</option>
                  {hosts.map((h) => (
                    <option key={h.id} value={h.name}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Live Account</label>
                <select
                  className="input"
                  value={form.live_account}
                  onChange={(e) =>
                    setForm({ ...form, live_account: e.target.value })
                  }
                >
                  <option value="">- Pilih -</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.name}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Mula Sesi</label>
                <input
                  type="time"
                  className="input"
                  value={form.session_start}
                  onChange={(e) =>
                    setForm({ ...form, session_start: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">Tamat Sesi</label>
                <input
                  type="time"
                  className="input"
                  value={form.session_end}
                  onChange={(e) =>
                    setForm({ ...form, session_end: e.target.value })
                  }
                />
              </div>
            </>
          )}
          <div className="md:col-span-3">
            <label className="label">Catatan</label>
            <input
              className="input"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
          {message && (
            <p className="md:col-span-3 text-sm text-brand-400">{message}</p>
          )}
          <div className="md:col-span-3">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan Jualan"}
            </button>
          </div>
        </motion.form>
      ) : (
        <motion.div {...cardMotion} className="card text-sm text-gray-300">
          Jawatan anda tidak layak untuk key-in jualan. Hanya CS Web, CS
          Shopee, CS TikTok, Videographer Produk & Shopee, dan Manager yang
          boleh merekod jualan.
        </motion.div>
      )}

      <div>
        <h3 className="mb-2 font-semibold text-white">
          Jumlah Jualan Bulan Ini
        </h3>
        <DataTable<MonthlyRow>
          columns={monthlyColumns}
          rows={monthly}
          rowKey={(r) => r.user_id + r.month_start}
          emptyMessage="Tiada rekod jualan bulan ini."
        />
      </div>
    </div>
  );
}
