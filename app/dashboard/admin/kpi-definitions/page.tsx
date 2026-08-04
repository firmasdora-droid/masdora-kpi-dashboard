"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  KpiDefinition,
  KpiDirection,
  VKpiPending,
} from "@/types/database";

const DIRECTIONS: KpiDirection[] = ["up", "down"];

export default function KpiDefinitionsPage() {
  const supabase = createClient();
  const [definitions, setDefinitions] = useState<KpiDefinition[]>([]);
  const [pending, setPending] = useState<VKpiPending[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: defs }, { data: pendingRows }] = await Promise.all([
      supabase
        .from("kpi_definitions")
        .select("*")
        .eq("status", "active")
        .order("position_code")
        .order("sort_order"),
      supabase.from("v_kpi_pending").select("*").order("id"),
    ]);
    setDefinitions((defs as KpiDefinition[]) ?? []);
    setPending((pendingRows as VKpiPending[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, KpiDefinition[]>();
    for (const d of definitions) {
      const list = map.get(d.position_code) ?? [];
      list.push(d);
      map.set(d.position_code, list);
    }
    return Array.from(map.entries());
  }, [definitions]);

  async function handleFieldUpdate(
    id: string,
    patch: Partial<
      Pick<KpiDefinition, "default_target" | "weight" | "direction" | "active">
    >
  ) {
    setMessage(null);
    const { error } = await supabase
      .from("kpi_definitions")
      .update(patch)
      .eq("id", id);
    if (error) {
      setMessage("Gagal mengemas kini: " + error.message);
      return;
    }
    load();
  }

  async function handleApprove(id: string) {
    setMessage(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("kpi_definitions")
      .update({
        status: "active",
        approved_by: user?.id ?? null,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      setMessage("Gagal meluluskan: " + error.message);
      return;
    }
    load();
  }

  async function handleReject(id: string) {
    setMessage(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("kpi_definitions")
      .update({
        status: "rejected",
        approved_by: user?.id ?? null,
        approved_at: new Date().toISOString(),
        rejection_reason: rejectReason[id] ?? "",
      })
      .eq("id", id);
    if (error) {
      setMessage("Gagal menolak: " + error.message);
      return;
    }
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-brand-800">Definisi KPI</h2>
        <p className="text-sm text-gray-500">
          Urus sasaran lalai, berat, arah, status aktif, serta lulus/tolak
          cadangan KPI baru.
        </p>
      </div>

      {message && <p className="text-sm text-red-600">{message}</p>}

      <div>
        <h3 className="mb-2 font-semibold text-brand-800">
          Menunggu Kelulusan
        </h3>
        {pending.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            Tiada cadangan KPI menunggu kelulusan.
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((p) => (
              <div key={p.id} className="card">
                <p className="font-semibold text-brand-800">
                  {p.name} ({p.id}) - {p.position_code}
                </p>
                <p className="text-xs text-gray-500">
                  Dicadangkan oleh {p.proposed_by_name ?? "-"} untuk{" "}
                  {p.proposed_for_name ?? "-"}
                </p>
                {p.description && (
                  <p className="mt-1 text-sm text-gray-600">
                    {p.description}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    className="btn-primary"
                    onClick={() => handleApprove(p.id)}
                  >
                    Lulus
                  </button>
                  <input
                    className="input w-64"
                    placeholder="Sebab penolakan (jika ditolak)"
                    value={rejectReason[p.id] ?? ""}
                    onChange={(e) =>
                      setRejectReason({
                        ...rejectReason,
                        [p.id]: e.target.value,
                      })
                    }
                  />
                  <button
                    className="btn-secondary"
                    onClick={() => handleReject(p.id)}
                  >
                    Tolak
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 font-semibold text-brand-800">
          Definisi KPI Aktif
        </h3>
        {loading ? (
          <p className="text-sm text-gray-500">Memuatkan...</p>
        ) : (
          grouped.map(([positionCode, defs]) => (
            <div key={positionCode} className="card mb-4">
              <h4 className="mb-3 font-semibold text-brand-700">
                {positionCode}
              </h4>
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th>Kumpulan</th>
                      <th>Unit</th>
                      <th>Sasaran Lalai</th>
                      <th>Berat</th>
                      <th>Arah</th>
                      <th>Aktif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {defs.map((d) => (
                      <tr key={d.id}>
                        <td>{d.name}</td>
                        <td>{d.kpi_group}</td>
                        <td>{d.unit}</td>
                        <td>
                          <input
                            type="number"
                            className="input w-24"
                            defaultValue={d.default_target}
                            onBlur={(e) =>
                              handleFieldUpdate(d.id, {
                                default_target: Number(e.target.value),
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="input w-16"
                            defaultValue={d.weight}
                            onBlur={(e) =>
                              handleFieldUpdate(d.id, {
                                weight: Number(e.target.value),
                              })
                            }
                          />
                        </td>
                        <td>
                          <select
                            className="input"
                            defaultValue={d.direction}
                            onChange={(e) =>
                              handleFieldUpdate(d.id, {
                                direction: e.target.value as KpiDirection,
                              })
                            }
                          >
                            {DIRECTIONS.map((dir) => (
                              <option key={dir} value={dir}>
                                {dir}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            defaultChecked={d.active}
                            onChange={(e) =>
                              handleFieldUpdate(d.id, {
                                active: e.target.checked,
                              })
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
