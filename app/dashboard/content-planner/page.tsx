"use client";

/**
 * Content Planner — untuk Content Creator & Videographer.
 *
 * Setiap orang merancang konten sendiri: tajuk, tarikh siaran, masa siaran,
 * dan akaun (TikTok OS / TikTok MY / Instagram / Shopee HQ / Shopee OS).
 *
 * Semua staff boleh MELIHAT rancangan pasukan supaya tiada dua orang
 * tersilap siar pada slot yang sama, tetapi hanya pemilik (atau manager)
 * boleh mengubah rancangan itu.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { monthName } from "@/lib/period";
import AvatarInitials from "@/components/AvatarInitials";
import {
  CONTENT_ACCOUNTS,
  CONTENT_PLAN_STATUSES,
  type ContentPlan,
  type Profile,
} from "@/types/database";

const cardMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const },
};

/** Warna pil bagi setiap akaun, supaya mudah dibeza sekali pandang. */
const ACCOUNT_PILL: Record<string, string> = {
  "TIKTOK OS": "pill-oren",
  "TIKTOK MY": "pill-kuning",
  INSTAGRAM: "pill-merah",
  "SHOPEE HQ": "pill-hijau",
  "SHOPEE OS": "pill-kosong",
};

const STATUS_PILL: Record<string, string> = {
  dirancang: "pill-kosong",
  "sedang buat": "pill-kuning",
  sedia: "pill-oren",
  disiarkan: "pill-hijau",
  tangguh: "pill-merah",
};

const HARI = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "14:30:00" -> "2:30 ptg" */
function masaCantik(t: string | null): string {
  if (!t) return "Belum set";
  const [hRaw, m] = t.split(":");
  const h = Number(hRaw);
  const suffix = h < 12 ? "pg" : h < 15 ? "tgh" : h < 19 ? "ptg" : "mlm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${suffix}`;
}

function tarikhCantik(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return `${HARI[d.getDay()]}, ${d.getDate()} ${monthName(d.getMonth() + 1)}`;
}

const EMPTY = {
  title: "",
  post_date: todayIso(),
  post_time: "",
  account: CONTENT_ACCOUNTS[0] as string,
  status: "dirancang" as string,
  notes: "",
};

export default function ContentPlannerPage() {
  const supabase = createClient();

  const [me, setMe] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [plans, setPlans] = useState<ContentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const [draft, setDraft] = useState({ ...EMPTY });
  const [editing, setEditing] = useState<ContentPlan | null>(null);
  const [saving, setSaving] = useState(false);

  const [ym, setYm] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });

  const [ownerFilter, setOwnerFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");

  const isManagerRole = me?.role === "manager" || me?.role === "ceo";

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const lastDay = new Date(ym.year, ym.month, 0).getDate();
    const p = (n: number) => String(n).padStart(2, "0");
    const from = `${ym.year}-${p(ym.month)}-01`;
    const to = `${ym.year}-${p(ym.month)}-${p(lastDay)}`;

    const [{ data: prof }, { data: profileRows }, { data: planRows, error }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle<Profile>(),
        supabase
          .from("profiles")
          .select("*")
          .eq("active", true)
          .order("full_name"),
        supabase
          .from("content_plans")
          .select("*")
          .gte("post_date", from)
          .lte("post_date", to)
          .order("post_date")
          .order("post_time", { nullsFirst: false }),
      ]);

    setMe(prof ?? null);
    setProfiles((profileRows as Profile[]) ?? []);

    if (error) {
      setMessage(
        /content_plans|relation|does not exist/i.test(error.message)
          ? "Jadual content_plans belum ada dalam database. Sila run fail add-content-planner.sql dalam Supabase SQL Editor."
          : "Gagal memuatkan: " + error.message
      );
      setPlans([]);
    } else {
      setMessage(null);
      setPlans((planRows as ContentPlan[]) ?? []);
    }
    setLoading(false);
  }, [supabase, ym]);

  useEffect(() => {
    load();
  }, [load]);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((x) => m.set(x.id, x.full_name));
    return m;
  }, [profiles]);

  const filtered = useMemo(
    () =>
      plans.filter((x) => {
        if (ownerFilter && x.user_id !== ownerFilter) return false;
        if (accountFilter && x.account !== accountFilter) return false;
        return true;
      }),
    [plans, ownerFilter, accountFilter]
  );

  /** Kumpulkan mengikut tarikh supaya jadual mudah dibaca. */
  const byDate = useMemo(() => {
    const m = new Map<string, ContentPlan[]>();
    filtered.forEach((x) => {
      const arr = m.get(x.post_date) ?? [];
      arr.push(x);
      m.set(x.post_date, arr);
    });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const perAccount = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((x) => m.set(x.account, (m.get(x.account) ?? 0) + 1));
    return m;
  }, [filtered]);

  function bolehUbah(plan: ContentPlan): boolean {
    return isManagerRole || plan.user_id === me?.id;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!me || !draft.title.trim()) return;
    setSaving(true);
    setMessage(null);

    const payload = {
      title: draft.title.trim(),
      post_date: draft.post_date,
      post_time: draft.post_time ? draft.post_time : null,
      account: draft.account,
      status: draft.status,
      notes: draft.notes.trim() || null,
    };

    const { error } = editing
      ? await supabase
          .from("content_plans")
          .update(payload)
          .eq("id", editing.id)
      : await supabase
          .from("content_plans")
          .insert({ ...payload, user_id: me.id });

    setSaving(false);
    if (error) {
      setMessage("Gagal menyimpan: " + error.message);
      return;
    }
    // Kekalkan tarikh & akaun supaya mudah tambah beberapa konten berturutan.
    setDraft({ ...EMPTY, post_date: draft.post_date, account: draft.account });
    setEditing(null);
    load();
  }

  function mulaEdit(plan: ContentPlan) {
    setEditing(plan);
    setDraft({
      title: plan.title,
      post_date: plan.post_date,
      post_time: plan.post_time ? plan.post_time.slice(0, 5) : "",
      account: plan.account,
      status: plan.status,
      notes: plan.notes ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(plan: ContentPlan) {
    setMessage(null);
    const { error } = await supabase
      .from("content_plans")
      .delete()
      .eq("id", plan.id);
    if (error) {
      setMessage("Gagal memadam: " + error.message);
      return;
    }
    if (editing?.id === plan.id) {
      setEditing(null);
      setDraft({ ...EMPTY });
    }
    load();
  }

  function shiftMonth(delta: number) {
    setYm((v) => {
      let { year, month } = v;
      month += delta;
      if (month > 12) {
        month = 1;
        year += 1;
      }
      if (month < 1) {
        month = 12;
        year -= 1;
      }
      return { year, month };
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Content Planner</h2>
          <p className="text-sm text-muted">
            Rancang tajuk, tarikh, masa dan akaun siaran. Semua team boleh lihat
            supaya tiada slot bertindih.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary"
            onClick={() => shiftMonth(-1)}
            aria-label="Bulan sebelum"
          >
            ‹
          </button>
          <span className="min-w-[130px] text-center font-bold text-white">
            {monthName(ym.month)} {ym.year}
          </span>
          <button
            className="btn-secondary"
            onClick={() => shiftMonth(1)}
            aria-label="Bulan depan"
          >
            ›
          </button>
        </div>
      </div>

      {message && (
        <motion.div
          {...cardMotion}
          className="card border-masdora-alert/40 text-sm text-red-200"
        >
          {message}
        </motion.div>
      )}

      {/* ---------- Borang tambah / ubah ---------- */}
      <motion.form
        {...cardMotion}
        onSubmit={handleSave}
        className="card grid grid-cols-1 gap-4 md:grid-cols-6"
      >
        <div className="flex items-center justify-between md:col-span-6">
          <h3 className="font-semibold text-white">
            {editing ? "Ubah Rancangan" : "Tambah Rancangan Konten"}
          </h3>
          {editing && (
            <button
              type="button"
              className="text-xs font-bold text-slate-400 hover:text-white"
              onClick={() => {
                setEditing(null);
                setDraft({ ...EMPTY });
              }}
            >
              Batal ubah
            </button>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="label">Tajuk Konten</label>
          <input
            className="input"
            required
            placeholder="Contoh: Unboxing Gold Bar 1g"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Tarikh Post</label>
          <input
            type="date"
            className="input"
            required
            value={draft.post_date}
            onChange={(e) => setDraft({ ...draft, post_date: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Masa Post</label>
          <input
            type="time"
            className="input"
            value={draft.post_time}
            onChange={(e) => setDraft({ ...draft, post_time: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Akaun Post</label>
          <select
            className="input"
            value={draft.account}
            onChange={(e) => setDraft({ ...draft, account: e.target.value })}
          >
            {CONTENT_ACCOUNTS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select
            className="input"
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value })}
          >
            {CONTENT_PLAN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-5">
          <label className="label">Catatan (pilihan)</label>
          <input
            className="input"
            placeholder="Idea, props, lokasi..."
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </div>
        <div className="flex items-end">
          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving ? "Menyimpan..." : editing ? "Simpan" : "Tambah"}
          </button>
        </div>
      </motion.form>

      {/* ---------- Ringkasan per akaun (boleh klik untuk tapis) ---------- */}
      {plans.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {CONTENT_ACCOUNTS.map((a, i) => (
            <motion.button
              key={a}
              {...cardMotion}
              transition={{ ...cardMotion.transition, delay: i * 0.05 }}
              onClick={() => setAccountFilter(accountFilter === a ? "" : a)}
              className={`rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:bg-white/[0.08] ${
                accountFilter === a ? "ring-2 ring-masdora-orange/60" : ""
              }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {a}
              </p>
              <p className="mt-1 text-xl font-black text-white">
                {perAccount.get(a) ?? 0}
              </p>
            </motion.button>
          ))}
        </div>
      )}

      {/* ---------- Tapisan ---------- */}
      <motion.div {...cardMotion} className="card flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Pemilik</label>
          <select
            className="input"
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
          >
            <option value="">Semua Team</option>
            {me && <option value={me.id}>Rancangan Saya</option>}
            {profiles
              .filter((p) => p.id !== me?.id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="label">Akaun</label>
          <select
            className="input"
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
          >
            <option value="">Semua Akaun</option>
            {CONTENT_ACCOUNTS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-secondary" onClick={load} disabled={loading}>
          {loading ? "Memuatkan..." : "Muat Semula"}
        </button>
      </motion.div>

      {/* ---------- Senarai mengikut tarikh ---------- */}
      {loading ? (
        <p className="text-sm text-muted">Memuatkan...</p>
      ) : byDate.length === 0 ? (
        <motion.div
          {...cardMotion}
          className="card text-center text-sm text-muted"
        >
          Belum ada rancangan konten untuk {monthName(ym.month)} {ym.year}.
        </motion.div>
      ) : (
        <div className="space-y-4">
          {byDate.map(([date, items], di) => (
            <motion.div
              key={date}
              {...cardMotion}
              transition={{
                ...cardMotion.transition,
                delay: Math.min(di * 0.04, 0.3),
              }}
              className="card"
            >
              <div className="mb-3 flex items-baseline justify-between border-b border-white/10 pb-2">
                <p className="font-bold text-white">{tarikhCantik(date)}</p>
                <span className="text-[11px] text-slate-500">
                  {items.length} konten
                </span>
              </div>

              <div className="space-y-2">
                {items.map((plan) => (
                  <div
                    key={plan.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                  >
                    <span className="w-20 flex-shrink-0 text-xs font-bold text-masdora-orange">
                      {masaCantik(plan.post_time)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-100">
                        {plan.title}
                      </p>
                      {plan.notes && (
                        <p className="truncate text-[11px] text-slate-500">
                          {plan.notes}
                        </p>
                      )}
                    </div>

                    <span
                      className={`pill ${
                        ACCOUNT_PILL[plan.account] ?? "pill-kosong"
                      }`}
                    >
                      {plan.account}
                    </span>
                    <span
                      className={`pill ${
                        STATUS_PILL[plan.status] ?? "pill-kosong"
                      }`}
                    >
                      {plan.status}
                    </span>

                    <div className="flex flex-shrink-0 items-center gap-2">
                      <AvatarInitials
                        name={nameById.get(plan.user_id) ?? "?"}
                        size={24}
                      />
                      <span className="hidden text-[11px] text-slate-400 sm:inline">
                        {nameById.get(plan.user_id) ?? "-"}
                      </span>
                    </div>

                    {bolehUbah(plan) && (
                      <div className="flex flex-shrink-0 gap-1">
                        <button
                          onClick={() => mulaEdit(plan)}
                          className="rounded-lg border border-white/15 px-2 py-1 text-[11px] font-bold text-slate-300 hover:bg-white/10"
                        >
                          Ubah
                        </button>
                        <button
                          onClick={() => handleDelete(plan)}
                          className="rounded-lg border border-masdora-alert/40 px-2 py-1 text-[11px] font-bold text-red-300 hover:bg-masdora-alert/15"
                        >
                          Padam
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
