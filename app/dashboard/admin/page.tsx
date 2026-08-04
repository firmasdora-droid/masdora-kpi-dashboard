import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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
        <h2 className="text-xl font-bold text-brand-800">Admin</h2>
        <p className="text-sm text-gray-500">
          Ruangan pengurusan pengguna & definisi KPI (khas untuk Manager).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link href="/dashboard/admin/users" className="card block hover:bg-brand-50">
          <h3 className="font-semibold text-brand-800">Urus Pengguna</h3>
          <p className="mt-1 text-sm text-gray-500">
            Lihat senarai pengguna & jemput ahli baru.
          </p>
        </Link>
        <Link
          href="/dashboard/admin/kpi-definitions"
          className="card block hover:bg-brand-50"
        >
          <h3 className="font-semibold text-brand-800">Definisi KPI</h3>
          <p className="mt-1 text-sm text-gray-500">
            Urus sasaran, berat, dan lulus/tolak cadangan KPI.
          </p>
        </Link>
      </div>
    </div>
  );
}
