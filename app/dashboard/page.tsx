import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardUtama from "@/components/dashboard/DashboardUtama";
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

  if (profile.role !== "manager" && profile.role !== "ceo") {
    redirect("/dashboard/kpi");
  }

  return <DashboardUtama />;
}
