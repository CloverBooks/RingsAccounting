import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CompanionControlTowerPage from "./CompanionControlTowerPage";
import { AuthProvider } from "../contexts/AuthContext";

const summaryPayload = {
  ai_companion_enabled: true,
  voice: { greeting: "Hello", focus_mode: "watchlist", tone_tagline: "Your books need attention.", primary_call_to_action: "Review open items." },
  radar: {
    cash_reconciliation: { score: 90, open_issues: 1 },
    revenue_invoices: { score: 95, open_issues: 0 },
    expenses_receipts: { score: 80, open_issues: 2 },
    tax_compliance: { score: 100, open_issues: 0 },
  },
  coverage: {
    receipts: { coverage_percent: 90, total_items: 10, covered_items: 9 },
    invoices: { coverage_percent: 95, total_items: 20, covered_items: 19 },
    banking: { coverage_percent: 88, total_items: 25, covered_items: 22 },
    books: { coverage_percent: 100, total_items: 5, covered_items: 5 },
  },
  playbook: [{ label: "Review receipts", severity: "medium", surface: "receipts" }],
  close_readiness: { status: "not_ready", period_label: "Jan 2025", progress_percent: 70, blocking_items: [] },
  llm_subtitles: {},
  finance_snapshot: {
    ending_cash: 45000, monthly_burn: 8000, runway_months: 5.6,
    months: [], ar_buckets: [], total_overdue: 1200,
  },
  tax: { period_key: "2025-01", net_tax: 0, anomaly_counts: { low: 0, medium: 0, high: 0 } },
};

const enginePayload = {
  generated_at: "2025-01-05T00:00:00Z",
  mode: "drafts",
  trust_score: 78,
  stats: {
    ready: 2, needs_attention: 1, waiting_approval: 0,
    applied_last_day: 4, dismissed_last_day: 1, breaker_events_last_day: 1,
  },
  ready_queue: [],
  needs_attention_queue: [],
  job_totals: { queued: 3, running: 1, blocked: 0, failed: 0, succeeded: 5, canceled: 0 },
  job_by_agent: [],
  top_blockers: [],
};

const engineStatusPayload = {
  ok: true, tenant_id: 1, mode: "drafts",
  breakers: { recent: 1, ok: false },
  budgets: { tokens_per_day: 100000, tool_calls_per_day: 500, runs_per_day: 200 },
  last_tick_at: "2025-01-05T00:00:00Z",
  last_materialized_at: "2025-01-05T00:00:00Z",
  engine_version: "v1",
  mock_mode: { llm: "mock", tools: "mock" },
};

describe("CompanionControlTowerPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/agentic/companion/summary")) {
        return Promise.resolve(new Response(JSON.stringify(summaryPayload)));
      }
      if (url.includes("/api/companion/v2/shadow-events")) {
        return Promise.resolve(new Response(JSON.stringify({ events: [] })));
      }
      if (url.includes("/api/agentic/companion/issues")) {
        return Promise.resolve(new Response(JSON.stringify({ issues: [] })));
      }
      if (url.includes("/api/companion/cockpit/queues")) {
        return Promise.resolve(new Response(JSON.stringify({ data: enginePayload, source: "snapshot", stale: false })));
      }
      if (url.includes("/api/companion/cockpit/status")) {
        return Promise.resolve(new Response(JSON.stringify(engineStatusPayload)));
      }
      if (url.includes("/api/agentic/receipts/run")) {
        return Promise.resolve(new Response(JSON.stringify({ run_id: 42 })));
      }
      if (url.includes("/api/auth/config")) {
        return Promise.resolve(new Response(JSON.stringify({ csrfToken: "test-csrf" })));
      }
      return Promise.resolve(new Response("{}"));
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders control tower with key sections", async () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <CompanionControlTowerPage />
        </MemoryRouter>
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText(/Receipt Intake/i)).toBeInTheDocument(), { timeout: 10000 });
    expect(screen.getByText(/Health Pulse/i)).toBeInTheDocument();
    expect(screen.getByText(/Today's Focus/i)).toBeInTheDocument();
    expect(screen.getByText(/Books \+ Bank Audit/i)).toBeInTheDocument();
    expect(screen.getByText(/Receipt Intake/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Receipts/i).length).toBeGreaterThan(0);
  }, 15000);

  it("shows disabled banner when ai_companion_enabled is false", async () => {
    (globalThis.fetch as any) = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/agentic/companion/summary")) {
        return Promise.resolve(new Response(JSON.stringify({ ...summaryPayload, ai_companion_enabled: false })));
      }
      if (url.includes("/api/companion/cockpit/queues")) {
        return Promise.resolve(new Response(JSON.stringify({ data: enginePayload, source: "snapshot", stale: false })));
      }
      if (url.includes("/api/companion/cockpit/status")) {
        return Promise.resolve(new Response(JSON.stringify(engineStatusPayload)));
      }
      return Promise.resolve(new Response("{}"));
    }) as unknown as typeof fetch;

    render(
      <AuthProvider>
        <MemoryRouter>
          <CompanionControlTowerPage />
        </MemoryRouter>
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText(/currently disabled/i)).toBeInTheDocument());
  });

  it("renders engine card", async () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <CompanionControlTowerPage />
        </MemoryRouter>
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText(/Autonomy Engine/i)).toBeInTheDocument());
  });

  it("shows error state when summary API fails", async () => {
    (globalThis.fetch as any) = vi.fn(() =>
      Promise.resolve(new Response("Internal Server Error", { status: 500 }))
    ) as unknown as typeof fetch;

    render(
      <AuthProvider>
        <MemoryRouter>
          <CompanionControlTowerPage />
        </MemoryRouter>
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText(/couldn't load/i)).toBeInTheDocument());
    expect(screen.getByText(/Try again/i)).toBeInTheDocument();
  });

  it("handles drifted payload shape gracefully", async () => {
    (globalThis.fetch as any) = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/agentic/companion/summary")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ai_companion_enabled: true,
              voice: { greeting: "Hello", focus_mode: "watchlist" },
              radar: {
                cash_reconciliation: { score: 90, open_issues: 0 },
                revenue_invoices: { score: 95, open_issues: 0 },
                expenses_receipts: { score: 92, open_issues: 0 },
                tax_compliance: { score: 100, open_issues: 0 },
              },
              coverage: {},
              playbook: { label: "Unexpected object" },
              close_readiness: { status: "not_ready", blocking_reasons: "single-string" },
              llm_subtitles: [],
              finance_snapshot: { months: {}, ar_buckets: {} },
              tax: { period_key: "2025-01", net_tax: 0, anomaly_counts: { low: 0, medium: 0, high: 0 } },
            })
          )
        );
      }
      if (url.includes("/api/companion/cockpit/queues")) {
        return Promise.resolve(new Response(JSON.stringify({ data: enginePayload, source: "snapshot", stale: false })));
      }
      if (url.includes("/api/companion/cockpit/status")) {
        return Promise.resolve(new Response(JSON.stringify(engineStatusPayload)));
      }
      return Promise.resolve(new Response("{}"));
    }) as unknown as typeof fetch;

    render(
      <AuthProvider>
        <MemoryRouter>
          <CompanionControlTowerPage />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText(/Companion couldn't load/i)).toBeInTheDocument());
  });
});
