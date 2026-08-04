// Jenis TypeScript untuk setiap jadual & view dalam skema Supabase Masdora KPI Dashboard.
// Nama medan & jenis mesti sepadan dengan schema-untuk-supabase.sql — jangan reka kolum baru.

export type UserRole = "ceo" | "manager" | "member";
export type KpiDirection = "up" | "down";
export type KpiUnit = "num" | "pct" | "rm" | "min" | "score";
export type CampaignType = "double_date" | "mid_month" | "pay_day" | "other";
export type CampaignStatus = "perancangan" | "berjalan" | "selesai" | "tunda";
export type TodoStatus = "belum" | "proses" | "tangguh" | "siap";
export type TodoPriority = "tinggi" | "sederhana" | "rendah";
export type KpiStatus = "active" | "pending_approval" | "rejected";
export type SalePlatform =
  | "live"
  | "marketplace"
  | "whatsapp"
  | "web"
  | "walkin";
export type SaleLookupType = "team" | "host" | "account";
export type KpiStatusColor = "kosong" | "hijau" | "kuning" | "oren" | "merah";

export interface Department {
  code: string;
  name: string;
  short_name: string;
  color: string;
  sort_order: number;
}

export interface Position {
  code: string;
  name: string;
  dept_code: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  position_code: string | null;
  dept_code: string | null;
  active: boolean;
  photo_url: string | null;
  phone: string | null;
  bio: string | null;
  joined_at: string | null;
  created_at: string;
}

export interface KpiDefinition {
  id: string;
  position_code: string;
  kpi_group: string;
  name: string;
  unit: KpiUnit;
  default_target: number;
  weight: number;
  direction: KpiDirection;
  active: boolean;
  sort_order: number;
  status: KpiStatus;
  description: string | null;
  proposed_by: string | null;
  proposed_for: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
}

export interface KpiTarget {
  id: number;
  user_id: string;
  kpi_id: string;
  year: number;
  month: number;
  week: number;
  target: number;
  set_by: string | null;
  updated_at: string;
}

export interface KpiEntry {
  id: number;
  user_id: string;
  kpi_id: string;
  year: number;
  month: number;
  week: number;
  actual: number | null;
  remark: string | null;
  updated_by: string | null;
  updated_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  manager_note: string | null;
  client_id: string | null;
}

export interface Todo {
  id: number;
  user_id: string;
  year: number;
  month: number;
  week: number;
  title: string;
  tag: string | null;
  priority: TodoPriority;
  status: TodoStatus;
  pct: number;
  note: string | null;
  day: string | null;
  sort_order: number;
  created_at: string;
  done_at: string | null;
  client_id: string | null;
}

export interface WeeklySubmission {
  id: number;
  user_id: string;
  year: number;
  month: number;
  week: number;
  notes: string | null;
  submitted_at: string | null;
  on_time: boolean;
  client_id: string | null;
}

export interface Campaign {
  id: number;
  year: number;
  month: number;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  progress: number;
  owner_id: string | null;
  notes: string | null;
  created_at: string;
  client_id: string | null;
}

export interface AuditLog {
  id: number;
  actor_id: string | null;
  action: string;
  entity: string | null;
  note: string | null;
  at: string;
}

export interface PendingInvite {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  position_code: string | null;
  dept_code: string | null;
  role: UserRole;
  code: string;
  temp_password: string;
  created_by: string | null;
  created_at: string;
  used_at: string | null;
  client_id: string | null;
}

export interface Sale {
  id: number;
  user_id: string;
  date: string;
  amount_rm: number;
  platform: SalePlatform;
  note: string | null;
  created_by: string | null;
  client_id: string | null;
  created_at: string;
  updated_at: string;
  team: string | null;
  host_name: string | null;
  live_account: string | null;
  session_start: string | null;
  session_end: string | null;
}

export interface SalesTarget {
  id: number;
  user_id: string;
  year: number;
  month: number;
  target_rm: number;
  updated_at: string;
}

export interface SaleLookup {
  id: number;
  type: SaleLookupType;
  name: string;
  client_id: string | null;
  created_at: string;
}

// ============ VIEWS ============

export interface VKpiProgress {
  id: number;
  user_id: string;
  full_name: string;
  position_code: string | null;
  dept_code: string | null;
  kpi_id: string;
  kpi_name: string;
  kpi_group: string;
  unit: KpiUnit;
  weight: number;
  direction: KpiDirection;
  year: number;
  month: number;
  week: number;
  target: number;
  actual: number | null;
  remark: string | null;
  updated_at: string;
  pct: number | null;
}

export interface VKpiStatus extends VKpiProgress {
  status: KpiStatusColor;
}

export interface VWeeklyScore {
  user_id: string;
  full_name: string;
  position_code: string | null;
  dept_code: string | null;
  year: number;
  month: number;
  week: number;
  kpi_score: number | null;
  kpi_achieved: number;
  kpi_filled: number;
}

export interface VLeaderboard extends VWeeklyScore {
  on_time: boolean | null;
  submitted_at: string | null;
  total_score: number;
  rank: number;
}

export interface VDeptSummary {
  year: number;
  month: number;
  week: number;
  dept_code: string | null;
  avg_score: number | null;
  headcount: number;
  total_achieved: number;
}

export interface VWeekSummary {
  user_id: string;
  year: number;
  month: number;
  week: number;
  total: number;
  siap: number;
  proses: number;
  tangguh: number;
  belum: number;
  pct: number | null;
  notes: string | null;
  submitted_at: string | null;
  on_time: boolean | null;
}

export interface VSalesMonthly {
  user_id: string;
  month_start: string;
  year: number;
  month: number;
  total_rm: number;
  entries: number;
}

export interface VKpiPending extends KpiDefinition {
  proposed_by_name: string | null;
  proposed_for_name: string | null;
}
