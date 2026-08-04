import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminNavCard from "@/components/dashboard/AdminNavCard";
import type { Profile } from "@/types/database";

export default async function AdminHubPage() {
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Admin</h2>
        <p className="text-sm text-muted">
          Ruangan pengurusan pengguna & definisi KPI (khas untuk Manager).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <AdminNavCard
          index={0}
          href="/dashboard/admin/users"
          title="Urus Pengguna"
          description="Lihat senarai pengguna & jemput ahli baru."
        />
        <AdminNavCard
          index={1}
          href="/dashboard/admin/kpi-definitions"
          title="Definisi KPI"
          description="Urus sasaran, berat, dan lulus/tolak cadangan KPI."
        />
      </div>
    </div>
  );
}
