"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
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
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
        className="card text-sm text-muted"
      >
        Tiada data untuk tempoh ini.
      </motion.div>
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
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.45,
              delay: i * 0.06,
              ease: [0.4, 0, 0.2, 1],
            }}
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
          </motion.div>
        );
      })}
    </div>
  );
}
