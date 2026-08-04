export default function DonutChart({
  pct,
  size = 180,
  color = "#C9A227",
  label = "Skor Minggu",
}: {
  pct: number;
  size?: number;
  color?: string;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const stroke = size * 0.14;
  const radius = size / 2 - stroke;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const center = size / 2;

  return (
    <div className="flex flex-col items-center justify-center">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label={label}
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
        <text
          x={center}
          y={center - 4}
          textAnchor="middle"
          fontSize={size * 0.19}
          fontWeight={700}
          fill="rgb(249,249,250)"
        >
          {Math.round(clamped)}%
        </text>
        <text
          x={center}
          y={center + size * 0.14}
          textAnchor="middle"
          fontSize={size * 0.065}
          fill="rgb(155,161,168)"
        >
          {label}
        </text>
      </svg>
    </div>
  );
}
