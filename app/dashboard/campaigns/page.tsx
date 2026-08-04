"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { getCurrentYear, getCurrentMonth, monthName } from "@/lib/period";
import { isManager, type Role } from "@/lib/roles";
import type {
  Campaign,
  CampaignStatus,
  CampaignType,
  Profile,
} from "@/types/database";

const TYPES: CampaignType[] = ["double_date", "mid_month", "pay_day", "other"];
const STATUSES: CampaignStatus[] = [
  "perancangan",
  "berjalan",
  "selesai",
  "tunda",
];

const cardMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const },
};

const EMPTY_FORM = {
  name: "",
  type: "other" as CampaignType,
  status: "perancangan" as CampaignStatus,
  progress: 0,
  owner_id: "",
  notes: "",
};

export default function CampaignsPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [year, setYear] = useState(getCurrentYear());
  const [month, setMonth] = useState(getCurrentMonth());
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle<Profile>();
      setProfile(prof ?? null);

      if (prof && isManager(prof.role)) {
        const { data: allProfiles } = await supabase
          .from("profiles")
          .select("*")
          .order("full_name");
        setProfiles((allProfiles as Profile[]) ?? []);
      }
    }

    const { data: rows } = await supabase
      .from("campaigns")
      .select("*")
      .eq("year", year)
      .eq("month", month)
      .order("created_at");
    setCampaigns((rows as Campaign[]) ?? []);
    setLoading(false);
  }, [year, month, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const canManage = !!profile && isManager(profile.role as Role);

  function startEdit(c: Campaign) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      type: c.type,
      status: c.status,
      progress: c.progress,
      owner_id: c.owner_id ?? "",
      notes: c.notes ?? "",
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const payload = {
      year,
      month,
      name: form.name,
      type: form.type,
      status: form.status,
      progress: form.progress,
      owner_id: form.owner_id || null,
      notes: form.notes,
    };

    const { error } = editingId
      ? await supabase.from("campaigns").update(payload).eq("id", editingId)
      : await supabase.from("campaigns").insert(payload);

    if (error) {
      setMessage("Gagal menyimpan kempen: " + error.message);
      return;
    }

    setMessage("Kempen berjaya disimpan.");
    resetForm();
    load();
  }

  async function handleDelete(id: number) {
    const { error } = await supabase.from("campaigns").delete().eq("id", id);
    if (error) {
      setMessage("Gagal memadam kempen: " + error.message);
      return;
    }
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Kempen</h2>
        <p className="text-sm text-muted">
          Senarai kempen pemasaran bulanan.
        </p>
      </div>

      <motion.div {...cardMotion} className="card flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Tahun</label>
          <input
            type="number"
            className="input"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="label">Bulan</label>
          <select
            className="input"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {monthName(m)}
              </option>
            ))}
          </select>
        </div>
      </motion.div>

      {canManage && (
        <motion.form
          {...cardMotion}
          onSubmit={handleSubmit}
          className="card grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          <h3 className="font-semibold text-white md:col-span-3">
            {editingId ? "Kemas kini Kempen" : "Tambah Kempen"}
          </h3>
          <div className="md:col-span-2">
            <label className="label">Nama Kempen</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Jenis</label>
            <select
              className="input"
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value as CampaignType })
              }
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select
              className="input"
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as CampaignStatus })
              }
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Progress (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              className="input"
              value={form.progress}
              onChange={(e) =>
                setForm({ ...form, progress: Number(e.target.value) })
              }
            />
          </div>
          <div>
            <label className="label">Pemilik</label>
            <select
              className="input"
              value={form.owner_id}
              onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
            >
              <option value="">- Tiada -</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="label">Catatan</label>
            <input
              className="input"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          {message && (
            <p className="md:col-span-3 text-sm text-brand-400">{message}</p>
          )}
          <div className="flex gap-2 md:col-span-3">
            <button type="submit" className="btn-primary">
              {editingId ? "Kemas kini" : "Tambah"}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn-secondary"
                onClick={resetForm}
              >
                Batal
              </button>
            )}
          </div>
        </motion.form>
      )}

      {loading ? (
        <p className="text-sm text-muted">Memuatkan...</p>
      ) : campaigns.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/15 p-6 text-center text-sm text-muted">
          Tiada kempen untuk bulan ini.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {campaigns.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.45,
                delay: i * 0.06,
                ease: [0.4, 0, 0.2, 1],
              }}
              className="card"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-white">{c.name}</p>
                  <p className="text-xs text-muted">
                    {c.type} · {c.status}
                  </p>
                </div>
                <span className="text-sm font-bold text-brand-400">
                  {c.progress}%
                </span>
              </div>
              {c.notes && (
                <p className="mt-2 text-sm text-gray-300">{c.notes}</p>
              )}
              {canManage && (
                <div className="mt-3 flex gap-3">
                  <button
                    className="text-xs font-medium text-brand-400 hover:underline"
                    onClick={() => startEdit(c)}
                  >
                    Edit
                  </button>
                  <button
                    className="text-xs font-medium text-red-400 hover:underline"
                    onClick={() => handleDelete(c.id)}
                  >
                    Padam
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
