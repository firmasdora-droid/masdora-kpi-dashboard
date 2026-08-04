"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

export default function DonutChart({
  pct,
  size = 180,
  color = "#F26122",
  label = "Skor Minggu",
}: {
  pct: number;
  size?: number;
  color?: string;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const data = [
    { name: "achieved", value: clamped },
    { name: "remaining", value: 100 - clamped },
  ];
  const outerRadius = size / 2;
  const innerRadius = outerRadius * 0.6;

  return (
    <div
      className="relative flex flex-col items-center justify-center"
      style={{ width: size, height: size }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            startAngle={90}
            endAngle={-270}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            stroke="none"
            isAnimationActive
            animationDuration={800}
            animationEasing="ease-out"
          >
            <Cell fill={color} />
            <Cell fill="rgba(255,255,255,.08)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-black text-white"
          style={{ fontSize: size * 0.19 }}
        >
          {Math.round(clamped)}%
        </span>
        <span
          className="text-muted"
          style={{ fontSize: size * 0.065 }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
