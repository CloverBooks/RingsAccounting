/**
 * Companion Control Tower — Data Hook
 *
 * Centralised data-fetching hook for the tower surface.
 * Handles loading, error, and retry states cleanly.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildApiUrl, getAccessToken, fetchWithTimeout } from "@/api/client";
import {
  fetchCockpitQueues,
  fetchCockpitStatus,
  type EngineQueuesResult,
  type EngineStatusPayload,
} from "@/api/companionAutonomyApi";
import { usePermissions } from "@/hooks/usePermissions";
import { toCustomerCopy } from "./companionCopy";
import { normalizeSurfaceKey, SURFACE_URLS } from "./helpers";
import type { Summary, Proposal, Issue, SurfaceKey } from "./types";

// ─── API: Summary ────────────────────────────────────────────────────────────
async function fetchSummaryApi(): Promise<Summary> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetchWithTimeout(buildApiUrl("/api/agentic/companion/summary"), {
    credentials: "same-origin",
    headers,
  });
  if (!res.ok) throw new Error(`Summary API returned ${res.status}`);
  const data = await res.json();

  const voice = data.voice || {};
  const radar = data.radar || {};
  const coverage = data.coverage || {};
  const playbook = data.playbook || [];
  const closeReadiness = data.close_readiness || {};
  const llmSubtitles = data.llm_subtitles || {};
  const financeSnapshot = data.finance_snapshot || {};
  const taxBlock = data.tax || data.tax_guardian || {};
  const taxJurisdictions = Array.isArray(taxBlock.jurisdictions) ? taxBlock.jurisdictions : [];
  const taxNetEntries = taxJurisdictions.length
    ? taxJurisdictions.map((j: any) => ({
        jurisdiction: j.code || j.jurisdiction || "Tax",
        amount: j.net_tax ?? j.amount ?? 0,
      }))
    : taxBlock.net_tax != null
      ? [{ jurisdiction: "Net tax", amount: Number(taxBlock.net_tax) || 0 }]
      : [];

  const cashHealth = financeSnapshot.cash_health || {};
  const revenueExpense = financeSnapshot.revenue_expense || {};
  const arHealth = financeSnapshot.ar_health || {};

  const fallbackMonths = Array.isArray(revenueExpense.months)
    ? revenueExpense.months.map((m: string, i: number) => ({
        m,
        rev: revenueExpense.revenue?.[i] ?? 0,
        exp: revenueExpense.expense?.[i] ?? 0,
      }))
    : [];

  const fallbackArBuckets = arHealth.buckets
    ? Object.entries(arHealth.buckets).map(([bucket, amount]) => ({ bucket, amount: Number(amount) || 0 }))
    : [];

  return {
    ai_companion_enabled: data.ai_companion_enabled ?? true,
    generated_at: data.generated_at || new Date().toISOString(),
    voice: {
      greeting: toCustomerCopy(voice.greeting || "Hello"),
      focus_mode: voice.focus_mode || "watchlist",
      tone_tagline: toCustomerCopy(voice.tone_tagline || "Your books need attention."),
      primary_call_to_action: toCustomerCopy(voice.primary_call_to_action || "Review open items."),
    },
    radar: [
      { key: "cash_reconciliation", label: "Cash", score: radar.cash_reconciliation?.score ?? 100, open_issues: radar.cash_reconciliation?.open_issues ?? 0 },
      { key: "revenue_invoices", label: "Revenue", score: radar.revenue_invoices?.score ?? 100, open_issues: radar.revenue_invoices?.open_issues ?? 0 },
      { key: "expenses_receipts", label: "Expenses", score: radar.expenses_receipts?.score ?? 100, open_issues: radar.expenses_receipts?.open_issues ?? 0 },
      { key: "tax_compliance", label: "Tax", score: radar.tax_compliance?.score ?? 100, open_issues: radar.tax_compliance?.open_issues ?? 0 },
    ],
    coverage: [
      { key: "receipts" as SurfaceKey, coverage_percent: coverage.receipts?.coverage_percent ?? 0, total_items: coverage.receipts?.total_items ?? 0, covered_items: coverage.receipts?.covered_items ?? 0 },
      { key: "invoices" as SurfaceKey, coverage_percent: coverage.invoices?.coverage_percent ?? 0, total_items: coverage.invoices?.total_items ?? 0, covered_items: coverage.invoices?.covered_items ?? 0 },
      { key: "banking" as SurfaceKey, coverage_percent: coverage.banking?.coverage_percent ?? coverage.bank?.coverage_percent ?? 0, total_items: coverage.banking?.total_items ?? coverage.bank?.total_items ?? 0, covered_items: coverage.banking?.covered_items ?? coverage.bank?.covered_items ?? 0 },
      { key: "books" as SurfaceKey, coverage_percent: coverage.books?.coverage_percent ?? 0, total_items: coverage.books?.total_items ?? 0, covered_items: coverage.books?.covered_items ?? 0 },
    ],
    playbook: playbook.map((p: any, i: number) => ({
      id: `p${i}`,
      title: toCustomerCopy(p.label || p.title || "Action item"),
      description: toCustomerCopy(p.description || ""),
      severity: (p.severity || "medium") as "low" | "medium" | "high",
      surface: normalizeSurfaceKey(p.surface) || undefined,
      url: p.url,
      premium: p.requires_premium ?? false,
    })),
    close_readiness: {
      status: closeReadiness.status === "ready" ? "ready" : "not_ready",
      period_label: closeReadiness.period_label || "Current Period",
      progress_percent: closeReadiness.progress_percent ?? (closeReadiness.status === "ready" ? 100 : 50),
      blockers: (closeReadiness.blocking_items || closeReadiness.blocking_reasons || []).map((b: any, i: number) => ({
        id: `b${i}`,
        title: toCustomerCopy(typeof b === "string" ? b : (b.reason || b.title || "Blocker")),
        surface: normalizeSurfaceKey(b.surface) || undefined,
        severity: (b.severity || "high") as "medium" | "high",
        url: b.url,
      })),
    },
    llm_subtitles: [
      { surface: "banking" as SurfaceKey, subtitle: toCustomerCopy(llmSubtitles.bank || llmSubtitles.banking || ""), source: "ai" as const },
      { surface: "receipts" as SurfaceKey, subtitle: toCustomerCopy(llmSubtitles.receipts || ""), source: "ai" as const },
      { surface: "invoices" as SurfaceKey, subtitle: toCustomerCopy(llmSubtitles.invoices || ""), source: "ai" as const },
      { surface: "books" as SurfaceKey, subtitle: toCustomerCopy(llmSubtitles.books || ""), source: "ai" as const },
    ].filter(s => s.subtitle) as Summary["llm_subtitles"],
    finance_snapshot: {
      ending_cash: financeSnapshot.ending_cash ?? cashHealth.ending_cash ?? 0,
      monthly_burn: financeSnapshot.monthly_burn ?? cashHealth.monthly_burn ?? 0,
      runway_months: financeSnapshot.runway_months ?? cashHealth.runway_months ?? 0,
      months: financeSnapshot.months || fallbackMonths,
      ar_buckets: financeSnapshot.ar_buckets || fallbackArBuckets,
      total_overdue: financeSnapshot.total_overdue ?? arHealth.total_overdue ?? 0,
    },
    tax_guardian: {
      period_key: taxBlock.period_key || "Current Period",
      net_tax: taxNetEntries,
      anomaly_counts: {
        low: taxBlock.anomaly_counts?.low ?? 0,
        medium: taxBlock.anomaly_counts?.medium ?? 0,
        high: taxBlock.anomaly_counts?.high ?? 0,
      },
    },
  };
}

// ─── API: Proposals ──────────────────────────────────────────────────────────
function proposalSurfaceFromEvent(event: any): SurfaceKey {
  const explicit = normalizeSurfaceKey(event?.data?.surface || event?.surface || event?.domain);
  if (explicit) return explicit;
  const eventType = String(event?.event_type || "").toLowerCase();
  if (eventType.includes("bank")) return "banking";
  if (eventType.includes("categorization")) return "banking";
  return "books";
}

async function fetchProposalsApi(workspaceId?: number): Promise<Proposal[]> {
  try {
    if (!workspaceId) return [];
    const headers: Record<string, string> = { Accept: "application/json" };
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const params = new URLSearchParams({ status: "proposed", limit: "50", workspace_id: String(workspaceId) });
    const res = await fetchWithTimeout(buildApiUrl(`/api/companion/v2/shadow-events/?${params.toString()}`), {
      credentials: "same-origin",
      headers,
    });
    if (!res.ok) return [];
    const data = await res.json();
    const items = Array.isArray(data) ? data : (data?.proposals || data?.events || data?.items || []);
    if (!Array.isArray(items)) return [];
    return items.map((event: any) => {
      const surface = proposalSurfaceFromEvent(event);
      const tier = Number(event?.human_in_the_loop?.tier);
      return {
        id: event.id,
        surface,
        title: toCustomerCopy(event?.data?.title || (String(event?.event_type || "").includes("BankMatch") ? "Match a bank transaction" : "Review suggested change")),
        description: toCustomerCopy(event?.rationale || "Review the suggested change before applying."),
        amount: (() => { const n = Number(event?.data?.bank_transaction_amount ?? event?.data?.amount ?? event?.data?.total); return Number.isFinite(n) ? n : undefined; })(),
        risk: (Number.isFinite(tier) ? (tier >= 2 ? "needs_attention" : tier === 1 ? "review" : "ready") : event?.status === "proposed" ? "review" : "ready") as Proposal["risk"],
        customer_action_kind: ((event?.customer_action_kind || event?.action_kind) || (event?.status === "proposed" ? "review" : "apply")) as Proposal["customer_action_kind"],
        risk_level: (event?.risk_level || (Number.isFinite(tier) ? (tier >= 2 ? "high" : tier === 1 ? "medium" : "low") : "medium")) as Proposal["risk_level"],
        preview_effects: (() => { const e = event?.preview_effects || event?.data?.preview_effects || event?.data?.effects; return Array.isArray(e) ? e.map(String).filter(Boolean) : undefined; })(),
        source_agent: event?.agent_name || event?.agent || event?.data?.agent || event?.data?.source_agent || null,
        created_at: event.created_at || new Date().toISOString(),
        target_url: event?.data?.target_url || SURFACE_URLS[surface],
      };
    });
  } catch {
    return [];
  }
}

// ─── API: Issues ─────────────────────────────────────────────────────────────
async function fetchIssuesApi(): Promise<Issue[]> {
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetchWithTimeout(buildApiUrl("/api/agentic/companion/issues?status=open"), {
      credentials: "same-origin",
      headers,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.issues || []).map((i: any) => ({
      id: String(i.id),
      surface: normalizeSurfaceKey(i.surface) || "banking",
      title: toCustomerCopy(i.title),
      description: toCustomerCopy(i.recommended_action || i.estimated_impact || ""),
      severity: i.severity,
      created_at: i.created_at,
      target_url: i.target_url,
    }));
  } catch {
    return [];
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export type CompanionDataState = {
  summary: Summary | null;
  proposals: Proposal[];
  issues: Issue[];
  engineQueues: EngineQueuesResult | null;
  engineStatus: EngineStatusPayload | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setProposals: React.Dispatch<React.SetStateAction<Proposal[]>>;
};

export function useCompanionData(): CompanionDataState {
  const { workspace } = usePermissions();

  const [summary, setSummary] = useState<Summary | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [engineQueues, setEngineQueues] = useState<EngineQueuesResult | null>(null);
  const [engineStatus, setEngineStatus] = useState<EngineStatusPayload | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [summaryResult, proposalsResult, issuesResult, engineResult, statusResult] =
        await Promise.allSettled([
          fetchSummaryApi(),
          fetchProposalsApi(workspace?.businessId),
          fetchIssuesApi(),
          fetchCockpitQueues(),
          fetchCockpitStatus(),
        ]);

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
      } else {
        console.error("Summary fetch failed:", summaryResult.reason);
        if (!isRefresh) {
          setError("Could not load companion data. The backend may be unavailable.");
        }
      }

      setProposals(proposalsResult.status === "fulfilled" ? proposalsResult.value : []);
      setIssues(issuesResult.status === "fulfilled" ? issuesResult.value : []);

      if (engineResult.status === "fulfilled") setEngineQueues(engineResult.value);
      if (statusResult.status === "fulfilled") setEngineStatus(statusResult.value);
    } catch (e: any) {
      console.error("Companion data fetch failed:", e);
      if (!isRefresh) setError(e?.message || "Failed to load companion data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [workspace?.businessId]);

  useEffect(() => {
    let alive = true;
    fetchAll(false).then(() => {
      if (!alive) return;
    });
    return () => { alive = false; };
  }, [fetchAll]);

  const refresh = useCallback(() => fetchAll(true), [fetchAll]);

  const counts = useMemo(() => {
    if (!summary) return { totalIssues: 0, totalSuggestions: 0 };
    const totalIssues = summary.radar.reduce((acc, r) => acc + (r.open_issues || 0), 0);
    return { totalIssues, totalSuggestions: proposals.length };
  }, [summary, proposals]);

  return {
    summary,
    proposals,
    issues,
    engineQueues,
    engineStatus,
    loading,
    refreshing,
    error,
    refresh,
    setProposals,
  };
}
