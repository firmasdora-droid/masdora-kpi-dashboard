import type { KpiStatusColor } from "@/types/database";

const STYLES: Record<KpiStatusColor, string> = {
  hijau: "bg-green-100 text-green-800",
  kuning: "bg-yellow-100 text-yellow-800",
  oren: "bg-orange-100 text-orange-800",
  merah: "bg-red-100 text-red-800",
  kosong: "bg-gray-100 text-gray-500",
};

const LABELS: Record<KpiStatusColor, string> = {
  hijau: "Hijau",
  kuning: "Kuning",
  oren: "Oren",
  merah: "Merah",
  kosong: "Kosong",
};

export default function StatusBadge({ status }: { status: KpiStatusColor }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
