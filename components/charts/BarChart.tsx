import type { ChartDatum } from "./types";

const MAX_SCALE = 130;
const GRIDLINES = [0, 35, 70, 130];

export default function BarChart({
  data,
  height = 220,
}: {
  data: ChartDatum[];
  height?: number;
}) {
  const width = 480;
  const paddingLeft = 32;
  const paddingBottom = 28;
  const paddingTop = 10;
  const chartH = height - paddingTop - paddingBottom;
  const chartW = width - paddingLeft - 10;
  const barSlot = chartW / Math.max(1, data.length);
  const barWidth = Math.min(48, barSlot * 0.55);

  const yFor = (val: number) =>
    paddingTop + chartH - (Math.min(val, MAX_SCALE) / MAX_SCALE) * chartH;

  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-[180px] items-center justify-center text-sm text-muted">
        Tiada data untuk dipaparkan.
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label="Prestasi mengikut jabatan"
    >
      {GRIDLINES.map((g) => (
        <g key={g}>
          <line
            x1={paddingLeft}
            x2={width - 10}
            y1={yFor(g)}
            y2={yFor(g)}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={1}
          />
          <text
            x={paddingLeft - 6}
            y={yFor(g) + 3}
            textAnchor="end"
            fontSize={9}
            fill="rgb(155,161,168)"
          >
            {g}
          </text>
        </g>
      ))}

      {data.map((d, i) => {
        const x = paddingLeft + i * barSlot + (barSlot - barWidth) / 2;
        const y = yFor(Math.max(0, d.value));
        const barH = paddingTop + chartH - y;
        return (
          <g key={d.code}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(0, barH)}
              rx={6}
              fill={d.color}
              opacity={0.9}
            />
            <text
              x={x + barWidth / 2}
              y={y - 6}
              textAnchor="middle"
              fontSize={10}
              fontWeight={600}
              fill="rgb(249,249,250)"
            >
              {Math.round(d.value)}%
            </text>
            <text
              x={x + barWidth / 2}
              y={height - paddingBottom + 14}
              textAnchor="middle"
              fontSize={10}
              fill="rgb(155,161,168)"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
