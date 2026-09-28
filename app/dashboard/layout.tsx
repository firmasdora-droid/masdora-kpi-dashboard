import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import { gabungTetapan } from "@/lib/tetapan";
import type { Profile, Position } from "@/types/database";

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

  // Tetapan dashboard (tajuk, pengumuman, matriks akses menu). Kalau
  // jadual app_settings belum wujud, nilai asal digunakan — dashboard
  // tetap berfungsi.
  const { data: tetapanRows } = await supabase
    .from("app_settings")
    .select("key, value");
  const tetapan = gabungTetapan(tetapanRows);

  let positionName: string | null = null;
  if (profile.position_code) {
    const { data: position } = await supabase
      .from("positions")
      .select("*")
      .eq("code", profile.position_code)
      .maybeSingle<Position>();
    positionName = position?.name ?? null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#111921] text-white lg:flex-row">
      <Sidebar
        role={profile.role}
        positionCode={profile.position_code}
        fullName={profile.full_name}
        positionName={positionName}
        handlerCode={profile.handler_code ?? null}
        akses={tetapan.akses}
        tajuk={tetapan.paparan.tajuk}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {tetapan.paparan.pengumuman.trim() !== "" && (
          <div className="border-b border-masdora-orange/30 bg-masdora-orange/10 px-4 py-2.5 text-sm text-amber-100 md:px-6">
            <span aria-hidden className="mr-2">
              📢
            </span>
            {tetapan.paparan.pengumuman}
          </div>
        )}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
