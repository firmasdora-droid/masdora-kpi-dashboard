"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isManager, canKeyInSale, type Role } from "@/lib/roles";
import AvatarInitials from "@/components/AvatarInitials";
import MasdoraLogomark from "@/components/MasdoraLogomark";
import MasdoraWordmark from "@/components/MasdoraWordmark";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  show: boolean;
  /** Buka dalam tab baru (untuk pautan ke sistem luar). */
  external?: boolean;
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
  handlerCode,
}: {
  role: Role;
  positionCode: string | null;
  fullName: string;
  positionName: string | null;
  handlerCode?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);

  const manager = isManager(role);

  // Pautan khas Maisarah. Dikenal pasti melalui kod handler ATAU nama,
  // supaya ia berfungsi walaupun handler_code belum diset dalam database.
  const isMaisarah =
    handlerCode === "MAI" || /maisarah/i.test(fullName ?? "");

  // Team Customer Service — mereka sahaja yang perlu Isu Pelanggan & Laporan Chat.
  const isCS = ["CS_AGENT", "CS_WEB", "CS_SHOPEE", "CS_TIKTOK"].includes(
    positionCode ?? ""
  );

  // Team konten/video/foto — mereka guna sheet posting log.
  const isContentTeam = ["CC", "VID_TT", "VID_PROD"].includes(
    positionCode ?? ""
  );

  // Graphic Designer — mereka guna sheet task list grafik.
  const isDesigner = ["GD_SOCIAL", "GD_CATALOG", "GD_SHOPEE", "GD"].includes(
    positionCode ?? ""
  );

  const groups: NavGroup[] = [
    {
      title: "Kerja Saya",
      items: [
        {
          href: "/dashboard",
          label: "Dashboard Utama",
          icon: "📊",
          show: true,
        },
        {
          href: "/dashboard/todos",
          label: "Weekly To-Do List Team",
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
        {
          href: "/dashboard/laporan-whatsapp",
          label: "Laporan WhatsApp",
          icon: "📱",
          show: true,
        },
        {
          href: "/dashboard/prestasi-konten",
          label: "Prestasi Konten",
          icon: "🎬",
          show: isContentTeam || manager || role === "ceo",
        },
        {
          href: "/dashboard/tugasan-grafik",
          label: "Tugasan Grafik",
          icon: "🎨",
          show: isDesigner || manager || role === "ceo",
        },
        {
          href: "/dashboard/isu-pelanggan",
          label: "Isu Pelanggan",
          icon: "🚨",
          show: isCS || manager || role === "ceo",
        },
        {
          href: "/dashboard/laporan-chat",
          label: "Laporan Chat",
          icon: "💬",
          show: isCS || manager || role === "ceo",
        },
        {
          href: "/dashboard/recovery",
          label: "Recovery CRM",
          icon: "🔄",
          show: isMaisarah || manager || role === "ceo",
        },
        {
          href: "https://masdora.zo.space/team/recovery-crm",
          label: "Buka Sistem CRM",
          icon: "🔗",
          show: isMaisarah,
          external: true,
        },
      ],
    },
    {
      title: "Urus",
      items: [
        {
          href: "/dashboard/laporan-mingguan",
          label: "Laporan Mingguan (PDF)",
          icon: "📄",
          show: manager || role === "ceo",
        },
        {
          href: "/dashboard/campaigns",
          label: "Kempen & Pelancaran",
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
      <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-5">
        <MasdoraLogomark size={32} color="#F26122" />
        <div>
          <MasdoraWordmark height={14} color="#F26122" />
          <p className="mt-1 text-[11px] leading-tight text-muted">
            Team Dashboard
          </p>
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
                  const active = !item.external && isActive(item.href);
                  const className = `relative flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                    active
                      ? "bg-gradient-to-r from-masdora-orange/20 to-transparent text-amber-200"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  }`;

                  const inner = (
                    <>
                      {active && (
                        <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-masdora-orange" />
                      )}
                      <span aria-hidden>{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                      {item.external && (
                        <span className="ml-auto text-[10px] text-slate-500" aria-hidden>
                          ↗
                        </span>
                      )}
                    </>
                  );

                  if (item.external) {
                    return (
                      <a
                        key={item.href}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setOpen(false)}
                        className={className}
                      >
                        {inner}
                      </a>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={className}
                    >
                      {inner}
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
          Masdora Team Dashboard v3.0.0
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-[rgba(17,25,33,0.95)] px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <MasdoraLogomark size={24} color="#F26122" />
          <MasdoraWordmark height={12} color="#F26122" />
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
