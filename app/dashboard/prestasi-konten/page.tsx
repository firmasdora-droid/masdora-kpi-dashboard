"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

interface ContentPost {
  monthTab: string;
  rowIndex: number;
  account: string;
  contentType: string;
  postedAt: string;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  videoLink: string;
  yellowBag: string;
  handler: string;
}

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1Gk4DE6gcEKb6JkDZX3OJH27d6d7EPTVxaWynWgVcAgc/edit";

const cardMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const },
};

function nf(n: number): string {
  return n.toLocaleString("ms-MY");
}

export default function PrestasiKontenPage() {
  const supabase = createClient();

  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [tabs, setTabs] = useState<string[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [monthFilter, setMonthFilter] = useState("");
  const [handlerFilter, setHandlerFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(
    async (fresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const [json, { data: user }] = await Promise.all([
          fetch(`/api/content-log${fresh ? "?fresh=1" : ""}`, {
            cache: "no-store",
          }).then((r) => r.json()),
          supabase.auth.getUser(),
        ]);

        if (user.user) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.user.id)
            .maybeSingle<Profile>();
          setProfile(prof ?? null);
        }

        if (!json.ok) {
          setError(json.error ?? "Gagal memuatkan data.");
          setPosts([]);
        } else {
          setPosts(json.posts as ContentPost[]);
          setTabs((json.tabs as string[]) ?? []);
          setRefreshedAt(
            new Date().toLocaleTimeString("ms-MY", {
              hour: "2-digit",
              minute: "2-digit",
            })
          );
        }
      } catch {
        setError("Gagal menghubungi Google Sheet.");
      }
      setLoading(false);
    },
    [supabase]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Bulan terkini yang ada data dipilih automatik
  useEffect(() => {
    if (monthFilter || posts.length === 0 || tabs.length === 0) return;
    const withData = tabs.filter((t) => posts.some((p) => p.monthTab === t));
    if (withData.length > 0) setMonthFilter(withData[withData.length - 1]);
  }, [posts, tabs, monthFilter]);

  // Ahli biasa lihat prestasi sendiri secara lalai
  useEffect(() => {
    if (handlerFilter || !profile || posts.length === 0) return;
    const first = profile.full_name.split(/\s+/)[0].toLowerCase();
    const mine = posts.find((p) => p.handler.toLowerCase().includes(first));
    if (mine) setHandlerFilter(mine.handler);
  }, [profile, posts, handlerFilter]);

  const handlers = useMemo(
    () => Array.from(new Set(posts.map((p) => p.handler))).sort(),
    [posts]
  );
  const accounts = useMemo(
    () => Array.from(new Set(posts.map((p) => p.account))).sort(),
    [posts]
  );

  const filtered = useMemo(
    () =>
      posts.filter((p) => {
        if (monthFilter && p.monthTab !== monthFilter) return false;
        if (handlerFilter && p.handler !== handlerFilter) return false;
        if (accountFilter && p.account !== accountFilter) return false;
        return true;
      }),
    [posts, monthFilter, handlerFilter, accountFilter]
  );

  const totalViews = filtered.reduce((s, p) => s + p.views, 0);
  const totalLikes = filtered.reduce((s, p) => s + p.likes, 0);
  const totalComments = filtered.reduce((s, p) => s + p.comments, 0);
  const totalShares = filtered.reduce((s, p) => s + p.shares, 0);
  const avgViews =
    filtered.length > 0 ? Math.round(totalViews / filtered.length) : 0;

  /** Prestasi ikut akaun (untuk carta bar). */
  const perAccount = useMemo(() => {
    const map = new Map<string, { posts: number; views: number }>();
    filtered.forEach((p) => {
      const cur = map.get(p.account) ?? { posts: 0, views: 0 };
      cur.posts += 1;
      cur.views += p.views;
      map.set(p.account, cur);
    });
    return Array.from(map.entries())
      .map(([account, v]) => ({ account, ...v }))
      .sort((a, b) => b.views - a.views);
  }, [filtered]);
  const maxAccountViews = Math.max(1, ...perAccount.map((a) => a.views));

  const sortedAll = useMemo(
    () => [...filtered].sort((a, b) => b.views - a.views),
    [filtered]
  );
  const topPosts = useMemo(() => sortedAll.slice(0, 5), [sortedAll]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Prestasi Konten</h2>
          <p className="text-sm text-muted">
            Terus dari Google Sheet posting log — kemas kini di sheet, dashboard
            ikut sendiri.
            {refreshedAt && (
              <span className="ml-1 text-slate-500">
                (dikemas kini {refreshedAt})
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => load(true)}
            className="btn-secondary"
            disabled={loading}
          >
            {loading ? "Memuatkan..." : "Muat Semula"}
          </button>
          <a
            href={SHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
          >
            Buka Sheet
          </a>
        </div>
      </div>

      {error && (
        <motion.div
          {...cardMotion}
          className="card border-red-500/30 text-sm text-red-300"
        >
          {error}
        </motion.div>
      )}

      {/* Nombor utama */}
      <motion.div
        {...cardMotion}
        className="rounded-2xl border border-masdora-orange/25 bg-gradient-to-br from-masdora-orange/20 to-masdora-orange/5 p-6"
      >
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
          Jumlah tontonan
          {handlerFilter ? ` · ${handlerFilter}` : ""}
          {monthFilter ? ` · ${monthFilter}` : ""}
        </p>
        <p className="mt-1 text-5xl font-black text-white">{nf(totalViews)}</p>
        <p className="mt-2 text-sm text-slate-400">
          <span className="font-bold text-white">{filtered.length}</span> video ·
          purata <span className="font-bold text-white">{nf(avgViews)}</span>{" "}
          tontonan setiap video
        </p>
      </motion.div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Like", value: totalLikes, icon: "❤️" },
          { label: "Komen", value: totalComments, icon: "💬" },
          { label: "Share", value: totalShares, icon: "🔁" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            {...cardMotion}
            transition={{ ...cardMotion.transition, delay: i * 0.06 }}
            className="card"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                {s.label}
              </span>
              <span aria-hidden>{s.icon}</span>
            </div>
            <p className="mt-2 text-2xl font-black text-white">{nf(s.value)}</p>
          </motion.div>
        ))}
      </div>

      <motion.div {...cardMotion} className="card flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Bulan</label>
          <select
            className="input"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          >
            <option value="">Semua Bulan</option>
            {tabs.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Handler</label>
          <select
            className="input"
            value={handlerFilter}
            onChange={(e) => setHandlerFilter(e.target.value)}
          >
            <option value="">Semua Handler</option>
            {handlers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Akaun</label>
          <select
            className="input"
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
          >
            <option value="">Semua Akaun</option>
            {accounts.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </motion.div>

      {loading ? (
        <p className="text-sm text-muted">Memuatkan data...</p>
      ) : filtered.length === 0 ? (
        <motion.div {...cardMotion} className="card text-center text-sm text-muted">
          {posts.length === 0
            ? "Belum ada video direkod dalam sheet. Isi ruangan tarikh, views & link di sheet — dashboard akan ikut sendiri."
            : "Tiada video untuk tapisan ini."}
        </motion.div>
      ) : (
        <>
          {perAccount.length > 1 && (
            <motion.div {...cardMotion} className="card">
              <h3 className="mb-4 font-semibold text-white">
                Tontonan Mengikut Akaun
              </h3>
              <div className="space-y-3">
                {perAccount.map((a, i) => (
                  <div key={a.account}>
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <span className="font-semibold text-slate-200">
                        {a.account}
                      </span>
                      <span className="text-slate-400">
                        <span className="font-black text-white">
                          {nf(a.views)}
                        </span>{" "}
                        · {a.posts} video
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-masdora-orange to-masdora-orange/60"
                        initial={{ width: 0 }}
                        animate={{ width: `${(a.views / maxAccountViews) * 100}%` }}
                        transition={{ duration: 0.7, delay: i * 0.08, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {topPosts.some((p) => p.views > 0) && (
            <motion.div {...cardMotion} className="card">
              <h3 className="mb-3 font-semibold text-white">Video Terbaik</h3>
              <div className="space-y-2">
                {topPosts.map((p, i) => (
                  <div
                    key={`${p.monthTab}-${p.rowIndex}`}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                  >
                    <span className="w-5 text-center text-sm font-bold text-slate-500">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-100">
                        {p.contentType || "(tiada tajuk)"}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {p.account} · {p.postedAt || "tiada tarikh"}
                      </p>
                    </div>
                    {p.videoLink && (
                      <a
                        href={p.videoLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-xs font-semibold text-brand-400 hover:underline"
                      >
                        Buka ↗
                      </a>
                    )}
                    <span className="flex-shrink-0 text-sm font-black text-white">
                      {nf(p.views)}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Senarai penuh disorok — buka hanya bila perlu */}
          <div>
            <button
              onClick={() => setShowAll((v) => !v)}
              className="btn-secondary"
            >
              {showAll
                ? "Sembunyikan senarai penuh"
                : `Lihat semua video (${filtered.length})`}
            </button>

            {showAll && (
              <motion.div {...cardMotion} className="card mt-3 space-y-2">
                {sortedAll.map((p) => (
                  <div
                    key={`${p.monthTab}-${p.rowIndex}`}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-100">
                        {p.contentType || "(tiada tajuk)"}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {p.postedAt || "tiada tarikh"}
                        {!accountFilter && ` · ${p.account}`}
                        {!handlerFilter && ` · ${p.handler}`}
                        {p.likes > 0 && ` · ${nf(p.likes)} like`}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-sm font-black text-white">
                        {nf(p.views)}
                      </p>
                      <p className="text-[10px] text-slate-500">views</p>
                    </div>
                    {p.videoLink && (
                      <a
                        href={p.videoLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 text-xs font-semibold text-brand-400 hover:underline"
                      >
                        Buka ↗
                      </a>
                    )}
                  </div>
                ))}
              </motion.div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
