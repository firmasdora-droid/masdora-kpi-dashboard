"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isManager, canKeyInSale, type Role } from "@/lib/roles";
import AvatarInitials from "@/components/AvatarInitials";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  show: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const ROLE_LABELS: Record<string, string> = {
  ceo: "CEO",
  manager: "Manager",
  member: "Ahli",
};

export default function Sidebar({
  role,
  positionCode,
  fullName,
  positionName,
}: {
  role: Role;
  positionCode: string | null;
  fullName: string;
  positionName: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);

  const manager = isManager(role);

  const groups: NavGroup[] = [
    {
      title: "Kerja Saya",
      items: [
        { href: "/dashboard/kpi", label: "KPI Saya", icon: "🎯", show: true },
        {
          href: "/dashboard/todos",
          label: "To-Do Mingguan",
          icon: "📋",
          show: true,
        },
        {
          href: "/dashboard/profile",
          label: "Profil Saya",
          icon: "👤",
          show: true,
        },
        {
          href: "/dashboard/leaderboard",
          label: "Leaderboard",
          icon: "🏆",
          show: true,
        },
        {
          href: "/dashboard/sales",
          label: "Key-in Jualan",
          icon: "💰",
          show: canKeyInSale(role, positionCode) || manager,
        },
      ],
    },
    {
      title: "Pantau",
      items: [
        {
          href: "/dashboard",
          label: "Dashboard Utama",
          icon: "📊",
          show: manager || role === "ceo",
        },
        {
          href: "/dashboard/kpi-team",
          label: "KPI Team",
          icon: "👔",
          show: manager || role === "ceo",
        },
        {
          href: "/dashboard/admin/kpi-definitions",
          label: "KPI Setiap Jawatan",
          icon: "🗂️",
          show: manager || role === "ceo",
        },
        {
          href: "/dashboard/laporan",
          label: "Laporan",
          icon: "📑",
          show: manager || role === "ceo",
        },
      ],
    },
    {
      title: "Urus",
      items: [
        {
          href: "/dashboard/targets",
          label: "Tetapkan Sasaran",
          icon: "🎚️",
          show: manager,
        },
        {
          href: "/dashboard/campaigns",
          label: "Kempen Bulanan",
          icon: "🎉",
          show: true,
        },
        {
          href: "/dashboard/admin/users",
          label: "Pengurusan Pengguna",
          icon: "👥",
          show: manager,
        },
        {
          href: "/dashboard/admin",
          label: "Data & Tetapan",
          icon: "⚙️",
          show: manager,
        },
      ],
    },
  ];

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  const sidebarContent = (
    <div className="flex h-full w-64 flex-shrink-0 flex-col border-r border-white/10 bg-[rgba(17,25,33,0.95)] backdrop-blur-md lg:bg-[rgba(17,25,33,0.6)]">
      <div className="flex items-center gap-2 border-b border-white/10 px-5 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-bold text-[#111921] shadow-lg shadow-brand-500/30">
          M
        </span>
        <div>
          <p className="text-sm font-bold leading-tight text-white">Masdora</p>
          <p className="text-[11px] leading-tight text-muted">KPI Dashboard</p>
        </div>
      </div>

      <div className="border-b border-white/10 px-4 py-4">
        <div className="flex items-center gap-3">
          <AvatarInitials name={fullName} size={38} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {fullName}
            </p>
            <p className="truncate text-xs text-muted">
              {ROLE_LABELS[role] ?? role}
              {positionName ? ` · ${positionName}` : ""}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {groups.map((group) => {
          const visible = group.items.filter((i) => i.show);
          if (visible.length === 0) return null;
          return (
            <div key={group.title}>
              <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-muted">
                {group.title}
              </p>
              <div className="space-y-1">
                {visible.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`relative flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                        active
                          ? "bg-gradient-to-r from-masdora-orange/20 to-transparent text-amber-200"
                          : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      }`}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-masdora-orange" />
                      )}
                      <span aria-hidden>{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <button
          onClick={handleSignOut}
          className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-white"
        >
          🚪 Log Keluar
        </button>
        <p className="mt-2 px-3 text-[10px] text-muted">
          Masdora KPI Dashboard v2.0.0
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-[rgba(17,25,33,0.95)] px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-[#111921] shadow-lg shadow-brand-500/30">
            M
          </span>
          <span className="text-sm font-bold text-white">Masdora KPI</span>
        </div>
        <button
          aria-label="Buka menu"
          className="rounded-lg border border-white/10 p-2 text-white"
          onClick={() => setOpen(true)}
        >
          ☰
        </button>
      </div>

      {/* Desktop persistent sidebar */}
      <div className="hidden lg:flex">{sidebarContent}</div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10">{sidebarContent}</div>
          <button
            aria-label="Tutup menu"
            className="absolute right-3 top-3 z-20 rounded-lg border border-white/10 px-2 py-1 text-white"
            onClick={() => setOpen(false)}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
