import type { KpiStatusColor } from "@/types/database";

const BAR_COLORS: Record<KpiStatusColor, string> = {
  hijau: "bg-green-500",
  kuning: "bg-yellow-400",
  oren: "bg-orange-500",
  merah: "bg-red-500",
  kosong: "bg-gray-300",
};

export default function KpiProgressBar({
  pct,
  status,
}: {
  pct: number | null;
  status: KpiStatusColor;
}) {
  const width = pct === null ? 0 : Math.min(100, Math.max(0, pct));

  return (
    <div className="w-full">
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${BAR_COLORS[status]} transition-all`}
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="mt-0.5 text-xs text-gray-500">
        {pct === null ? "-" : `${pct.toFixed(0)}%`}
      </div>
    </div>
  );
}
