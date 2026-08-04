"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RRadarChart,
  ResponsiveContainer,
} from "recharts";
import type { ChartDatum } from "./types";

export default function RadarChart({
  data,
  height = 280,
  maxValue = 130,
}: {
  data: ChartDatum[];
  height?: number;
  maxValue?: number;
}) {
  if (data.length < 3) {
    return (
      <div className="flex h-full min-h-[180px] items-center justify-center text-sm text-muted">
        Perlu sekurang-kurangnya 3 jabatan untuk peta prestasi.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RRadarChart data={data} outerRadius="70%">
        <PolarGrid stroke="rgba(255,255,255,.1)" />
        <PolarAngleAxis
          dataKey="label"
          tick={{ fill: "#94a3b8", fontSize: 11 }}
        />
        <PolarRadiusAxis
          domain={[0, maxValue]}
          tick={false}
          axisLine={false}
          tickCount={4}
        />
        <Radar
          dataKey="value"
          stroke="#F26122"
          fill="#F26122"
          fillOpacity={0.18}
          strokeWidth={2}
          isAnimationActive
          animationDuration={800}
          animationEasing="ease-out"
        />
      </RRadarChart>
    </ResponsiveContainer>
  );
}
