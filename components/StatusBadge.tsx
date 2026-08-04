import type { KpiStatusColor } from "@/types/database";

const LABELS: Record<KpiStatusColor, string> = {
  hijau: "Capai",
  kuning: "Hampir",
  oren: "Lewat",
  merah: "Lemah",
  kosong: "Kosong",
};

export default function StatusBadge({ status }: { status: KpiStatusColor }) {
  return <span className={`pill pill-${status}`}>{LABELS[status]}</span>;
}
