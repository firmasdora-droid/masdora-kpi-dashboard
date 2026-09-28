import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import MasterSetting from "@/components/dashboard/MasterSetting";
import type { Profile } from "@/types/database";

/**
 * Master Setting — hanya Marketing Manager.
 *
 * Kawalan dibuat di DUA tempat, bukan satu:
 *   1) di sini (halaman ini terus mengalihkan bukan-manager), dan
 *   2) di database melalui RLS (my_role() = 'manager').
 * Jadi walaupun seseorang cuba memanggil database terus, tetapan tetap
 * tidak boleh diubah oleh ahli biasa.
 */
export default async function MasterSettingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (!profile || profile.role !== "manager") {
    redirect("/dashboard");
  }

  return <MasterSetting />;
}
