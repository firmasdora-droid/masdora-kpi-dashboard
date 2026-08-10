"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import type {
  Department,
  PendingInvite,
  Position,
  Profile,
  UserRole,
} from "@/types/database";

const ROLES: UserRole[] = ["member", "manager", "ceo"];

function randomCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function randomPassword(length = 10): string {
  const chars =
    "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

const cardMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const },
};

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  position_code: "",
  dept_code: "",
  role: "member" as UserRole,
};

export default function AdminUsersPage() {
  const supabase = createClient();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [generated, setGenerated] = useState<{
    email: string;
    code: string;
    temp_password: string;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ---- Reset kata laluan ----
  const [myId, setMyId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState<Profile | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState<{
    fullName: string;
    email: string;
    newPassword: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [
      { data: profileRows },
      { data: deptRows },
      { data: posRows },
      { data: inviteRows },
    ] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("departments").select("*").order("sort_order"),
      supabase.from("positions").select("*").order("name"),
      supabase
        .from("pending_invites")
        .select("*")
        .is("used_at", null)
        .order("created_at", { ascending: false }),
    ]);
    setProfiles((profileRows as Profile[]) ?? []);
    setDepartments((deptRows as Department[]) ?? []);
    setPositions((posRows as Position[]) ?? []);
    setInvites((inviteRows as PendingInvite[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMyId(data.user?.id ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleResetPassword(target: Profile) {
    setResetting(true);
    setResetError(null);
    setResetDone(null);
    setCopied(false);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: target.id }),
      });
      const json = await res.json();
      if (!json.ok) {
        setResetError(json.error ?? "Gagal reset kata laluan.");
      } else {
        setResetDone({
          fullName: json.fullName,
          email: json.email,
          newPassword: json.newPassword,
        });
      }
    } catch {
      setResetError("Gagal menghubungi pelayan. Cuba lagi.");
    }
    setResetting(false);
    setConfirmReset(null);
  }

  async function handleCreateInvite(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setGenerated(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const code = randomCode();
    const temp_password = randomPassword();

    const { error } = await supabase.from("pending_invites").insert({
      name: form.name,
      email: form.email,
      phone: form.phone,
      position_code: form.position_code || null,
      dept_code: form.dept_code || null,
      role: form.role,
      code,
      temp_password,
      created_by: user?.id ?? null,
    });

    if (error) {
      setMessage("Gagal mencipta jemputan: " + error.message);
      return;
    }

    setGenerated({ email: form.email, code, temp_password });
    setForm(EMPTY_FORM);
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Urus Pengguna</h2>
        <p className="text-sm text-muted">
          Jemput ahli baru & lihat senarai pengguna sedia ada.
        </p>
      </div>

      <motion.form
        {...cardMotion}
        onSubmit={handleCreateInvite}
        className="card grid grid-cols-1 gap-4 md:grid-cols-3"
      >
        <h3 className="font-semibold text-white md:col-span-3">
          Jemput Ahli Baru
        </h3>
        <div>
          <label className="label">Nama Penuh</label>
          <input
            className="input"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Emel</label>
          <input
            type="email"
            className="input"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Telefon</label>
          <input
            className="input"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Jabatan</label>
          <select
            className="input"
            value={form.dept_code}
            onChange={(e) => setForm({ ...form, dept_code: e.target.value })}
          >
            <option value="">- Pilih -</option>
            {departments.map((d) => (
              <option key={d.code} value={d.code}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Jawatan</label>
          <select
            className="input"
            value={form.position_code}
            onChange={(e) =>
              setForm({ ...form, position_code: e.target.value })
            }
          >
            <option value="">- Pilih -</option>
            {positions
              .filter((p) => !form.dept_code || p.dept_code === form.dept_code)
              .map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="label">Peranan</label>
          <select
            className="input"
            value={form.role}
            onChange={(e) =>
              setForm({ ...form, role: e.target.value as UserRole })
            }
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        {message && (
          <p className="md:col-span-3 text-sm text-red-400">{message}</p>
        )}
        <div className="md:col-span-3">
          <button type="submit" className="btn-primary">
            Cipta Jemputan
          </button>
        </div>
      </motion.form>

      {generated && (
        <motion.div
          {...cardMotion}
          className="card border-2 border-brand-400 bg-white/5"
        >
          <p className="text-sm font-semibold text-white">
            Jemputan berjaya dicipta untuk {generated.email}
          </p>
          <p className="mt-2 text-sm text-gray-200">
            Kod: <span className="font-mono font-bold">{generated.code}</span>
          </p>
          <p className="text-sm text-gray-200">
            Kata Laluan Sementara:{" "}
            <span className="font-mono font-bold">
              {generated.temp_password}
            </span>
          </p>
          <p className="mt-2 text-xs text-muted">
            Sila salin & kongsi maklumat ini secara manual kepada ahli
            berkenaan. Ia tidak akan dipaparkan lagi selepas ini. Ahli perlu
            gunakan emel ini semasa "Kali pertama log masuk" di halaman log
            masuk.
          </p>
        </motion.div>
      )}

      <div>
        <h3 className="mb-2 font-semibold text-white">
          Jemputan Belum Digunakan
        </h3>
        {invites.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/15 p-6 text-center text-sm text-muted">
            Tiada jemputan menunggu.
          </div>
        ) : (
          <motion.div {...cardMotion} className="card overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Emel</th>
                  <th>Peranan</th>
                  <th>Jawatan</th>
                  <th>Kod</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((i) => (
                  <tr key={i.id}>
                    <td>{i.name}</td>
                    <td>{i.email}</td>
                    <td>{i.role}</td>
                    <td>{i.position_code}</td>
                    <td className="font-mono">{i.code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </div>

      <div>
        <h3 className="mb-2 font-semibold text-white">
          Senarai Pengguna
        </h3>
        {loading ? (
          <p className="text-sm text-muted">Memuatkan...</p>
        ) : (
          <motion.div {...cardMotion} className="card overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Emel</th>
                  <th>Peranan</th>
                  <th>Jabatan</th>
                  <th>Jawatan</th>
                  <th>Aktif</th>
                  <th>Kata Laluan</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id}>
                    <td>{p.full_name}</td>
                    <td>{p.email}</td>
                    <td>{p.role}</td>
                    <td>{p.dept_code}</td>
                    <td>{p.position_code}</td>
                    <td>{p.active ? "Ya" : "Tidak"}</td>
                    <td>
                      {p.id === myId ? (
                        <span className="text-[11px] text-slate-500">
                          (akaun anda)
                        </span>
                      ) : p.role === "ceo" ? (
                        <span className="text-[11px] text-slate-500">
                          (dilindungi)
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmReset(p)}
                          className="rounded-lg border border-masdora-orange/40 px-2.5 py-1 text-[11px] font-bold text-amber-200 transition hover:bg-masdora-orange/15"
                        >
                          Reset
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </div>

      {/* ---------- Pengesahan sebelum reset ---------- */}
      {confirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setConfirmReset(null)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="relative z-10 w-full max-w-md rounded-2xl border border-masdora-alert/40 bg-navy-soft p-6"
          >
            <p className="text-lg font-bold text-white">
              Reset kata laluan {confirmReset.full_name}?
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Kata laluan lama dia akan <strong>terus berhenti berfungsi</strong>.
              Dia tidak akan boleh log masuk sampai anda beri kata laluan baru
              kepadanya.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Kata laluan baru hanya dipaparkan <strong>sekali</strong>. Salin dan
              hantar kepadanya sebelum tutup.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="btn-secondary"
                onClick={() => setConfirmReset(null)}
                disabled={resetting}
              >
                Batal
              </button>
              <button
                className="btn-primary"
                onClick={() => handleResetPassword(confirmReset)}
                disabled={resetting}
              >
                {resetting ? "Menukar..." : "Ya, Reset"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ---------- Kata laluan baru ---------- */}
      {resetDone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="relative z-10 w-full max-w-md rounded-2xl border border-masdora-olive/45 bg-navy-soft p-6"
          >
            <p className="text-lg font-bold text-emerald-200">
              Kata laluan {resetDone.fullName} sudah ditukar
            </p>

            <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Emel log masuk
                </p>
                <p className="font-mono text-sm text-slate-200">
                  {resetDone.email}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Kata laluan baru
                </p>
                <p className="select-all font-mono text-lg font-bold text-white">
                  {resetDone.newPassword}
                </p>
              </div>
            </div>

            <button
              className="btn-secondary mt-3 w-full"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(
                    `Emel: ${resetDone.email}\nKata laluan baru: ${resetDone.newPassword}`
                  )
                  .then(() => setCopied(true))
                  .catch(() => setCopied(false));
              }}
            >
              {copied ? "Sudah disalin" : "Salin emel & kata laluan"}
            </button>

            <p className="mt-4 text-xs text-amber-200">
              Hantar kepada {resetDone.fullName} sekarang. Selepas tutup, kata
              laluan ini tidak boleh dilihat lagi — anda perlu reset semula.
            </p>

            <div className="mt-4 flex justify-end">
              <button
                className="btn-primary"
                onClick={() => {
                  setResetDone(null);
                  setCopied(false);
                }}
              >
                Sudah saya hantar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {resetError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setResetError(null)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 w-full max-w-md rounded-2xl border border-masdora-alert/45 bg-navy-soft p-6"
          >
            <p className="font-bold text-red-200">Gagal reset kata laluan</p>
            <p className="mt-2 text-sm text-slate-300">{resetError}</p>
            <div className="mt-4 flex justify-end">
              <button
                className="btn-secondary"
                onClick={() => setResetError(null)}
              >
                Tutup
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
