import type { SeriesDatum } from "./types";

export default function LineChart({
  series,
  xLabels = ["M1", "M2", "M3", "M4"],
  height = 220,
}: {
  series: SeriesDatum[];
  xLabels?: string[];
  height?: number;
}) {
  const width = 480;
  const paddingLeft = 30;
  const paddingRight = 12;
  const paddingTop = 14;
  const paddingBottom = 24;
  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;
  const maxVal = 130;
  const gridlines = [0, 35, 70, 130];

  const xFor = (i: number) =>
    paddingLeft + (chartW / Math.max(1, xLabels.length - 1)) * i;
  const yFor = (val: number) =>
    paddingTop + chartH - (Math.min(val, maxVal) / maxVal) * chartH;

  const hasData = series.some((s) => s.values.some((v) => v !== null));

  if (!hasData) {
    return (
      <div className="flex h-full min-h-[180px] items-center justify-center text-sm text-muted">
        Tiada data trend untuk dipaparkan.
      </div>
    );
  }

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label="Trend mingguan"
      >
        {gridlines.map((g) => (
          <g key={g}>
            <line
              x1={paddingLeft}
              x2={width - paddingRight}
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

        {xLabels.map((label, i) => (
          <text
            key={label}
            x={xFor(i)}
            y={height - paddingBottom + 16}
            textAnchor="middle"
            fontSize={10}
            fill="rgb(155,161,168)"
          >
            {label}
          </text>
        ))}

        {series.map((s) => {
          const points = s.values
            .map((v, i) => (v === null ? null : `${xFor(i)},${yFor(v)}`))
            .filter(Boolean);
          if (points.length === 0) return null;
          return (
            <g key={s.code}>
              <polyline
                points={points.join(" ")}
                fill="none"
                stroke={s.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {s.values.map((v, i) =>
                v === null ? null : (
                  <circle
                    key={i}
                    cx={xFor(i)}
                    cy={yFor(v)}
                    r={3}
                    fill={s.color}
                  />
                )
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3">
        {series.map((s) => (
          <div key={s.code} className="flex items-center gap-1.5 text-xs text-muted">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}
