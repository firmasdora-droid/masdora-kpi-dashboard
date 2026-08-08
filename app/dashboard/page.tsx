import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardUtama from "@/components/dashboard/DashboardUtama";
import MemberDashboard from "@/components/dashboard/MemberDashboard";
import type { Profile } from "@/types/database";

export default async function OverviewPage() {
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

  if (!profile) redirect("/login");

  // Manager/CEO nampak pantauan seluruh pasukan.
  // Ahli biasa nampak ringkasan kerja mereka sendiri + leaderboard.
  if (profile.role !== "manager" && profile.role !== "ceo") {
    return <MemberDashboard userId={profile.id} fullName={profile.full_name} />;
  }

  return <DashboardUtama />;
}
