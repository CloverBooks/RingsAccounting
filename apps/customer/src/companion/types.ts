/**
 * Companion Control Tower — Shared Types
 *
 * All data shapes used across the tower surface.
 * Backend contracts live here so every component agrees on the shape.
 */

// ─── Surface Keys ────────────────────────────────────────────────────────────
export type SurfaceKey = "receipts" | "invoices" | "books" | "banking";

// ─── Focus Mode ──────────────────────────────────────────────────────────────
export type FocusMode = "all_clear" | "watchlist" | "fire_drill";

// ─── Radar ───────────────────────────────────────────────────────────────────
export type RadarAxis = {
  key: "cash_reconciliation" | "revenue_invoices" | "expenses_receipts" | "tax_compliance";
  label: string;
  score: number; // 0..100
  open_issues: number;
};

// ─── Coverage ────────────────────────────────────────────────────────────────
export type Coverage = {
  key: SurfaceKey;
  coverage_percent: number; // 0..100
  total_items: number;
  covered_items: number;
};

// ─── Playbook ────────────────────────────────────────────────────────────────
export type PlaybookItem = {
  id: string;
  title: string;
  description?: string;
  severity: "low" | "medium" | "high";
  surface?: SurfaceKey;
  url?: string;
  premium?: boolean;
};

// ─── Close Readiness ─────────────────────────────────────────────────────────
export type CloseReadiness = {
  status: "ready" | "not_ready";
  period_label: string;
  progress_percent: number;
  blockers: Array<{
    id: string;
    title: string;
    surface?: SurfaceKey;
    url?: string;
    severity: "medium" | "high";
  }>;
};

// ─── LLM Subtitles ──────────────────────────────────────────────────────────
export type LlmSubtitle = {
  surface: SurfaceKey;
  subtitle: string;
  source: "ai" | "auto";
};

// ─── Finance Snapshot ────────────────────────────────────────────────────────
export type FinanceSnapshot = {
  ending_cash: number;
  monthly_burn: number;
  runway_months: number;
  months: Array<{ m: string; rev: number; exp: number }>;
  ar_buckets: Array<{ bucket: string; amount: number }>;
  total_overdue: number;
};

// ─── Tax Guardian ────────────────────────────────────────────────────────────
export type TaxGuardian = {
  period_key: string;
  net_tax: Array<{ jurisdiction: string; amount: number }>;
  anomaly_counts: { low: number; medium: number; high: number };
};

// ─── Voice ───────────────────────────────────────────────────────────────────
export type Voice = {
  greeting: string;
  focus_mode: FocusMode;
  tone_tagline: string;
  primary_call_to_action: string;
};

// ─── Summary (top-level API response shape) ──────────────────────────────────
export type Summary = {
  ai_companion_enabled: boolean;
  generated_at: string;
  voice: Voice;
  radar: RadarAxis[];
  coverage: Coverage[];
  playbook: PlaybookItem[];
  close_readiness: CloseReadiness;
  llm_subtitles: LlmSubtitle[];
  finance_snapshot: FinanceSnapshot;
  tax_guardian: TaxGuardian;
};

// ─── Proposals ───────────────────────────────────────────────────────────────
export type Proposal = {
  id: string;
  surface: SurfaceKey;
  title: string;
  description: string;
  amount?: number;
  risk: "ready" | "review" | "needs_attention";
  customer_action_kind?: "apply" | "review" | "info";
  risk_level?: "low" | "medium" | "high";
  preview_effects?: string[];
  source_agent?: string | null;
  created_at: string;
  target_url?: string;
};

// ─── Issues ──────────────────────────────────────────────────────────────────
export type Issue = {
  id: string;
  surface: SurfaceKey;
  title: string;
  description?: string;
  severity: "low" | "medium" | "high";
  created_at: string;
  target_url?: string;
};
