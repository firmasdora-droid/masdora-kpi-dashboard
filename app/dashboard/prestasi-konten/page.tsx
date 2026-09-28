"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import SalesPodium, { type PodiumItem } from "@/components/charts/SalesPodium";
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

/**
 * Tahun bagi satu tab sheet, dibaca dari namanya (contoh "SEPT 2026").
 * Null kalau nama tab tidak menyebut tahun — dashboard kemudian
 * menganggap semua tab itu satu tempoh sahaja.
 */
function tahunTab(nama: string): string | null {
  const m = nama.match(/(20d{2})/);
  return m ? m[1] : null;
}

type Mod = "bulan" | "tahun";

interface Ringkasan {
  video: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  /** Bilangan video mengikut akaun, contoh { "Tiktok OS": 12 }. */
  ikutAkaun: Record<string, number>;
}

function kosong(): Ringkasan {
  return {
    video: 0,
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    ikutAkaun: {},
  };
}

function tambah(a: Ringkasan, p: ContentPost): Ringkasan {
  return {
    video: a.video + 1,
    views: a.views + p.views,
    likes: a.likes + p.likes,
    comments: a.comments + p.comments,
    shares: a.shares + p.shares,
    ikutAkaun: {
      ...a.ikutAkaun,
      [p.account]: (a.ikutAkaun[p.account] ?? 0) + 1,
    },
  };
}

export default function PrestasiKontenPage() {
  const supabase = createClient();

  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [tabs, setTabs] = useState<string[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [mod, setMod] = useState<Mod>("bulan");
  const [yearFilter, setYearFilter] = useState("");
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

  // Pilih bulan yang paling banyak video BERDATA (ada tontonan direkod),
  // bukan sekadar bulan terakhir yang ada baris kosong.
  useEffect(() => {
    if (monthFilter || posts.length === 0 || tabs.length === 0) return;
    // Ambil bulan TERKINI yang benar-benar ada tontonan direkod.
    let best = "";
    tabs.forEach((t) => {
      const hasViews = posts.some((p) => p.monthTab === t && p.views > 0);
      if (hasViews) best = t;
    });
    if (!best) {
      const withAny = tabs.filter((t) => posts.some((p) => p.monthTab === t));
      best = withAny[withAny.length - 1] ?? "";
    }
    if (best) setMonthFilter(best);
  }, [posts, tabs, monthFilter]);

  // Ahli biasa lihat prestasi sendiri secara lalai.
  // Manager/CEO lihat semua handler supaya nampak gambaran penuh.
  useEffect(() => {
    if (handlerFilter || !profile || posts.length === 0) return;
    if (profile.role === "manager" || profile.role === "ceo") return;
    const first = profile.full_name.split(/\s+/)[0].toLowerCase();
    const mine = posts.find((p) => p.handler.toLowerCase().includes(first));
    if (mine) setHandlerFilter(mine.handler);
  }, [profile, posts, handlerFilter]);

  /** Tahun yang dikesan daripada nama tab sheet. Kosong = tab tiada tahun. */
  const tahunAda = useMemo(() => {
    const set = new Set<string>();
    tabs.forEach((t) => {
      const y = tahunTab(t);
      if (y) set.add(y);
    });
    return Array.from(set).sort();
  }, [tabs]);

  // Lalai: tahun bagi bulan yang sedang dipilih, kalau tidak tahun terkini.
  useEffect(() => {
    if (yearFilter || tahunAda.length === 0) return;
    const dariBulan = monthFilter ? tahunTab(monthFilter) : null;
    setYearFilter(dariBulan ?? tahunAda[tahunAda.length - 1]);
  }, [tahunAda, monthFilter, yearFilter]);

  /** Tab yang tergolong dalam tahun yang dipilih. */
  const tabTahun = useMemo(() => {
    if (tahunAda.length === 0 || !yearFilter) return tabs;
    return tabs.filter((t) => tahunTab(t) === yearFilter);
  }, [tabs, tahunAda, yearFilter]);

  // Tukar tahun: kalau bulan yang sedang dipilih bukan milik tahun itu,
  // pindah ke bulan terkini tahun itu yang ada tontonan.
  useEffect(() => {
    if (tabTahun.length === 0) return;
    if (monthFilter && tabTahun.includes(monthFilter)) return;
    let best = "";
    tabTahun.forEach((t) => {
      if (posts.some((p) => p.monthTab === t && p.views > 0)) best = t;
    });
    setMonthFilter(best || tabTahun[tabTahun.length - 1]);
  }, [tabTahun, monthFilter, posts]);

  const handlers = useMemo(
    () => Array.from(new Set(posts.map((p) => p.handler))).sort(),
    [posts]
  );
  const accounts = useMemo(
    () => Array.from(new Set(posts.map((p) => p.account))).sort(),
    [posts]
  );

  /**
   * Video yang dikira. Dalam mod "bulan" hanya bulan yang dipilih; dalam
   * mod "tahun" semua bulan dalam tahun itu digabungkan.
   */
  const filtered = useMemo(
    () =>
      posts.filter((p) => {
        if (mod === "tahun") {
          if (!tabTahun.includes(p.monthTab)) return false;
        } else if (monthFilter && p.monthTab !== monthFilter) {
          return false;
        }
        if (handlerFilter && p.handler !== handlerFilter) return false;
        if (accountFilter && p.account !== accountFilter) return false;
        return true;
      }),
    [posts, mod, tabTahun, monthFilter, handlerFilter, accountFilter]
  );

  /**
   * Pecahan setiap bulan dalam tahun yang dipilih — tontonan, like, komen
   * dan share. Handler/akaun yang ditapis turut digunakan di sini supaya
   * jadual ini sepadan dengan nombor di atas.
   */
  const perBulan = useMemo(() => {
    const asas = posts.filter((p) => {
      if (handlerFilter && p.handler !== handlerFilter) return false;
      if (accountFilter && p.account !== accountFilter) return false;
      return true;
    });
    return tabTahun.map((tab) => {
      let r = kosong();
      asas.forEach((p) => {
        if (p.monthTab === tab) r = tambah(r, p);
      });
      return { tab, ...r };
    });
  }, [posts, tabTahun, handlerFilter, accountFilter]);

  /**
   * Akaun yang benar-benar ada video dalam tahun ini — satu lajur bagi
   * setiap satu dalam jadual pecahan bulanan. Disusun ikut jumlah video
   * supaya akaun paling aktif berada di kiri.
   */
  const akaunBulanan = useMemo(() => {
    const kira = new Map<string, number>();
    perBulan.forEach((b) =>
      Object.entries(b.ikutAkaun).forEach(([akaun, v]) =>
        kira.set(akaun, (kira.get(akaun) ?? 0) + v)
      )
    );
    return Array.from(kira.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([akaun]) => akaun);
  }, [perBulan]);

  const jumlahTahun = useMemo(
    () =>
      perBulan.reduce<Ringkasan>((a, b) => {
        const ikutAkaun = { ...a.ikutAkaun };
        Object.entries(b.ikutAkaun).forEach(([akaun, v]) => {
          ikutAkaun[akaun] = (ikutAkaun[akaun] ?? 0) + v;
        });
        return {
          video: a.video + b.video,
          views: a.views + b.views,
          likes: a.likes + b.likes,
          comments: a.comments + b.comments,
          shares: a.shares + b.shares,
          ikutAkaun,
        };
      }, kosong()),
    [perBulan]
  );

  const maxBulanViews = Math.max(1, ...perBulan.map((b) => b.views));

  const totalViews = filtered.reduce((s, p) => s + p.views, 0);
  const totalLikes = filtered.reduce((s, p) => s + p.likes, 0);
  const totalComments = filtered.reduce((s, p) => s + p.comments, 0);
  const totalShares = filtered.reduce((s, p) => s + p.shares, 0);
  const avgViews =
    filtered.length > 0 ? Math.round(totalViews / filtered.length) : 0;

  // Engagement = jumlah interaksi (like + komen + share) berbanding tontonan
  const totalEngagement = totalLikes + totalComments + totalShares;
  const engagementRate =
    totalViews > 0 ? (totalEngagement / totalViews) * 100 : 0;

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

  /** Leaderboard akaun — untuk podium beranimasi. */
  const podiumAkaun = useMemo<PodiumItem[]>(
    () =>
      perAccount
        .filter((a) => a.views > 0)
        .map((a, i) => ({
          id: a.account,
          rank: i + 1,
          name: a.account,
          deptCode: `${a.posts} video`,
          value: a.views,
          valueLabel: nf(a.views),
        })),
    [perAccount]
  );

  /**
   * Konten paling BERKESAN = kadar engagement tertinggi
   * (like + komen + share) / tontonan.
   *
   * Video bertontonan sangat rendah dibuang dahulu. Tanpa had ini, satu video
   * 5 tontonan dengan 1 like akan menunjukkan 20% dan mengalahkan video
   * 10,000 tontonan dengan 300 interaksi (3%) — padahal video kedua jauh
   * lebih berkesan. Had ditetapkan pada 10% purata tontonan (minimum 50)
   * dan dipaparkan kepada pengguna supaya telus.
   */
  const hadTontonan = useMemo(
    () => Math.max(50, Math.round(avgViews * 0.1)),
    [avgViews]
  );

  const topBerkesan = useMemo(() => {
    const layak = filtered
      .filter((p) => p.views >= hadTontonan)
      .map((p) => {
        const interaksi = p.likes + p.comments + p.shares;
        return { post: p, interaksi, kadar: (interaksi / p.views) * 100 };
      })
      .filter((x) => x.interaksi > 0)
      .sort((a, b) => b.kadar - a.kadar);
    return layak.slice(0, 5);
  }, [filtered, hadTontonan]);

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
          {mod === "tahun"
            ? ` · sepanjang tahun ${yearFilter || ""}`.trimEnd()
            : monthFilter
            ? ` · ${monthFilter}`
            : " · semua bulan"}
        </p>
        <p className="mt-1 text-5xl font-black text-white">{nf(totalViews)}</p>
        <p className="mt-2 text-sm text-slate-400">
          <span className="font-bold text-white">{filtered.length}</span> video ·
          purata <span className="font-bold text-white">{nf(avgViews)}</span>{" "}
          tontonan setiap video
        </p>
      </motion.div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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

        <motion.div
          {...cardMotion}
          transition={{ ...cardMotion.transition, delay: 0.18 }}
          className="rounded-2xl border border-masdora-olive/35 bg-gradient-to-br from-masdora-olive/25 to-masdora-olive/5 p-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Engagement
            </span>
            <span aria-hidden>📈</span>
          </div>
          <p className="mt-2 text-2xl font-black text-white">
            {totalViews > 0 ? `${engagementRate.toFixed(2)}%` : "—"}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {nf(totalEngagement)} interaksi / {nf(totalViews)} tontonan
          </p>
        </motion.div>
      </div>

      <motion.div {...cardMotion} className="card flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Tempoh</label>
          <div className="flex gap-2">
            {(
              [
                { k: "bulan" as Mod, l: "Satu Bulan" },
                { k: "tahun" as Mod, l: "Setahun" },
              ]
            ).map((t) => (
              <button
                key={t.k}
                onClick={() => setMod(t.k)}
                className={mod === t.k ? "pill pill-oren" : "pill pill-kosong"}
              >
                {t.l}
              </button>
            ))}
          </div>
        </div>
        {tahunAda.length > 0 && (
          <div>
            <label className="label">Tahun</label>
            <select
              className="input"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
            >
              {tahunAda.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label">Bulan</label>
          <select
            className="input"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            disabled={mod === "tahun"}
          >
            <option value="">Semua Bulan</option>
            {tabTahun.map((t) => (
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

      {/* ---------- Pecahan setiap bulan + jumlah setahun ---------- */}
      {perBulan.length > 0 && (
        <motion.div {...cardMotion} className="card">
          <div className="mb-3">
            <h3 className="font-semibold text-white">
              📅 Pecahan Bulanan{tahunAda.length > 0 ? ` ${yearFilter}` : ""}
            </h3>
            <p className="text-xs text-muted">
              Tontonan, like, komen dan share setiap bulan, dengan bilangan
              video dipecahkan mengikut akaun dan jumlah setahun di baris
              terakhir.
              {handlerFilter ? ` Hanya ${handlerFilter}.` : ""}
              {accountFilter ? ` Akaun ${accountFilter}.` : ""}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="py-2 pr-3 font-bold">Bulan</th>
                  <th className="py-2 pr-3 text-right font-bold">Video</th>
                  {akaunBulanan.map((a) => (
                    <th
                      key={a}
                      className="py-2 pr-3 text-right font-bold text-slate-500"
                      title={`Bilangan video ${a}`}
                    >
                      {a}
                    </th>
                  ))}
                  <th className="py-2 pr-3 text-right font-bold">Tontonan</th>
                  <th className="py-2 pr-3 text-right font-bold">Like</th>
                  <th className="py-2 pr-3 text-right font-bold">Komen</th>
                  <th className="py-2 pr-3 text-right font-bold">Share</th>
                  <th className="py-2 text-right font-bold">Engagement</th>
                </tr>
              </thead>
              <tbody>
                {perBulan.map((b) => {
                  const interaksi = b.likes + b.comments + b.shares;
                  const kadar = b.views > 0 ? (interaksi / b.views) * 100 : 0;
                  const aktif = mod === "bulan" && monthFilter === b.tab;
                  return (
                    <tr
                      key={b.tab}
                      className={`border-b border-white/5 ${
                        aktif ? "bg-masdora-orange/10" : ""
                      }`}
                    >
                      <td className="py-2 pr-3">
                        <button
                          onClick={() => {
                            setMod("bulan");
                            setMonthFilter(b.tab);
                          }}
                          className="text-left font-semibold text-white hover:text-amber-200"
                        >
                          {b.tab}
                        </button>
                        {/* Bar perbandingan tontonan antara bulan */}
                        <div className="mt-1 h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-white/5">
                          <div
                            className="h-full rounded-full bg-masdora-orange"
                            style={{
                              width: `${(b.views / maxBulanViews) * 100}%`,
                            }}
                          />
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-right font-semibold text-slate-200">
                        {nf(b.video)}
                      </td>
                      {akaunBulanan.map((a) => {
                        const v = b.ikutAkaun[a] ?? 0;
                        return (
                          <td
                            key={a}
                            className={`py-2 pr-3 text-right ${
                              v > 0 ? "text-slate-400" : "text-slate-700"
                            }`}
                          >
                            {v > 0 ? nf(v) : "—"}
                          </td>
                        );
                      })}
                      <td className="py-2 pr-3 text-right font-bold text-white">
                        {nf(b.views)}
                      </td>
                      <td className="py-2 pr-3 text-right text-slate-300">
                        {nf(b.likes)}
                      </td>
                      <td className="py-2 pr-3 text-right text-slate-300">
                        {nf(b.comments)}
                      </td>
                      <td className="py-2 pr-3 text-right text-slate-300">
                        {nf(b.shares)}
                      </td>
                      <td className="py-2 text-right text-slate-300">
                        {b.views > 0 ? `${kadar.toFixed(2)}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-masdora-orange/40 bg-white/5">
                  <td className="py-2 pr-3 font-black text-white">
                    JUMLAH SETAHUN
                    {tahunAda.length > 0 ? ` ${yearFilter}` : ""}
                  </td>
                  <td className="py-2 pr-3 text-right font-bold text-white">
                    {nf(jumlahTahun.video)}
                  </td>
                  {akaunBulanan.map((a) => (
                    <td
                      key={a}
                      className="py-2 pr-3 text-right font-bold text-slate-300"
                    >
                      {nf(jumlahTahun.ikutAkaun[a] ?? 0)}
                    </td>
                  ))}
                  <td className="py-2 pr-3 text-right font-black text-amber-200">
                    {nf(jumlahTahun.views)}
                  </td>
                  <td className="py-2 pr-3 text-right font-bold text-white">
                    {nf(jumlahTahun.likes)}
                  </td>
                  <td className="py-2 pr-3 text-right font-bold text-white">
                    {nf(jumlahTahun.comments)}
                  </td>
                  <td className="py-2 pr-3 text-right font-bold text-white">
                    {nf(jumlahTahun.shares)}
                  </td>
                  <td className="py-2 text-right font-bold text-white">
                    {jumlahTahun.views > 0
                      ? `${(
                          ((jumlahTahun.likes +
                            jumlahTahun.comments +
                            jumlahTahun.shares) /
                            jumlahTahun.views) *
                          100
                        ).toFixed(2)}%`
                      : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Tekan nama bulan untuk melihat butiran bulan itu sahaja.
          </p>
        </motion.div>
      )}

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
          {/* ---------- Leaderboard Akaun (podium) ---------- */}
          {podiumAkaun.length > 0 && (
            <motion.div {...cardMotion} className="card">
              <div className="mb-2">
                <h3 className="font-semibold text-white">
                  🏆 Leaderboard Akaun
                </h3>
                <p className="text-xs text-muted">
                  Akaun paling tinggi jumlah tontonan
                  {monthFilter ? ` bagi ${monthFilter}` : ""}.
                </p>
              </div>
              <SalesPodium
                items={podiumAkaun}
                bare
                emptyMessage="Tiada tontonan direkod untuk tapisan ini."
              />
            </motion.div>
          )}

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
              <div className="mb-3">
                <h3 className="font-semibold text-white">
                  🥇 Leaderboard Konten — Tontonan Tertinggi
                </h3>
                <p className="text-xs text-muted">
                  Video yang paling banyak ditonton.
                </p>
              </div>
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

          {/* ---------- Leaderboard Konten Paling Berkesan ---------- */}
          <motion.div {...cardMotion} className="card">
            <div className="mb-3">
              <h3 className="font-semibold text-white">
                ⚡ Leaderboard Konten — Paling Berkesan
              </h3>
              <p className="text-xs text-muted">
                Bukan yang paling banyak tontonan, tetapi yang paling banyak
                penonton bertindak (like + komen + share berbanding tontonan).
              </p>
            </div>

            {topBerkesan.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/15 p-3 text-center text-xs text-muted">
                Belum cukup data. Video perlu sekurang-kurangnya{" "}
                {nf(hadTontonan)} tontonan dan ada interaksi untuk dikira.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  {topBerkesan.map((x, i) => (
                    <div
                      key={`${x.post.monthTab}-${x.post.rowIndex}`}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                    >
                      <span
                        className={`w-5 text-center text-sm font-bold ${
                          i === 0 ? "text-masdora-orange" : "text-slate-500"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-100">
                          {x.post.contentType || "(tiada tajuk)"}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">
                          {x.post.account} · {nf(x.post.views)} tontonan ·{" "}
                          {nf(x.interaksi)} interaksi
                        </p>
                        <div className="mt-1.5 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-white/10">
                          <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-masdora-olive to-masdora-olive/60"
                            initial={{ width: 0 }}
                            animate={{
                              width: `${Math.min(
                                100,
                                (x.kadar / (topBerkesan[0]?.kadar || 1)) * 100
                              )}%`,
                            }}
                            transition={{
                              duration: 0.7,
                              delay: i * 0.08,
                              ease: "easeOut",
                            }}
                          />
                        </div>
                      </div>
                      {x.post.videoLink && (
                        <a
                          href={x.post.videoLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 text-xs font-semibold text-brand-400 hover:underline"
                        >
                          Buka ↗
                        </a>
                      )}
                      <span className="flex-shrink-0 text-right">
                        <span className="block text-sm font-black text-masdora-olive">
                          {x.kadar.toFixed(2)}%
                        </span>
                        <span className="block text-[10px] text-slate-500">
                          engagement
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 border-t border-white/5 pt-2 text-[11px] text-slate-500">
                  Hanya video dengan sekurang-kurangnya{" "}
                  <strong className="text-slate-400">
                    {nf(hadTontonan)} tontonan
                  </strong>{" "}
                  dikira, supaya video bertontonan sangat rendah tidak menang
                  hanya kerana ada satu like. Purata keseluruhan:{" "}
                  <strong className="text-slate-400">
                    {engagementRate.toFixed(2)}%
                  </strong>
                  .
                </p>
              </>
            )}
          </motion.div>

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
