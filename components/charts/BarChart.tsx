"use client";

import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartDatum } from "./types";

const MAX_SCALE = 130;

const tooltipContentStyle: React.CSSProperties = {
  background: "#0f172acc",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 12,
  fontSize: 12,
  color: "#f9f9fa",
};

export default function BarChart({
  data,
  height = 260,
}: {
  data: ChartDatum[];
  height?: number;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-[180px] items-center justify-center text-sm text-muted">
        Tiada data untuk dipaparkan.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RBarChart data={data} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
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
          domain={[0, MAX_SCALE]}
          ticks={[0, 35, 70, 130]}
          stroke="#64748b"
          tick={{ fill: "#64748b", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={tooltipContentStyle}
          labelStyle={{ color: "#f9f9fa", fontWeight: 600 }}
          cursor={{ fill: "rgba(255,255,255,.04)" }}
          formatter={(value) => [`${Math.round(Number(value))}%`, "Skor"]}
        />
        <Bar
          dataKey="value"
          radius={[6, 6, 0, 0]}
          maxBarSize={48}
          isAnimationActive
          animationDuration={800}
          animationEasing="ease-out"
        >
          {data.map((d) => (
            <Cell key={d.code} fill={d.color} fillOpacity={0.9} />
          ))}
        </Bar>
      </RBarChart>
    </ResponsiveContainer>
  );
}
