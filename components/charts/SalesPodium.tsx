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
  {
    height: number;
    bar: string;
    ring: string;
    medal: string;
    label: string;
    avatar: number;
  }
> = {
  1: {
    height: 128,
    bar: "bg-gradient-to-t from-masdora-orange/70 to-masdora-orange",
    ring: "ring-2 ring-masdora-orange/60",
    medal: "🥇",
    label: "text-masdora-orange",
    avatar: 56,
  },
  2: {
    height: 96,
    bar: "bg-gradient-to-t from-slate-500/60 to-slate-300",
    ring: "ring-2 ring-slate-300/50",
    medal: "🥈",
    label: "text-slate-300",
    avatar: 46,
  },
  3: {
    height: 76,
    bar: "bg-gradient-to-t from-amber-800/60 to-amber-600",
    ring: "ring-2 ring-amber-600/50",
    medal: "🥉",
    label: "text-amber-500",
    avatar: 46,
  },
};

/** Serpihan confetti untuk juara. */
const CONFETTI = [
  { x: -46, delay: 0.7, color: "#F26122", rotate: 25 },
  { x: -22, delay: 0.85, color: "#FDE585", rotate: -15 },
  { x: 4, delay: 0.75, color: "#6B8042", rotate: 40 },
  { x: 26, delay: 0.95, color: "#F26122", rotate: -30 },
  { x: 48, delay: 0.8, color: "#FDE585", rotate: 12 },
];

/** Orang duduk sambil menangis — untuk kedudukan paling bawah. */
function CryingFigure() {
  return (
    <svg viewBox="0 0 64 74" width="58" height="67" aria-label="Tempat terakhir">
      {/* kaki */}
      <rect x="26" y="56" width="30" height="9" rx="4.5" fill="#64748b" />
      <rect x="26" y="46" width="26" height="9" rx="4.5" fill="#94a3b8" />
      {/* badan */}
      <path
        d="M14 62 Q10 40 24 36 L36 36 Q46 40 42 62 Z"
        fill="#475569"
      />
      {/* lengan memeluk lutut */}
      <path
        d="M20 44 Q34 52 48 52"
        stroke="#94a3b8"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />
      {/* kepala */}
      <circle cx="28" cy="22" r="14" fill="#cbd5e1" />
      {/* mata sedih */}
      <path
        d="M21 20 Q23.5 17.5 26 20"
        stroke="#334155"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M31 20 Q33.5 17.5 36 20"
        stroke="#334155"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* mulut sedih */}
      <path
        d="M24 29 Q28 25.5 32 29"
        stroke="#334155"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* air mata jatuh berterusan */}
      {[
        { cx: 23.5, delay: 0 },
        { cx: 33.5, delay: 0.6 },
      ].map((t, i) => (
        <motion.ellipse
          key={i}
          cx={t.cx}
          rx="2"
          ry="2.8"
          fill="#60a5fa"
          initial={{ cy: 23, opacity: 0 }}
          animate={{ cy: [23, 38], opacity: [0, 1, 1, 0] }}
          transition={{
            duration: 1.6,
            delay: 1.2 + t.delay,
            repeat: Infinity,
            repeatDelay: 0.7,
            ease: "easeIn",
          }}
        />
      ))}
    </svg>
  );
}

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

  // Orang paling bawah — hanya dipaparkan kalau dia bukan sebahagian top 3
  const lastPlace =
    items.length > 3
      ? items.reduce((a, b) => (b.rank > a.rank ? b : a))
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
      className={bare ? "" : "card"}
    >
      {/* Pentas */}
      <div className="flex items-end justify-center gap-3 overflow-x-auto pt-6 sm:gap-6">
        {ORDER.map((rank) => {
          const item = top3.find((i) => i.rank === rank);
          if (!item) return <div key={rank} className="w-24 sm:w-32" />;

          const s = STYLES[rank];
          const delay = rank === 1 ? 0 : rank === 2 ? 0.18 : 0.36;

          return (
            <div
              key={item.id}
              className="relative flex w-24 flex-col items-center sm:w-32"
            >
              {/* Confetti untuk juara */}
              {rank === 1 &&
                CONFETTI.map((c, ci) => (
                  <motion.span
                    key={ci}
                    className="pointer-events-none absolute top-0 h-2.5 w-1.5 rounded-sm"
                    style={{ background: c.color, left: "50%" }}
                    initial={{ opacity: 0, y: -10, x: 0, rotate: 0 }}
                    animate={{
                      opacity: [0, 1, 1, 0],
                      y: [-10, 90],
                      x: [0, c.x],
                      rotate: [0, c.rotate * 8],
                    }}
                    transition={{
                      duration: 2.2,
                      delay: c.delay,
                      repeat: Infinity,
                      repeatDelay: 2.4,
                      ease: "easeIn",
                    }}
                  />
                ))}

              {/* Pingat jatuh dari atas */}
              <motion.span
                className="text-2xl"
                initial={{ opacity: 0, y: -22, scale: 0.4 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 12,
                  delay: delay + 0.5,
                }}
              >
                {s.medal}
              </motion.span>

              {/* Avatar timbul dengan lantunan */}
              <motion.div
                className={`my-2 rounded-full ${s.ring}`}
                initial={{ opacity: 0, scale: 0.3 }}
                animate={
                  rank === 1
                    ? {
                        opacity: 1,
                        scale: 1,
                        boxShadow: [
                          "0 0 0px rgba(242,97,34,0)",
                          "0 0 22px rgba(242,97,34,0.55)",
                          "0 0 0px rgba(242,97,34,0)",
                        ],
                      }
                    : { opacity: 1, scale: 1 }
                }
                transition={{
                  scale: {
                    type: "spring",
                    stiffness: 300,
                    damping: 14,
                    delay: delay + 0.35,
                  },
                  opacity: { duration: 0.3, delay: delay + 0.35 },
                  boxShadow: {
                    duration: 2.4,
                    repeat: Infinity,
                    delay: delay + 1,
                  },
                }}
              >
                <AvatarInitials name={item.name} size={s.avatar} />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: delay + 0.6 }}
                className="w-full"
              >
                <p className="w-full truncate text-center text-sm font-bold text-white">
                  {item.name}
                  {highlightId === item.id && (
                    <span className="ml-1 text-[9px] font-black text-masdora-orange">
                      ANDA
                    </span>
                  )}
                </p>
                {item.deptCode && (
                  <p className="truncate text-center text-[10px] uppercase tracking-wide text-slate-500">
                    {item.deptCode}
                  </p>
                )}
                <p className={`mt-1 text-center text-sm font-black ${s.label}`}>
                  {item.valueLabel}
                </p>
              </motion.div>

              {/* Blok pentas tumbuh dari bawah */}
              <motion.div
                className={`mt-3 flex w-full items-start justify-center rounded-t-xl ${s.bar}`}
                style={{ transformOrigin: "bottom" }}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: s.height, opacity: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 90,
                  damping: 15,
                  delay,
                }}
              >
                <motion.span
                  className="mt-2 text-2xl font-black text-black/25"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: delay + 0.45 }}
                >
                  {rank}
                </motion.span>
              </motion.div>
            </div>
          );
        })}

        {/* Orang paling bawah — duduk menangis di sebelah tempat ke-3 */}
        {lastPlace && (
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.9 }}
            className="flex w-20 flex-col items-center self-end pb-1 sm:w-24"
            title={`Kedudukan terakhir: ${lastPlace.name}`}
          >
            <motion.div
              animate={{ y: [0, -2, 0] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            >
              <CryingFigure />
            </motion.div>
            <p className="mt-1 w-full truncate text-center text-[11px] font-bold text-slate-400">
              {lastPlace.name}
              {highlightId === lastPlace.id && (
                <span className="ml-1 text-[9px] font-black text-masdora-orange">
                  ANDA
                </span>
              )}
            </p>
            <p className="text-center text-[10px] text-slate-600">
              #{lastPlace.rank} · {lastPlace.valueLabel}
            </p>
          </motion.div>
        )}
      </div>

      {/* Kedudukan seterusnya */}
      {rest.length > 0 && (
        <div className="mt-6 space-y-2 border-t border-white/5 pt-4">
          {rest.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.7 + i * 0.05 }}
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
