"use client";

import { useEffect, useState } from "react";
import AvatarInitials from "@/components/AvatarInitials";

export interface RankBarItem {
  id: string;
  rank: number;
  name: string;
  deptCode?: string | null;
  deptColor?: string;
  value: number;
  valueLabel: string;
}

const MEDALS = ["🥇", "🥈", "🥉"];
const RANK_BAR_COLORS = [
  "linear-gradient(90deg,#F26122,#F26122cc)",
  "linear-gradient(90deg,#D8D6CF,#D8D6CFcc)",
  "linear-gradient(90deg,#FDE585,#FDE585cc)",
];

export default function RankBarChart({ items }: { items: RankBarItem[] }) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(t);
  }, [items]);

  const max = Math.max(1, ...items.map((i) => Math.abs(i.value)));

  if (items.length === 0) {
    return (
      <div className="card text-sm text-muted">Tiada data untuk tempoh ini.</div>
    );
  }

  return (
    <div className="card space-y-3">
      {items.map((item, i) => {
        const pct = Math.min(100, (Math.abs(item.value) / max) * 100);
        const barColor =
          RANK_BAR_COLORS[i] ??
          `linear-gradient(90deg, ${item.deptColor ?? "#C9A227"}, ${
            item.deptColor ?? "#C9A227"
          }99)`;
        return (
          <div
            key={item.id}
            className="animate-rise"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="w-7 flex-shrink-0 text-center text-sm">
                {MEDALS[item.rank - 1] ?? `#${item.rank}`}
              </span>
              <AvatarInitials
                name={item.name}
                deptColor={item.deptColor}
                size={24}
              />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-100">
                {item.name}
              </span>
              {item.deptCode && (
                <span className="hidden text-[10px] uppercase tracking-wide text-slate-500 sm:inline">
                  {item.deptCode}
                </span>
              )}
              <span className="flex-shrink-0 text-sm font-black text-white">
                {item.valueLabel}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: animated ? `${pct}%` : "0%",
                  background: barColor,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
