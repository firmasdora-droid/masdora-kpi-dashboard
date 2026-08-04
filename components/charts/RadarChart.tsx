import type { ChartDatum } from "./types";

export default function RadarChart({
  data,
  size = 260,
  maxValue = 130,
}: {
  data: ChartDatum[];
  size?: number;
  maxValue?: number;
}) {
  const center = size / 2;
  const radius = size * 0.34;
  const rings = [0.25, 0.5, 0.75, 1];
  const n = data.length;

  if (n < 3) {
    return (
      <div className="flex h-full min-h-[180px] items-center justify-center text-sm text-muted">
        Perlu sekurang-kurangnya 3 jabatan untuk peta prestasi.
      </div>
    );
  }

  const angleFor = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pointFor = (i: number, value: number) => {
    const r = (Math.min(value, maxValue) / maxValue) * radius;
    const a = angleFor(i);
    return [center + r * Math.cos(a), center + r * Math.sin(a)];
  };
  const axisPoint = (i: number, mult: number) => {
    const a = angleFor(i);
    return [center + radius * mult * Math.cos(a), center + radius * mult * Math.sin(a)];
  };

  const polygonPoints = data
    .map((d, i) => pointFor(i, d.value).join(","))
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="mx-auto"
      width={size}
      height={size}
      role="img"
      aria-label="Peta prestasi jabatan"
    >
      {rings.map((mult) => {
        const pts = Array.from({ length: n }, (_, i) =>
          axisPoint(i, mult).join(",")
        ).join(" ");
        return (
          <polygon
            key={mult}
            points={pts}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={1}
          />
        );
      })}

      {data.map((d, i) => {
        const [x, y] = axisPoint(i, 1);
        return (
          <line
            key={`axis-${d.code}`}
            x1={center}
            y1={center}
            x2={x}
            y2={y}
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={1}
          />
        );
      })}

      <polygon
        points={polygonPoints}
        fill="rgba(201,162,39,0.18)"
        stroke="#C9A227"
        strokeWidth={2}
      />

      {data.map((d, i) => {
        const [x, y] = pointFor(i, d.value);
        return <circle key={d.code} cx={x} cy={y} r={3} fill={d.color} />;
      })}

      {data.map((d, i) => {
        const [x, y] = axisPoint(i, 1.22);
        return (
          <text
            key={`label-${d.code}`}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={11}
            fill="rgb(249,249,250)"
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}
