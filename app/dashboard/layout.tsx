import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import type { Profile } from "@/types/database";

const ROLE_LABELS: Record<string, string> = {
  ceo: "CEO",
  manager: "Manager",
  member: "Ahli",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (!profile) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-[#f9f7f1]">
      <Sidebar role={profile.role} positionCode={profile.position_code} />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-brand-100 bg-white px-6 py-4">
          <div>
            <p className="text-sm text-gray-500">Selamat kembali,</p>
            <p className="text-lg font-semibold text-brand-800">
              {profile.full_name}
            </p>
          </div>
          <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
            {ROLE_LABELS[profile.role] ?? profile.role}
          </span>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
