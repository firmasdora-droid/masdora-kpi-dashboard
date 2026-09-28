/**
 * Katalog menu dashboard.
 *
 * Satu tempat sahaja yang mentakrifkan setiap menu: sidebar membinanya
 * dari sini, dan Master Setting menyenaraikannya untuk manager memilih
 * siapa nampak apa. Menambah menu baharu = tambah satu baris di sini.
 */

export interface KonteksMenu {
  manager: boolean;
  ceo: boolean;
  /** Boleh key-in jualan (jawatan CS + videographer produk). */
  bolehJual: boolean;
  isCS: boolean;
  isContentTeam: boolean;
  isDesigner: boolean;
  isDigital: boolean;
  isCrmOwner: boolean;
}

export interface ItemMenu {
  key: string;
  href: string;
  label: string;
  icon: string;
  kumpulan: "kerja" | "urus";
  /** Sentiasa dipaparkan — tidak boleh dimatikan oleh Master Setting. */
  wajib?: boolean;
  /** Hanya Marketing Manager (tidak pernah muncul dalam matriks akses). */
  hanyaManager?: boolean;
  external?: boolean;
  /** Kebenaran asal, digunakan apabila manager belum menetapkan apa-apa. */
  asal: (c: KonteksMenu) => boolean;
}

export const MENU: ItemMenu[] = [
  {
    key: "dashboard",
    href: "/dashboard",
    label: "Dashboard Utama",
    icon: "📊",
    kumpulan: "kerja",
    wajib: true,
    asal: () => true,
  },
  {
    key: "todos",
    href: "/dashboard/todos",
    label: "To-Do List",
    icon: "📋",
    kumpulan: "kerja",
    asal: (c) => !c.isDigital,
  },
  {
    key: "profile",
    href: "/dashboard/profile",
    label: "Profil Saya",
    icon: "👤",
    kumpulan: "kerja",
    wajib: true,
    asal: () => true,
  },
  {
    key: "leaderboard",
    href: "/dashboard/leaderboard",
    label: "Leaderboard",
    icon: "🏆",
    kumpulan: "kerja",
    asal: () => true,
  },
  {
    key: "sales",
    href: "/dashboard/sales",
    label: "Key-in Jualan",
    icon: "💰",
    kumpulan: "kerja",
    asal: (c) => c.bolehJual || c.manager,
  },
  {
    key: "laporan-whatsapp",
    href: "/dashboard/laporan-whatsapp",
    label: "Laporan WhatsApp",
    icon: "📱",
    kumpulan: "kerja",
    asal: (c) => !c.isDigital,
  },
  {
    key: "content-planner",
    href: "/dashboard/content-planner",
    label: "Content Planner",
    icon: "🗓️",
    kumpulan: "kerja",
    asal: (c) => c.isContentTeam || c.isDigital || c.manager || c.ceo,
  },
  {
    key: "prestasi-konten",
    href: "/dashboard/prestasi-konten",
    label: "Prestasi Konten",
    icon: "🎬",
    kumpulan: "kerja",
    asal: (c) => c.isContentTeam || c.isDigital || c.manager || c.ceo,
  },
  {
    key: "tugasan-grafik",
    href: "/dashboard/tugasan-grafik",
    label: "Tugasan Grafik",
    icon: "🎨",
    kumpulan: "kerja",
    asal: (c) => c.isDesigner || c.manager || c.ceo,
  },
  {
    key: "isu-pelanggan",
    href: "/dashboard/isu-pelanggan",
    label: "Isu Pelanggan",
    icon: "🚨",
    kumpulan: "kerja",
    asal: (c) => c.isCS || c.manager || c.ceo,
  },
  {
    key: "laporan-chat",
    href: "/dashboard/laporan-chat",
    label: "Laporan Chat",
    icon: "💬",
    kumpulan: "kerja",
    asal: (c) => c.isCS || c.manager || c.ceo,
  },
  {
    key: "recovery",
    href: "/dashboard/recovery",
    label: "Recovery CRM",
    icon: "🔄",
    kumpulan: "kerja",
    asal: (c) => c.isCrmOwner || c.manager || c.ceo,
  },
  {
    key: "crm-luar",
    href: "https://masdora-crm-masdora.zocomputer.io/",
    label: "Buka Sistem CRM",
    icon: "🔗",
    kumpulan: "kerja",
    external: true,
    asal: (c) => c.isCrmOwner || c.manager || c.ceo,
  },
  {
    key: "campaigns",
    href: "/dashboard/campaigns",
    label: "Kempen & Pelancaran",
    icon: "🎉",
    kumpulan: "urus",
    asal: (c) => !c.isDigital,
  },
  {
    key: "laporan-mingguan",
    href: "/dashboard/laporan-mingguan",
    label: "Laporan & PDF",
    icon: "📄",
    kumpulan: "urus",
    asal: (c) => c.manager || c.ceo,
  },
  {
    key: "admin-master",
    href: "/dashboard/admin/master",
    label: "Master Setting",
    icon: "🔐",
    kumpulan: "urus",
    hanyaManager: true,
    asal: (c) => c.manager,
  },
  {
    key: "admin-users",
    href: "/dashboard/admin/users",
    label: "Pengurusan Pengguna",
    icon: "👥",
    kumpulan: "urus",
    hanyaManager: true,
    asal: (c) => c.manager,
  },
  {
    key: "admin",
    href: "/dashboard/admin",
    label: "Data & Tetapan",
    icon: "⚙️",
    kumpulan: "urus",
    hanyaManager: true,
    asal: (c) => c.manager,
  },
];

/** Menu yang boleh ditetapkan oleh manager dalam matriks akses. */
export const MENU_BOLEH_SET = MENU.filter((m) => !m.wajib && !m.hanyaManager);
