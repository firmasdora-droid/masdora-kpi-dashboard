"use client";

import { monthName } from "@/lib/period";

export interface WeekValue {
  year: number;
  month: number;
  week: number;
}

export default function WeekPicker({
  value,
  onChange,
  yearsBack = 2,
  yearsForward = 1,
}: {
  value: WeekValue;
  onChange: (value: WeekValue) => void;
  yearsBack?: number;
  yearsForward?: number;
}) {
  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: yearsBack + yearsForward + 1 },
    (_, i) => currentYear - yearsBack + i
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="label">Tahun</label>
        <select
          className="input"
          value={value.year}
          onChange={(e) =>
            onChange({ ...value, year: Number(e.target.value) })
          }
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Bulan</label>
        <select
          className="input"
          value={value.month}
          onChange={(e) =>
            onChange({ ...value, month: Number(e.target.value) })
          }
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {monthName(m)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Minggu</label>
        <select
          className="input"
          value={value.week}
          onChange={(e) =>
            onChange({ ...value, week: Number(e.target.value) })
          }
        >
          {[1, 2, 3, 4].map((w) => (
            <option key={w} value={w}>
              Minggu {w}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
