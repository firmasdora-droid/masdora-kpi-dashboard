"use client";

import { motion } from "framer-motion";
import AvatarInitials from "@/components/AvatarInitials";

export interface PodiumItem {
  id: string;
  rank: number;
  name: string;
  deptCode?: string | null;
  value: number;
  valueLabel: string;
}

/** Susunan pentas: tempat ke-2 kiri, juara tengah, ke-3 kanan. */
const ORDER = [2, 1, 3];

const STYLES: Record<
  number,
  { height: string; bar: string; ring: string; medal: string; label: string }
> = {
  1: {
    height: "h-32",
    bar: "bg-gradient-to-t from-masdora-orange/70 to-masdora-orange",
    ring: "ring-2 ring-masdora-orange/60",
    medal: "🥇",
    label: "text-masdora-orange",
  },
  2: {
    height: "h-24",
    bar: "bg-gradient-to-t from-slate-500/60 to-slate-300",
    ring: "ring-2 ring-slate-300/50",
    medal: "🥈",
    label: "text-slate-300",
  },
  3: {
    height: "h-20",
    bar: "bg-gradient-to-t from-amber-800/60 to-amber-600",
    ring: "ring-2 ring-amber-600/50",
    medal: "🥉",
    label: "text-amber-500",
  },
};

export default function SalesPodium({
  items,
  emptyMessage = "Tiada data untuk tempoh ini.",
  bare = false,
  highlightId,
}: {
  items: PodiumItem[];
  emptyMessage?: string;
  /** Jangan bungkus dalam kad — guna bila sudah berada dalam kad lain. */
  bare?: boolean;
  /** Tonjolkan orang ini sebagai "ANDA". */
  highlightId?: string;
}) {
  if (items.length === 0) {
    return bare ? (
      <p className="text-sm text-muted">{emptyMessage}</p>
    ) : (
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
        className="card text-center text-sm text-muted"
      >
        {emptyMessage}
      </motion.div>
    );
  }

  const top3 = items.filter((i) => i.rank <= 3);
  const rest = items.filter((i) => i.rank > 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
      className={bare ? "" : "card"}
    >
      {/* Pentas */}
      <div className="flex items-end justify-center gap-3 pt-4 sm:gap-6">
        {ORDER.map((rank) => {
          const item = top3.find((i) => i.rank === rank);
          if (!item) return <div key={rank} className="w-24 sm:w-32" />;

          const s = STYLES[rank];
          const delay = rank === 1 ? 0 : rank === 2 ? 0.12 : 0.24;

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay, ease: [0.4, 0, 0.2, 1] }}
              className="flex w-24 flex-col items-center sm:w-32"
            >
              <span className="text-2xl">{s.medal}</span>

              <div className={`my-2 rounded-full ${s.ring}`}>
                <AvatarInitials name={item.name} size={rank === 1 ? 56 : 46} />
              </div>

              <p className="w-full truncate text-center text-sm font-bold text-white">
                {item.name}
                {highlightId === item.id && (
                  <span className="ml-1 text-[9px] font-black text-masdora-orange">
                    ANDA
                  </span>
                )}
              </p>
              {item.deptCode && (
                <p className="truncate text-[10px] uppercase tracking-wide text-slate-500">
                  {item.deptCode}
                </p>
              )}
              <p className={`mt-1 text-sm font-black ${s.label}`}>
                {item.valueLabel}
              </p>

              {/* Blok pentas */}
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: "auto" }}
                transition={{ duration: 0.6, delay: delay + 0.15 }}
                className="mt-3 w-full overflow-hidden"
              >
                <div
                  className={`${s.height} ${s.bar} flex items-start justify-center rounded-t-xl`}
                >
                  <span className="mt-2 text-2xl font-black text-black/25">
                    {rank}
                  </span>
                </div>
              </motion.div>
            </motion.div>
          );
        })}
      </div>

      {/* Kedudukan seterusnya */}
      {rest.length > 0 && (
        <div className="mt-6 space-y-2 border-t border-white/5 pt-4">
          {rest.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 + i * 0.05 }}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2.5"
            >
              <span className="w-6 text-center text-sm font-bold text-slate-500">
                {item.rank}
              </span>
              <AvatarInitials name={item.name} size={28} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-200">
                {item.name}
                {highlightId === item.id && (
                  <span className="ml-1.5 text-[9px] font-black text-masdora-orange">
                    ANDA
                  </span>
                )}
              </span>
              {item.deptCode && (
                <span className="hidden text-[10px] uppercase tracking-wide text-slate-500 sm:inline">
                  {item.deptCode}
                </span>
              )}
              <span className="flex-shrink-0 text-sm font-black text-white">
                {item.valueLabel}
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
