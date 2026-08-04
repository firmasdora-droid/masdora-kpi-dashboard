"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isManager, canKeyInSale, type Role } from "@/lib/roles";

interface NavItem {
  href: string;
  label: string;
  show: boolean;
}

export default function Sidebar({
  role,
  positionCode,
}: {
  role: Role;
  positionCode: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const items: NavItem[] = [
    { href: "/dashboard", label: "Ringkasan", show: true },
    { href: "/dashboard/kpi", label: "KPI Saya", show: true },
    { href: "/dashboard/todos", label: "To-Do Mingguan", show: true },
    { href: "/dashboard/leaderboard", label: "Leaderboard", show: true },
    {
      href: "/dashboard/sales",
      label: "Key-in Jualan",
      show: canKeyInSale(role, positionCode) || isManager(role),
    },
    { href: "/dashboard/campaigns", label: "Kempen", show: true },
    { href: "/dashboard/admin", label: "Admin", show: isManager(role) },
  ];

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-full w-60 flex-shrink-0 flex-col border-r border-brand-100 bg-white">
      <div className="border-b border-brand-100 px-5 py-5">
        <h1 className="text-lg font-bold text-brand-700">Masdora KPI</h1>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {items
          .filter((item) => item.show)
          .map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-brand-500 text-white"
                    : "text-gray-600 hover:bg-brand-50 hover:text-brand-700"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
      </nav>
      <div className="border-t border-brand-100 p-3">
        <button
          onClick={handleSignOut}
          className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-500 hover:bg-gray-50"
        >
          Log Keluar
        </button>
      </div>
    </aside>
  );
}
