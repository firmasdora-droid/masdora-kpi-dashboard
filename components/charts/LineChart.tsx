"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SeriesDatum } from "./types";

const tooltipContentStyle: React.CSSProperties = {
  background: "#0f172acc",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 12,
  fontSize: 12,
  color: "#f9f9fa",
};

export default function LineChart({
  series,
  xLabels = ["M1", "M2", "M3", "M4"],
  height = 260,
}: {
  series: SeriesDatum[];
  xLabels?: string[];
  height?: number;
}) {
  const hasData = series.some((s) => s.values.some((v) => v !== null));

  if (!hasData) {
    return (
      <div className="flex h-full min-h-[180px] items-center justify-center text-sm text-muted">
        Tiada data trend untuk dipaparkan.
      </div>
    );
  }

  const chartData = xLabels.map((label, i) => {
    const row: Record<string, number | string | null> = { label };
    series.forEach((s) => {
      row[s.code] = s.values[i] ?? null;
    });
    return row;
  });

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <RLineChart data={chartData} margin={{ top: 16, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,.07)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            stroke="#64748b"
            tick={{ fill: "#64748b", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,.08)" }}
          />
          <YAxis
            domain={[0, 130]}
            ticks={[0, 35, 70, 130]}
            stroke="#64748b"
            tick={{ fill: "#64748b", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip contentStyle={tooltipContentStyle} labelStyle={{ color: "#f9f9fa", fontWeight: 600 }} />
          {series.map((s) => (
            <Line
              key={s.code}
              type="monotone"
              dataKey={s.code}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls
              isAnimationActive
              animationDuration={900}
              animationEasing="ease-out"
            />
          ))}
          <Legend
            wrapperStyle={{ fontSize: 11, color: "#9ba1a8", paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
          />
        </RLineChart>
      </ResponsiveContainer>
    </div>
  );
}
