import type { KpiStatusColor } from "@/types/database";

const BAR_COLORS: Record<KpiStatusColor, string> = {
  hijau: "bg-[rgb(168,188,124)]",
  kuning: "bg-[rgb(224,197,120)]",
  oren: "bg-[rgb(248,162,117)]",
  merah: "bg-[rgb(232,140,140)]",
  kosong: "bg-white/20",
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
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${BAR_COLORS[status]} transition-all`}
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="mt-0.5 text-xs text-muted">
        {pct === null ? "-" : `${pct.toFixed(0)}%`}
      </div>
    </div>
  );
}
