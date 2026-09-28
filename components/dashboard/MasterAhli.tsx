"use client";

/**
 * Master Setting — bahagian AHLI, JABATAN/JAWATAN, dan PAPARAN & AKSES.
 *
 * Dipisahkan dari MasterSetting.tsx supaya setiap fail kekal boleh dibaca.
 * Semua komponen di sini hanya dipaparkan kepada Marketing Manager.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { MENU_BOLEH_SET } from "@/lib/menu";
import { TETAPAN_ASAL, gabungTetapan, type Tetapan } from "@/lib/tetapan";
import type {
  Department,
  Position,
  Profile,
  UserRole,
} from "@/types/database";

const cardMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const },
};

const ROLES: UserRole[] = ["member", "manager", "ceo"];

function kodRawak(panjang = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < panjang; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function kataLaluanRawak(panjang = 10): string {
  const chars =
    "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#";
  let out = "";
  for (let i = 0; i < panjang; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// ================================================================== 1) Ahli

interface BorangAhli {
  full_name: string;
  email: string;
  phone: string;
  position_code: string;
  dept_code: string;
  handler_code: string;
  role: UserRole;
  active: boolean;
}

export function TabAhli({
  lapor,
  setRalat,
}: {
  lapor: (t: string) => void;
  setRalat: (t: string | null) => void;
}) {
  const supabase = createClient();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [pilih, setPilih] = useState<string>("");
  const [borang, setBorang] = useState<BorangAhli | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [kataLaluanBaru, setKataLaluanBaru] = useState<{
    nama: string;
    kata: string;
  } | null>(null);

  // Jemputan ahli baharu
  const [jemput, setJemput] = useState({
    name: "",
    email: "",
    phone: "",
    dept_code: "",
    position_code: "",
    role: "member" as UserRole,
  });
  const [jemputan, setJemputan] = useState<{
    email: string;
    code: string;
    kata: string;
  } | null>(null);

  const muat = useCallback(async () => {
    const [{ data: prof }, { data: dept }, { data: pos }, auth] =
      await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("departments").select("*").order("sort_order"),
        supabase.from("positions").select("*").order("name"),
        supabase.auth.getUser(),
      ]);
    setProfiles((prof as Profile[]) ?? []);
    setDepartments((dept as Department[]) ?? []);
    setPositions((pos as Position[]) ?? []);
    setMyId(auth.data.user?.id ?? null);
  }, [supabase]);

  useEffect(() => {
    muat();
  }, [muat]);

  const dipilih = useMemo(
    () => profiles.find((p) => p.id === pilih) ?? null,
    [profiles, pilih]
  );

  useEffect(() => {
    if (!dipilih) {
      setBorang(null);
      return;
    }
    setBorang({
      full_name: dipilih.full_name,
      email: dipilih.email ?? "",
      phone: dipilih.phone ?? "",
      position_code: dipilih.position_code ?? "",
      dept_code: dipilih.dept_code ?? "",
      handler_code: dipilih.handler_code ?? "",
      role: dipilih.role,
      active: dipilih.active !== false,
    });
  }, [dipilih]);

  async function simpan() {
    if (!dipilih || !borang) return;
    if (!borang.full_name.trim()) {
      setRalat("Nama tidak boleh kosong.");
      return;
    }
    setSibuk(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: borang.full_name.trim(),
        phone: borang.phone.trim() || null,
        position_code: borang.position_code || null,
        dept_code: borang.dept_code || null,
        handler_code: borang.handler_code.trim() || null,
        role: borang.role,
        active: borang.active,
      })
      .eq("id", dipilih.id);
    setSibuk(false);
    if (error) {
      setRalat("Gagal menyimpan: " + error.message);
      return;
    }
    lapor(`Maklumat ${borang.full_name.trim()} dikemas kini.`);
    muat();
  }

  async function resetKataLaluan() {
    if (!dipilih) return;
    if (
      !window.confirm(
        `Reset kata laluan ${dipilih.full_name}? Kata laluan lama akan terus berhenti berfungsi.`
      )
    )
      return;
    setSibuk(true);
    setKataLaluanBaru(null);
    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: dipilih.id }),
      });
      const json = await res.json();
      if (!json.ok) {
        setRalat(json.error ?? "Gagal reset kata laluan.");
      } else {
        setKataLaluanBaru({
          nama: dipilih.full_name,
          kata: json.password ?? json.newPassword ?? "",
        });
        lapor("Kata laluan baharu dijana.");
      }
    } catch {
      setRalat("Gagal menghubungi pelayan.");
    }
    setSibuk(false);
  }

  async function hantarJemputan() {
    if (!jemput.name.trim() || !jemput.email.trim()) {
      setRalat("Isi nama dan emel.");
      return;
    }
    setSibuk(true);
    const code = kodRawak();
    const temp_password = kataLaluanRawak();
    const { error } = await supabase.from("pending_invites").insert({
      name: jemput.name.trim(),
      email: jemput.email.trim(),
      phone: jemput.phone.trim() || null,
      position_code: jemput.position_code || null,
      dept_code: jemput.dept_code || null,
      role: jemput.role,
      code,
      temp_password,
      created_by: myId,
    });
    setSibuk(false);
    if (error) {
      setRalat("Gagal mencipta jemputan: " + error.message);
      return;
    }
    setJemputan({ email: jemput.email.trim(), code, kata: temp_password });
    setJemput({
      name: "",
      email: "",
      phone: "",
      dept_code: "",
      position_code: "",
      role: "member",
    });
    lapor("Jemputan dicipta.");
  }

  const ubah = (patch: Partial<BorangAhli>) =>
    setBorang((b) => (b ? { ...b, ...patch } : b));

  return (
    <motion.div {...cardMotion} className="space-y-4">
      <div className="card">
        <label className="label">Pilih ahli</label>
        <select
          className="input max-w-md"
          value={pilih}
          onChange={(e) => setPilih(e.target.value)}
        >
          <option value="">- Pilih -</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name}
              {p.active === false ? " (tidak aktif)" : ""}
            </option>
          ))}
        </select>
      </div>

      {borang && dipilih && (
        <div className="card space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="label">Nama penuh</label>
              <input
                className="input"
                value={borang.full_name}
                onChange={(e) => ubah({ full_name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Emel (tidak boleh diubah)</label>
              <input className="input" value={borang.email} disabled />
            </div>
            <div>
              <label className="label">Telefon</label>
              <input
                className="input"
                value={borang.phone}
                onChange={(e) => ubah({ phone: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Jabatan</label>
              <select
                className="input"
                value={borang.dept_code}
                onChange={(e) => ubah({ dept_code: e.target.value })}
              >
                <option value="">- Tiada -</option>
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
                value={borang.position_code}
                onChange={(e) => ubah({ position_code: e.target.value })}
              >
                <option value="">- Tiada -</option>
                {positions
                  .filter(
                    (p) => !borang.dept_code || p.dept_code === borang.dept_code
                  )
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
                value={borang.role}
                onChange={(e) => ubah({ role: e.target.value as UserRole })}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Kod handler (laporan chat)</label>
              <input
                className="input"
                value={borang.handler_code}
                onChange={(e) => ubah({ handler_code: e.target.value })}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={borang.active}
              onChange={(e) => ubah({ active: e.target.checked })}
            />
            Aktif — ahli tidak aktif tidak muncul dalam laporan &amp;
            leaderboard
          </label>

          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" disabled={sibuk} onClick={simpan}>
              Simpan maklumat
            </button>
            <button
              className="btn-secondary"
              disabled={sibuk || dipilih.id === myId}
              onClick={resetKataLaluan}
            >
              Reset kata laluan
            </button>
          </div>
          {dipilih.id === myId && (
            <p className="text-xs text-muted">
              Untuk menukar kata laluan sendiri, guna halaman Profil Saya.
            </p>
          )}

          {kataLaluanBaru && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm">
              <p className="text-amber-100">
                Kata laluan baharu untuk {kataLaluanBaru.nama}:
              </p>
              <p className="mt-1 font-mono text-base text-white">
                {kataLaluanBaru.kata}
              </p>
              <p className="mt-1 text-xs text-amber-200/80">
                Salin sekarang — ia tidak akan dipaparkan semula. Hantar
                melalui WhatsApp peribadi, bukan group.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="card space-y-3">
        <h3 className="text-sm font-bold text-white">Tambah ahli baharu</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="label">Nama</label>
            <input
              className="input"
              value={jemput.name}
              onChange={(e) => setJemput({ ...jemput, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Emel</label>
            <input
              className="input"
              type="email"
              value={jemput.email}
              onChange={(e) => setJemput({ ...jemput, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Telefon</label>
            <input
              className="input"
              value={jemput.phone}
              onChange={(e) => setJemput({ ...jemput, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Jabatan</label>
            <select
              className="input"
              value={jemput.dept_code}
              onChange={(e) =>
                setJemput({ ...jemput, dept_code: e.target.value })
              }
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
              value={jemput.position_code}
              onChange={(e) =>
                setJemput({ ...jemput, position_code: e.target.value })
              }
            >
              <option value="">- Pilih -</option>
              {positions
                .filter(
                  (p) => !jemput.dept_code || p.dept_code === jemput.dept_code
                )
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
              value={jemput.role}
              onChange={(e) =>
                setJemput({ ...jemput, role: e.target.value as UserRole })
              }
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          className="btn-primary"
          disabled={sibuk}
          onClick={hantarJemputan}
        >
          Cipta jemputan
        </button>

        {jemputan && (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm">
            <p className="text-emerald-100">
              Jemputan untuk {jemputan.email} siap. Beri maklumat ini kepada
              mereka:
            </p>
            <p className="mt-1 font-mono text-white">Kod: {jemputan.code}</p>
            <p className="font-mono text-white">
              Kata laluan sementara: {jemputan.kata}
            </p>
            <p className="mt-1 text-xs text-emerald-200/80">
              Hantar melalui WhatsApp peribadi, bukan group.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ==================================================== 2) Jabatan & Jawatan

export function TabStruktur({
  lapor,
  setRalat,
}: {
  lapor: (t: string) => void;
  setRalat: (t: string | null) => void;
}) {
  const supabase = createClient();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [sibuk, setSibuk] = useState(false);
  const [deptBaru, setDeptBaru] = useState({
    code: "",
    name: "",
    short_name: "",
    color: "#F26122",
  });
  const [posBaru, setPosBaru] = useState({
    code: "",
    name: "",
    dept_code: "",
  });

  const muat = useCallback(async () => {
    const [{ data: d }, { data: p }] = await Promise.all([
      supabase.from("departments").select("*").order("sort_order"),
      supabase.from("positions").select("*").order("name"),
    ]);
    setDepartments((d as Department[]) ?? []);
    setPositions((p as Position[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    muat();
  }, [muat]);

  async function tambahDept() {
    if (!deptBaru.code.trim() || !deptBaru.name.trim()) {
      setRalat("Isi kod dan nama jabatan.");
      return;
    }
    setSibuk(true);
    const { error } = await supabase.from("departments").insert({
      code: deptBaru.code.trim().toUpperCase(),
      name: deptBaru.name.trim(),
      short_name: deptBaru.short_name.trim() || deptBaru.name.trim(),
      color: deptBaru.color,
      sort_order: departments.length * 10 + 10,
    });
    setSibuk(false);
    if (error) {
      setRalat("Gagal menambah jabatan: " + error.message);
      return;
    }
    lapor(`Jabatan ${deptBaru.name.trim()} ditambah.`);
    setDeptBaru({ code: "", name: "", short_name: "", color: "#F26122" });
    muat();
  }

  async function tambahPos() {
    if (!posBaru.code.trim() || !posBaru.name.trim()) {
      setRalat("Isi kod dan nama jawatan.");
      return;
    }
    setSibuk(true);
    const { error } = await supabase.from("positions").insert({
      code: posBaru.code.trim().toUpperCase(),
      name: posBaru.name.trim(),
      dept_code: posBaru.dept_code || null,
    });
    setSibuk(false);
    if (error) {
      setRalat("Gagal menambah jawatan: " + error.message);
      return;
    }
    lapor(`Jawatan ${posBaru.name.trim()} ditambah.`);
    setPosBaru({ code: "", name: "", dept_code: "" });
    muat();
  }

  async function namakanSemula(kod: string, nama: string) {
    const { error } = await supabase
      .from("positions")
      .update({ name: nama })
      .eq("code", kod);
    if (error) setRalat("Gagal: " + error.message);
    else lapor("Nama jawatan dikemas kini.");
  }

  return (
    <motion.div {...cardMotion} className="space-y-4">
      <div className="card space-y-3">
        <h3 className="text-sm font-bold text-white">Jabatan</h3>
        <div className="space-y-2">
          {departments.map((d) => (
            <div key={d.code} className="flex items-center gap-3 text-sm">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: d.color }}
                aria-hidden
              />
              <span className="font-semibold text-white">{d.name}</span>
              <span className="text-xs text-muted">{d.code}</span>
            </div>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="label">Kod</label>
            <input
              className="input"
              placeholder="DIGITAL"
              value={deptBaru.code}
              onChange={(e) =>
                setDeptBaru({ ...deptBaru, code: e.target.value })
              }
            />
          </div>
          <div>
            <label className="label">Nama</label>
            <input
              className="input"
              value={deptBaru.name}
              onChange={(e) =>
                setDeptBaru({ ...deptBaru, name: e.target.value })
              }
            />
          </div>
          <div>
            <label className="label">Nama pendek</label>
            <input
              className="input"
              value={deptBaru.short_name}
              onChange={(e) =>
                setDeptBaru({ ...deptBaru, short_name: e.target.value })
              }
            />
          </div>
          <div>
            <label className="label">Warna</label>
            <input
              className="input"
              value={deptBaru.color}
              onChange={(e) =>
                setDeptBaru({ ...deptBaru, color: e.target.value })
              }
            />
          </div>
        </div>
        <button className="btn-primary" disabled={sibuk} onClick={tambahDept}>
          Tambah jabatan
        </button>
      </div>

      <div className="card space-y-3">
        <h3 className="text-sm font-bold text-white">Jawatan</h3>
        <div className="space-y-2">
          {positions.map((p) => (
            <div key={p.code} className="flex flex-wrap items-center gap-3">
              <input
                className="input w-64"
                defaultValue={p.name}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== p.name)
                    namakanSemula(p.code, e.target.value.trim());
                }}
              />
              <span className="text-xs text-muted">
                {p.code} · {p.dept_code ?? "-"}
              </span>
            </div>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="label">Kod</label>
            <input
              className="input"
              placeholder="DM"
              value={posBaru.code}
              onChange={(e) => setPosBaru({ ...posBaru, code: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Nama</label>
            <input
              className="input"
              value={posBaru.name}
              onChange={(e) => setPosBaru({ ...posBaru, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Jabatan</label>
            <select
              className="input"
              value={posBaru.dept_code}
              onChange={(e) =>
                setPosBaru({ ...posBaru, dept_code: e.target.value })
              }
            >
              <option value="">- Pilih -</option>
              {departments.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button className="btn-primary" disabled={sibuk} onClick={tambahPos}>
          Tambah jawatan
        </button>
        <p className="text-xs text-muted">
          Jawatan tidak boleh dipadam kerana ahli sedia ada mungkin masih
          menggunakannya. Tukar ahli ke jawatan lain kalau sudah tidak
          diperlukan.
        </p>
      </div>
    </motion.div>
  );
}

// ==================================================== 3) Paparan & Akses

export function TabPaparan({
  lapor,
  setRalat,
}: {
  lapor: (t: string) => void;
  setRalat: (t: string | null) => void;
}) {
  const supabase = createClient();
  const [positions, setPositions] = useState<Position[]>([]);
  const [tetapan, setTetapan] = useState<Tetapan>(TETAPAN_ASAL);
  const [belumAda, setBelumAda] = useState(false);
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async () => {
    const [{ data: pos }, { data: rows, error }] = await Promise.all([
      supabase.from("positions").select("*").order("name"),
      supabase.from("app_settings").select("key, value"),
    ]);
    setPositions((pos as Position[]) ?? []);
    if (error) {
      setBelumAda(true);
      return;
    }
    setBelumAda(false);
    setTetapan(gabungTetapan(rows as { key: string; value: unknown }[]));
  }, [supabase]);

  useEffect(() => {
    muat();
  }, [muat]);

  async function simpan(kunci: "paparan" | "masa" | "akses", nilai: unknown) {
    setSibuk(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        { key: kunci, value: nilai, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
    setSibuk(false);
    if (error) {
      setRalat("Gagal menyimpan: " + error.message);
      return;
    }
    lapor("Tetapan disimpan. Muat semula halaman untuk melihat kesannya.");
    muat();
  }

  function togolMenu(kod: string, kunciMenu: string) {
    setTetapan((t) => {
      const semasa = t.akses[kod];
      // Belum ditetapkan: mula dengan senarai penuh supaya manager
      // "mematikan" menu, bukan terpaksa memilih semula semuanya.
      const asas = semasa ?? MENU_BOLEH_SET.map((m) => m.key);
      const baru = asas.includes(kunciMenu)
        ? asas.filter((k) => k !== kunciMenu)
        : [...asas, kunciMenu];
      return { ...t, akses: { ...t.akses, [kod]: baru } };
    });
  }

  /** Mula menetapkan jawatan ini secara manual, bermula dengan semua menu. */
  function tetapkanSendiri(kod: string) {
    setTetapan((t) => ({
      ...t,
      akses: { ...t.akses, [kod]: MENU_BOLEH_SET.map((m) => m.key) },
    }));
  }

  function gunaAsal(kod: string) {
    setTetapan((t) => {
      const akses = { ...t.akses };
      delete akses[kod];
      return { ...t, akses };
    });
  }

  if (belumAda) {
    return (
      <p className="card text-sm text-amber-200">
        Jadual tetapan belum wujud. Sila run fail{" "}
        <strong>tetapan-app.sql</strong> di Supabase SQL Editor, kemudian muat
        semula halaman ini.
      </p>
    );
  }

  return (
    <motion.div {...cardMotion} className="space-y-4">
      <div className="card space-y-3">
        <h3 className="text-sm font-bold text-white">Paparan</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">Tajuk kecil dalam sidebar</label>
            <input
              className="input"
              value={tetapan.paparan.tajuk}
              onChange={(e) =>
                setTetapan({
                  ...tetapan,
                  paparan: { ...tetapan.paparan, tajuk: e.target.value },
                })
              }
            />
          </div>
          <div>
            <label className="label">
              Pengumuman kepada team (kosong = tiada)
            </label>
            <input
              className="input"
              placeholder="Contoh: Semua to-do perlu dihantar sebelum 5 petang."
              value={tetapan.paparan.pengumuman}
              onChange={(e) =>
                setTetapan({
                  ...tetapan,
                  paparan: { ...tetapan.paparan, pengumuman: e.target.value },
                })
              }
            />
          </div>
        </div>
        <button
          className="btn-primary"
          disabled={sibuk}
          onClick={() => simpan("paparan", tetapan.paparan)}
        >
          Simpan paparan
        </button>
      </div>

      <div className="card space-y-3">
        <h3 className="text-sm font-bold text-white">Masa &amp; hari kerja</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="label">Jam akhir hantar To-Do (0-23)</label>
            <input
              className="input"
              inputMode="numeric"
              value={tetapan.masa.jam_akhir_hantar}
              onChange={(e) =>
                setTetapan({
                  ...tetapan,
                  masa: {
                    ...tetapan.masa,
                    jam_akhir_hantar: Number(e.target.value) || 0,
                  },
                })
              }
            />
          </div>
          <div>
            <label className="label">Hari kerja seminggu</label>
            <input
              className="input"
              inputMode="numeric"
              value={tetapan.masa.hari_kerja_seminggu}
              onChange={(e) =>
                setTetapan({
                  ...tetapan,
                  masa: {
                    ...tetapan.masa,
                    hari_kerja_seminggu: Number(e.target.value) || 1,
                  },
                })
              }
            />
          </div>
          <div>
            <label className="label">Hari kerja sebulan</label>
            <input
              className="input"
              inputMode="numeric"
              value={tetapan.masa.hari_kerja_sebulan}
              onChange={(e) =>
                setTetapan({
                  ...tetapan,
                  masa: {
                    ...tetapan.masa,
                    hari_kerja_sebulan: Number(e.target.value) || 1,
                  },
                })
              }
            />
          </div>
        </div>
        <p className="text-xs text-muted">
          Nombor ini yang menukar sasaran harian kepada sasaran mingguan dan
          bulanan. Contoh: 15/hari × 26 hari = 390 sebulan.
        </p>
        <button
          className="btn-primary"
          disabled={sibuk}
          onClick={() => simpan("masa", tetapan.masa)}
        >
          Simpan masa
        </button>
      </div>

      <div className="card space-y-3">
        <h3 className="text-sm font-bold text-white">
          Akses menu mengikut jawatan
        </h3>
        <p className="text-xs text-muted">
          Tanda menu yang jawatan itu boleh lihat. Jawatan yang belum
          ditetapkan menggunakan kebenaran asal sistem. Dashboard Utama,
          Profil Saya dan menu pengurusan tidak boleh dimatikan.
        </p>
        <div className="space-y-4">
          {positions.map((p) => {
            const senarai = tetapan.akses[p.code];
            return (
              <div
                key={p.code}
                className="rounded-xl border border-white/10 p-3"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-white">
                    {p.name}
                  </span>
                  <span className="text-xs text-muted">{p.code}</span>
                  {senarai ? (
                    <span className="pill pill-oren">Ditetapkan</span>
                  ) : (
                    <span className="pill pill-kosong">Asal sistem</span>
                  )}
                  <button
                    className="ml-auto text-xs text-slate-400 underline"
                    onClick={() =>
                      senarai ? gunaAsal(p.code) : tetapkanSendiri(p.code)
                    }
                  >
                    {senarai ? "Kembali ke asal" : "Tetapkan sendiri"}
                  </button>
                </div>
                {senarai ? (
                  <div className="flex flex-wrap gap-3">
                    {MENU_BOLEH_SET.map((m) => (
                      <label
                        key={m.key}
                        className="flex items-center gap-1.5 text-xs text-slate-300"
                      >
                        <input
                          type="checkbox"
                          checked={senarai.includes(m.key)}
                          onChange={() => togolMenu(p.code, m.key)}
                        />
                        {m.icon} {m.label}
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted">
                    Menggunakan kebenaran asal sistem untuk jawatan ini. Tekan
                    &ldquo;Tetapkan sendiri&rdquo; untuk memilih menu secara
                    manual.
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <button
          className="btn-primary"
          disabled={sibuk}
          onClick={() => simpan("akses", tetapan.akses)}
        >
          Simpan akses menu
        </button>
      </div>
    </motion.div>
  );
}
