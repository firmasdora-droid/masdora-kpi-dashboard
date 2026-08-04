"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import {
  getCurrentYear,
  getCurrentMonth,
  getCurrentWeekOfMonth,
} from "@/lib/period";
import { isCeo, isManager, type Role } from "@/lib/roles";
import WeekPicker, { WeekValue } from "@/components/WeekPicker";
import KpiProgressBar from "@/components/KpiProgressBar";
import StatusBadge from "@/components/StatusBadge";
import type {
  KpiDefinition,
  KpiStatusColor,
  Profile,
  VKpiStatus,
} from "@/types/database";

const cardMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const },
};

interface KpiRow {
  kpi_id: string;
  kpi_group: string;
  name: string;
  unit: string;
  weight: number;
  direction: string;
  target: number;
  actual: number | null;
  remark: string;
  pct: number | null;
  status: KpiStatusColor;
}

export default function KpiPage() {
  const supabase = createClient();

  const [meId, setMeId] = useState<string | null>(null);
  const [meProfile, setMeProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [week, setWeek] = useState<WeekValue>({
    year: getCurrentYear(),
    month: getCurrentMonth(),
    week: getCurrentWeekOfMonth(),
  });

  const [rows, setRows] = useState<KpiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Load current user profile + (for manager/ceo) list of all profiles
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setMeId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle<Profile>();

      setMeProfile(profile ?? null);
      setSelectedUserId(user.id);

      if (profile && (isManager(profile.role) || isCeo(profile.role))) {
        const { data: allProfiles } = await supabase
          .from("profiles")
          .select("*")
          .eq("active", true)
          .order("full_name");
        setProfiles((allProfiles as Profile[]) ?? []);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const targetProfile = useMemo(() => {
    if (selectedUserId === meId) return meProfile;
    return profiles.find((p) => p.id === selectedUserId) ?? null;
  }, [selectedUserId, meId, meProfile, profiles]);

  const canEdit =
    !!meProfile &&
    !isCeo(meProfile.role) &&
    (selectedUserId === meId || isManager(meProfile.role));

  const loadKpis = useCallback(async () => {
    if (!selectedUserId || !targetProfile?.position_code) {
      setRows([]);
      return;
    }
    setLoading(true);
    setMessage(null);

    const [{ data: defs }, { data: statusRows }] = await Promise.all([
      supabase
        .from("kpi_definitions")
        .select("*")
        .eq("position_code", targetProfile.position_code)
        .eq("active", true)
        .eq("status", "active")
        .order("kpi_group")
        .order("sort_order"),
      supabase
        .from("v_kpi_status")
        .select("*")
        .eq("user_id", selectedUserId)
        .eq("year", week.year)
        .eq("month", week.month)
        .eq("week", week.week),
    ]);

    const definitions = (defs as KpiDefinition[]) ?? [];
    const statuses = (statusRows as VKpiStatus[]) ?? [];

    const merged: KpiRow[] = definitions.map((d) => {
      const s = statuses.find((row) => row.kpi_id === d.id);
      return {
        kpi_id: d.id,
        kpi_group: d.kpi_group,
        name: d.name,
        unit: d.unit,
        weight: d.weight,
        direction: d.direction,
        target: s?.target ?? d.default_target,
        actual: s?.actual ?? null,
        remark: s?.remark ?? "",
        pct: s?.pct ?? null,
        status: s?.status ?? "kosong",
      };
    });

    setRows(merged);
    setLoading(false);
  }, [selectedUserId, targetProfile, week, supabase]);

  useEffect(() => {
    loadKpis();
  }, [loadKpis]);

  async function handleSave(row: KpiRow, actualStr: string, remark: string) {
    if (!selectedUserId) return;
    const actual = actualStr === "" ? null : Number(actualStr);
    if (actualStr !== "" && Number.isNaN(actual)) {
      setMessage("Nilai mesti nombor.");
      return;
    }

    setSavingKey(row.kpi_id);
    setMessage(null);

    const { error } = await supabase.from("kpi_entries").upsert(
      {
        user_id: selectedUserId,
        kpi_id: row.kpi_id,
        year: week.year,
        month: week.month,
        week: week.week,
        actual,
        remark,
        updated_by: meId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,kpi_id,year,month,week" }
    );

    setSavingKey(null);

    if (error) {
      setMessage("Gagal menyimpan: " + error.message);
    } else {
      setMessage("Berjaya disimpan.");
      loadKpis();
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, KpiRow[]>();
    for (const row of rows) {
      const list = map.get(row.kpi_group) ?? [];
      list.push(row);
      map.set(row.kpi_group, list);
    }
    return Array.from(map.entries());
  }, [rows]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">KPI</h2>
        <p className="text-sm text-muted">
          Semak dan kemas kini pencapaian KPI mengikut minggu.
        </p>
      </div>

      <motion.div {...cardMotion} className="card space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <WeekPicker value={week} onChange={setWeek} />
          {meProfile && (isManager(meProfile.role) || isCeo(meProfile.role)) && (
            <div>
              <label className="label">Pengguna</label>
              <select
                className="input"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        {message && <p className="text-sm text-brand-400">{message}</p>}
      </motion.div>

      {loading ? (
        <p className="text-sm text-muted">Memuatkan...</p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/15 p-6 text-center text-sm text-muted">
          Tiada definisi KPI untuk jawatan pengguna ini.
        </div>
      ) : (
        grouped.map(([group, groupRows], i) => (
          <motion.div
            key={group}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: i * 0.06, ease: [0.4, 0, 0.2, 1] }}
            className="card"
          >
            <h3 className="mb-3 font-semibold text-white">{group}</h3>
            <div className="space-y-4">
              {groupRows.map((row) => (
                <KpiRowItem
                  key={row.kpi_id}
                  row={row}
                  canEdit={canEdit}
                  saving={savingKey === row.kpi_id}
                  onSave={handleSave}
                />
              ))}
            </div>
          </motion.div>
        ))
      )}
    </div>
  );
}

function KpiRowItem({
  row,
  canEdit,
  saving,
  onSave,
}: {
  row: KpiRow;
  canEdit: boolean;
  saving: boolean;
  onSave: (row: KpiRow, actual: string, remark: string) => void;
}) {
  const [actual, setActual] = useState(row.actual?.toString() ?? "");
  const [remark, setRemark] = useState(row.remark ?? "");

  useEffect(() => {
    setActual(row.actual?.toString() ?? "");
    setRemark(row.remark ?? "");
  }, [row.actual, row.remark]);

  return (
    <div className="grid grid-cols-1 gap-3 border-b border-white/10 pb-4 last:border-0 last:pb-0 md:grid-cols-12 md:items-center">
      <div className="md:col-span-4">
        <p className="text-sm font-medium text-white">{row.name}</p>
        <p className="text-xs text-muted">
          Sasaran: {row.target} {row.unit} · Berat: {row.weight}
        </p>
      </div>
      <div className="md:col-span-3">
        <KpiProgressBar pct={row.pct} status={row.status} />
      </div>
      <div className="md:col-span-1">
        <StatusBadge status={row.status} />
      </div>
      <div className="md:col-span-2">
        {canEdit ? (
          <input
            type="number"
            className="input"
            value={actual}
            placeholder="Nilai sebenar"
            onChange={(e) => setActual(e.target.value)}
          />
        ) : (
          <p className="text-sm text-gray-200">{row.actual ?? "-"}</p>
        )}
      </div>
      <div className="md:col-span-2">
        {canEdit ? (
          <div className="flex gap-2">
            <input
              type="text"
              className="input"
              placeholder="Catatan"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
            />
            <button
              className="btn-primary whitespace-nowrap"
              disabled={saving}
              onClick={() => onSave(row, actual, remark)}
            >
              {saving ? "..." : "Simpan"}
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted">{row.remark || "-"}</p>
        )}
      </div>
    </div>
  );
}
