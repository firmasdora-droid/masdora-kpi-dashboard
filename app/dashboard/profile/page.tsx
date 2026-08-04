"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AvatarInitials from "@/components/AvatarInitials";
import type { Department, Position, Profile } from "@/types/database";

const ROLE_LABELS: Record<string, string> = {
  ceo: "CEO",
  manager: "Manager",
  member: "Ahli",
};

export default function ProfilePage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    bio: "",
    photo_url: "",
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
    if (prof) {
      setForm({
        full_name: prof.full_name,
        phone: prof.phone ?? "",
        bio: prof.bio ?? "",
        photo_url: prof.photo_url ?? "",
      });
      if (prof.dept_code) {
        const { data: dept } = await supabase
          .from("departments")
          .select("*")
          .eq("code", prof.dept_code)
          .maybeSingle<Department>();
        setDepartment(dept ?? null);
      }
      if (prof.position_code) {
        const { data: pos } = await supabase
          .from("positions")
          .select("*")
          .eq("code", prof.position_code)
          .maybeSingle<Position>();
        setPosition(pos ?? null);
      }
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setMessage(null);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name,
        phone: form.phone,
        bio: form.bio,
        photo_url: form.photo_url || null,
      })
      .eq("id", profile.id);

    setSaving(false);

    if (error) {
      setMessage("Gagal mengemas kini profil: " + error.message);
      return;
    }
    setMessage("Profil berjaya dikemas kini.");
    load();
  }

  if (loading) {
    return <p className="text-sm text-muted">Memuatkan...</p>;
  }

  if (!profile) {
    return <p className="text-sm text-muted">Profil tidak dijumpai.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Profil Saya</h2>
        <p className="text-sm text-muted">
          Lihat & kemas kini maklumat peribadi anda.
        </p>
      </div>

      <div className="card flex items-center gap-4">
        {form.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={form.photo_url}
            alt={profile.full_name}
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <AvatarInitials name={profile.full_name} deptColor={department?.color} size={64} />
        )}
        <div>
          <p className="text-lg font-semibold text-white">{profile.full_name}</p>
          <p className="text-sm text-muted">
            {ROLE_LABELS[profile.role] ?? profile.role}
            {position ? ` · ${position.name}` : ""}
            {department ? ` · ${department.name}` : ""}
          </p>
          <p className="text-xs text-muted">{profile.email}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="card grid grid-cols-1 gap-4 md:grid-cols-2">
        <h3 className="font-semibold text-white md:col-span-2">
          Kemas Kini Maklumat
        </h3>
        <div>
          <label className="label">Nama Penuh</label>
          <input
            className="input"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label">Telefon</label>
          <input
            className="input"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="01X-XXXXXXX"
          />
        </div>
        <div className="md:col-span-2">
          <label className="label">URL Gambar Profil</label>
          <input
            className="input"
            value={form.photo_url}
            onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
            placeholder="https://..."
          />
        </div>
        <div className="md:col-span-2">
          <label className="label">Bio</label>
          <textarea
            className="input"
            rows={3}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder="Sedikit tentang anda..."
          />
        </div>
        {message && (
          <p className="text-sm text-brand-400 md:col-span-2">{message}</p>
        )}
        <div className="md:col-span-2">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </form>
    </div>
  );
}
