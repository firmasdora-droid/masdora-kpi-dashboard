"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getCurrentYear,
  getCurrentMonth,
  getCurrentWeekOfMonth,
  monthName,
} from "@/lib/period";
import WeekPicker, { WeekValue } from "@/components/WeekPicker";
import { SALE_ELIGIBLE_POSITIONS } from "@/lib/roles";
import type { KpiDefinition, KpiTarget, Profile, SalesTarget } from "@/types/database";

interface TargetRow {
  kpi_id: string;
  name: string;
  unit: string;
  default_target: number;
  target: number;
}

export default function TargetsPage() {
  const supabase = createClient();
  const [meId, setMeId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [week, setWeek] = useState<WeekValue>({
    year: getCurrentYear(),
    month: getCurrentMonth(),
    week: getCurrentWeekOfMonth(),
  });
  const [rows, setRows] = useState<TargetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [salesTargetInput, setSalesTargetInput] = useState("0");
  const [savingSalesTarget, setSavingSalesTarget] = useState(false);
  const [salesMessage, setSalesMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setMeId(user.id);
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("*")
        .eq("active", true)
        .order("full_name");
      setProfiles((allProfiles as Profile[]) ?? []);
      if (allProfiles && allProfiles.length > 0) {
        setSelectedUserId((allProfiles as Profile[])[0].id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const targetProfile = useMemo(
    () => profiles.find((p) => p.id === selectedUserId) ?? null,
    [selectedUserId, profiles]
  );

  const load = useCallback(async () => {
    if (!selectedUserId || !targetProfile?.position_code) {
      setRows([]);
      return;
    }
    setLoading(true);
    setMessage(null);

    const [{ data: defs }, { data: targets }] = await Promise.all([
      supabase
        .from("kpi_definitions")
        .select("*")
        .eq("position_code", targetProfile.position_code)
        .eq("active", true)
        .eq("status", "active")
        .order("kpi_group")
        .order("sort_order"),
      supabase
        .from("kpi_targets")
        .select("*")
        .eq("user_id", selectedUserId)
        .eq("year", week.year)
        .eq("month", week.month)
        .eq("week", week.week),
    ]);

    const definitions = (defs as KpiDefinition[]) ?? [];
    const overrides = (targets as KpiTarget[]) ?? [];

    setRows(
      definitions.map((d) => {
        const override = overrides.find((t) => t.kpi_id === d.id);
        return {
          kpi_id: d.id,
          name: d.name,
          unit: d.unit,
          default_target: d.default_target,
          target: override?.target ?? d.default_target,
        };
      })
    );
    setLoading(false);
  }, [selectedUserId, targetProfile, week, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const saleEligible = !!targetProfile?.position_code &&
    (SALE_ELIGIBLE_POSITIONS as readonly string[]).includes(
      targetProfile.position_code
    );

  const loadSalesTarget = useCallback(async () => {
    if (!selectedUserId || !saleEligible) {
      setSalesTargetInput("0");
      return;
    }
    setSalesMessage(null);
    const { data } = await supabase
      .from("sales_targets")
      .select("*")
      .eq("user_id", selectedUserId)
      .eq("year", week.year)
      .eq("month", week.month)
      .maybeSingle<SalesTarget>();
    setSalesTargetInput(String(data?.target_rm ?? 0));
  }, [selectedUserId, saleEligible, week.year, week.month, supabase]);

  useEffect(() => {
    loadSalesTarget();
  }, [loadSalesTarget]);

  async function handleSaveSalesTarget() {
    if (!selectedUserId) return;
    const target_rm = Number(salesTargetInput);
    if (Number.isNaN(target_rm) || target_rm < 0) {
      setSalesMessage("Sasaran jualan mesti nombor.");
      return;
    }
    setSavingSalesTarget(true);
    setSalesMessage(null);

    const { error } = await supabase.from("sales_targets").upsert(
      {
        user_id: selectedUserId,
        year: week.year,
        month: week.month,
        target_rm,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,year,month" }
    );

    setSavingSalesTarget(false);

    if (error) {
      setSalesMessage("Gagal menyimpan sasaran jualan: " + error.message);
    } else {
      setSalesMessage("Sasaran jualan berjaya disimpan.");
      loadSalesTarget();
    }
  }

  async function handleSave(row: TargetRow, value: string) {
    if (!selectedUserId) return;
    const target = Number(value);
    if (Number.isNaN(target)) {
      setMessage("Sasaran mesti nombor.");
      return;
    }
    setSavingKey(row.kpi_id);
    setMessage(null);

    const { error } = await supabase.from("kpi_targets").upsert(
      {
        user_id: selectedUserId,
        kpi_id: row.kpi_id,
        year: week.year,
        month: week.month,
        week: week.week,
        target,
        set_by: meId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,kpi_id,year,month,week" }
    );

    setSavingKey(null);

    if (error) {
      setMessage("Gagal menyimpan sasaran: " + error.message);
    } else {
      setMessage("Sasaran berjaya disimpan.");
      load();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Tetapkan Sasaran</h2>
        <p className="text-sm text-muted">
          Tetapkan sasaran KPI khas (override) bagi setiap ahli & tempoh.
        </p>
      </div>

      <div className="card space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <WeekPicker value={week} onChange={setWeek} />
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
        </div>
        {message && <p className="text-sm text-brand-400">{message}</p>}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Memuatkan...</p>
      ) : rows.length === 0 ? (
        <div className="card text-center text-sm text-muted">
          Tiada definisi KPI untuk jawatan pengguna ini.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Nama KPI</th>
                <th>Unit</th>
                <th>Sasaran Lalai</th>
                <th>Sasaran Khas</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <TargetRowItem
                  key={row.kpi_id}
                  row={row}
                  saving={savingKey === row.kpi_id}
                  onSave={handleSave}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {saleEligible && (
        <div>
          <h3 className="mb-2 font-semibold text-white">
            Sasaran Jualan Bulanan
          </h3>
          <div className="card flex flex-wrap items-end gap-4">
            <div>
              <label className="label">Sasaran (RM) — {monthName(week.month)} {week.year}</label>
              <input
                type="number"
                step="0.01"
                min={0}
                className="input w-40"
                value={salesTargetInput}
                onChange={(e) => setSalesTargetInput(e.target.value)}
              />
            </div>
            <button
              className="btn-primary"
              disabled={savingSalesTarget}
              onClick={handleSaveSalesTarget}
            >
              {savingSalesTarget ? "Menyimpan..." : "Simpan"}
            </button>
            {salesMessage && (
              <p className="w-full text-sm text-brand-400">{salesMessage}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TargetRowItem({
  row,
  saving,
  onSave,
}: {
  row: TargetRow;
  saving: boolean;
  onSave: (row: TargetRow, value: string) => void;
}) {
  const [value, setValue] = useState(String(row.target));

  useEffect(() => {
    setValue(String(row.target));
  }, [row.target]);

  return (
    <tr>
      <td>{row.name}</td>
      <td>{row.unit}</td>
      <td>{row.default_target}</td>
      <td>
        <input
          type="number"
          className="input w-28"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </td>
      <td>
        <button
          className="btn-primary"
          disabled={saving}
          onClick={() => onSave(row, value)}
        >
          {saving ? "..." : "Simpan"}
        </button>
      </td>
    </tr>
  );
}
