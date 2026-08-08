"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { canKeyInSale, isManager, isCeo, type Role } from "@/lib/roles";
import DataTable, { DataTableColumn } from "@/components/DataTable";
import type {
  Profile,
  Sale,

  SalePlatform,
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

interface SaleRow extends Sale {
  full_name?: string;
}

function formatRM(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "-";
  return `RM ${Number(n).toLocaleString("ms-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function SalesPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);

  const [recent, setRecent] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

    if (prof && (isManager(prof.role) || isCeo(prof.role))) {
      const [{ data: saleRows }, { data: profiles }] = await Promise.all([
        supabase
          .from("sales")
          .select("*")
          .order("date", { ascending: false })
          .limit(50),
        supabase.from("profiles").select("*"),
      ]);
      const profileMap = new Map(
        ((profiles as Profile[]) ?? []).map((p) => [p.id, p.full_name])
      );
      setRecent(
        ((saleRows as Sale[]) ?? []).map((r) => ({
          ...r,
          full_name: profileMap.get(r.user_id) ?? r.user_id,
        }))
      );
    } else if (prof) {
      const { data: saleRows } = await supabase
        .from("sales")
        .select("*")
        .eq("user_id", prof.id)
        .order("date", { ascending: false })
        .limit(50);
      setRecent(
        ((saleRows as Sale[]) ?? []).map((r) => ({
          ...r,
          full_name: prof.full_name,
        }))
      );
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const eligible =
    !!profile && canKeyInSale(profile.role as Role, profile.position_code);

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

  async function handleDelete(id: number) {
    setMessage(null);
    setDeletingId(id);

    // .select() supaya kita tahu sama ada baris betul-betul dipadam.
    // Kalau RLS menghalang, Supabase pulangkan array kosong tanpa error.
    const { data, error } = await supabase
      .from("sales")
      .delete()
      .eq("id", id)
      .select();

    setDeletingId(null);
    setConfirmId(null);

    if (error) {
      setMessage("Gagal memadam rekod: " + error.message);
      return;
    }

    if (!data || data.length === 0) {
      setMessage(
        "Rekod tidak dipadam — anda tiada kebenaran untuk memadam rekod ini. Sila hubungi manager."
      );
      return;
    }

    setMessage("Rekod jualan telah dipadam.");
    load();
  }


  const recentColumns: DataTableColumn<SaleRow>[] = [
    { key: "date", header: "Tarikh" },
    ...(profile && (isManager(profile.role) || isCeo(profile.role))
      ? [{ key: "full_name", header: "Nama" } as DataTableColumn<SaleRow>]
      : []),
    {
      key: "amount_rm",
      header: "Jumlah (RM)",
      render: (r) => formatRM(r.amount_rm),
    },
    { key: "platform", header: "Platform" },
    {
      key: "note",
      header: "Catatan",
      render: (r) => r.note || "-",
    },
    {
      key: "id",
      header: "",
      render: (r) => {
        const id = Number(r.id);
        if (deletingId === id) {
          return <span className="text-xs text-muted">Memadam...</span>;
        }
        if (confirmId === id) {
          return (
            <span className="flex items-center gap-2">
              <button
                onClick={() => handleDelete(id)}
                className="rounded-lg border border-red-500/40 bg-red-500/15 px-2.5 py-1 text-xs font-bold text-red-300 transition hover:bg-red-500/25"
              >
                Ya, padam
              </button>
              <button
                onClick={() => setConfirmId(null)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Batal
              </button>
            </span>
          );
        }
        return (
          <button
            onClick={() => setConfirmId(id)}
            className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-semibold text-slate-400 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
            title="Padam rekod ini"
          >
            Padam
          </button>
        );
      },
    },
  ];

  const totalRecent = recent.reduce((s, r) => s + Number(r.amount_rm ?? 0), 0);

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
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold text-white">Rekod Jualan Terkini</h3>
          {recent.length > 0 && (
            <p className="text-sm text-muted">
              {recent.length} rekod · Jumlah{" "}
              <span className="font-bold text-brand-400">
                {formatRM(totalRecent)}
              </span>
            </p>
          )}
        </div>
        <DataTable<SaleRow>
          columns={recentColumns}
          rows={recent}
          rowKey={(r) => String(r.id)}
          emptyMessage="Belum ada rekod jualan. Isi borang di atas untuk mula merekod."
        />
      </div>
    </div>
  );
}
