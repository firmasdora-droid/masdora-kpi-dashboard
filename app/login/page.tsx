"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import MasdoraLogomark from "@/components/MasdoraLogomark";
import MasdoraWordmark from "@/components/MasdoraWordmark";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isFirstTime, setIsFirstTime] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError("Log masuk gagal. Sila semak emel & kata laluan anda.");
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  async function handleFirstTimeSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      // 1. Cari invite yang belum digunakan bagi emel ini
      const { data: invite, error: inviteError } = await supabase
        .from("pending_invites")
        .select("*")
        .eq("email", email)
        .is("used_at", null)
        .maybeSingle();

      if (inviteError || !invite) {
        setError(
          "Tiada jemputan (invite) dijumpai untuk emel ini. Sila hubungi manager anda."
        );
        setLoading(false);
        return;
      }

      // 2. Daftar akaun auth baru
      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email,
          password,
        });

      if (signUpError || !signUpData.user) {
        setError(
          signUpError?.message?.includes("already registered")
            ? "Emel ini sudah berdaftar. Sila log masuk seperti biasa."
            : "Pendaftaran gagal. Sila cuba semula."
        );
        setLoading(false);
        return;
      }

      // 3. Masukkan profil berdasarkan data invite
      const { error: profileError } = await supabase.from("profiles").insert({
        id: signUpData.user.id,
        full_name: invite.name,
        email,
        role: invite.role,
        position_code: invite.position_code,
        dept_code: invite.dept_code,
      });

      if (profileError) {
        setError(
          "Akaun dicipta tetapi profil gagal disimpan: " + profileError.message
        );
        setLoading(false);
        return;
      }

      // 4. Tandakan invite sebagai telah digunakan
      await supabase
        .from("pending_invites")
        .update({ used_at: new Date().toISOString() })
        .eq("id", invite.id);

      setInfo(
        "Pendaftaran berjaya! Jika emel pengesahan diperlukan, sila semak inbox anda. Cuba log masuk sekarang."
      );
      setIsFirstTime(false);
      setLoading(false);
    } catch (err) {
      setError("Ralat tidak dijangka berlaku. Sila cuba semula.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#111921] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center">
            <MasdoraLogomark size={48} color="#F26122" />
          </div>
          <div className="mx-auto mb-2 flex justify-center">
            <MasdoraWordmark height={20} color="#F26122" />
          </div>
          <p className="mt-1 text-sm text-muted">
            Log masuk untuk teruskan ke dashboard anda
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
          className="card"
        >
          <form
            onSubmit={isFirstTime ? handleFirstTimeSignup : handleSignIn}
            className="space-y-4"
          >
            <div>
              <label className="label">Emel</label>
              <input
                type="email"
                required
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@masdora.com"
              />
            </div>
            <div>
              <label className="label">Kata laluan</label>
              <input
                type="password"
                required
                minLength={6}
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}
            {info && (
              <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">
                {info}
              </p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading
                ? "Sila tunggu..."
                : isFirstTime
                ? "Daftar & Log Masuk"
                : "Log Masuk"}
            </button>
          </form>

          <button
            type="button"
            className="mt-4 w-full text-center text-xs font-medium text-brand-400 underline"
            onClick={() => {
              setIsFirstTime((v) => !v);
              setError(null);
              setInfo(null);
            }}
          >
            {isFirstTime
              ? "Sudah ada akaun? Log masuk"
              : "Kali pertama log masuk (guna invite)"}
          </button>
        </motion.div>

        <p className="mt-6 text-center text-xs text-muted">
          Hubungi manager anda jika menghadapi masalah log masuk.
        </p>
      </div>
    </div>
  );
}
