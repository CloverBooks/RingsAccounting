import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { AdminApp } from "./AdminApp";
import { AdminRoutes } from "./AdminRoutes";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../contexts/AuthContext";

vi.mock("./api", () => {
  const mockMetrics = {
    active_users_30d: 5,
    active_users_30d_change_pct: 10,
    unreconciled_transactions: 2,
    unreconciled_transactions_older_60d: 1,
    unbalanced_journal_entries: 0,
    api_error_rate_1h_pct: 0.1,
    api_p95_response_ms_1h: 120,
    ai_flagged_open_issues: 0,
    failed_invoice_emails_24h: 0,
    workspaces_health: [],
  };
  return {
    fetchOverviewMetrics: vi.fn().mockResolvedValue(mockMetrics),
    fetchBankAccounts: vi.fn().mockResolvedValue({ results: [] }),
    fetchWorkspaces: vi.fn().mockResolvedValue({ results: [] }),
    fetchUsers: vi.fn().mockResolvedValue({ results: [] }),
    fetchAuditLog: vi.fn().mockResolvedValue({ results: [] }),
    downloadAuditLogCsv: vi.fn().mockResolvedValue(new Blob(["id\n1"], { type: "text/csv" })),
    fetchSupportTickets: vi.fn().mockResolvedValue({ results: [] }),
    addSupportTicketNote: vi.fn().mockResolvedValue({}),
    createSupportTicket: vi.fn().mockResolvedValue({}),
    fetchFeatureFlags: vi.fn().mockResolvedValue([]),
    fetchRuntimeSettings: vi.fn().mockResolvedValue({
      generated_at: "2025-01-01T00:00:00Z",
      environment: {
        name: "prod",
        cors_allowed_origins: ["http://localhost:5174"],
        admin_password_reset_base_url: "https://app.cloverbooks.com",
        google_oauth_enabled: true,
        google_redirect_uri: "https://app.cloverbooks.com/auth/google/callback",
        jwt_secret_configured: true,
      },
      autonomy: {
        llm_mode: "live",
        tool_mode: "live",
        approval_amount_threshold: 1000,
        velocity_threshold: 50,
        snapshot_stale_minutes: 15,
        budgets: { tokens_per_day: 100000, tool_calls_per_day: 500, runs_per_day: 200 },
        allowlists: { domains: ["docs.cloverbooks.com"], models: ["gpt-5"] },
      },
      build: { service: "rust-api", rust_env: "production", git_sha: "abc123" },
    }),
    fetchAiOps: vi.fn().mockResolvedValue({
      generated_at: "2025-01-01T00:00:00Z",
      health: {
        open_ai_flags: 0,
        breaker_events_last_day: 0,
        tool_calls_last_day: 0,
        agent_runs_last_day: 0,
        policy_tenant_count: 1,
        last_tick_at: null,
        last_materialized_at: null,
        api_error_rate_1h_pct: 0.1,
        api_p95_response_ms_1h: 120,
      },
      policy: {
        llm_mode: "live",
        tool_mode: "live",
        approval_amount_threshold: 1000,
        velocity_threshold: 50,
        snapshot_stale_minutes: 15,
        budgets: { tokens_per_day: 100000, tool_calls_per_day: 500, runs_per_day: 200 },
        allowlists: { domains: ["docs.cloverbooks.com"], models: ["gpt-5"] },
      },
      modes: [{ mode: "suggest_only", tenant_count: 1 }],
      systems: [{ id: "admin_api", name: "Admin API", status: "healthy", detail: "p95 120 ms" }],
      recent_activity: [],
    }),
    fetchReconciliationMetrics: vi.fn().mockResolvedValue({
      total_unreconciled: 0,
      aging: { "0_30_days": 0, "30_60_days": 0, "60_90_days": 0, over_90_days: 0 },
      top_workspaces: [],
    }),
    fetchLedgerHealth: vi.fn().mockResolvedValue({
      summary: { unbalanced_entries: 0, orphan_accounts: 0, suspense_with_balance: 0 },
      unbalanced_entries: [],
      orphan_accounts: [],
      suspense_balances: [],
    }),
    fetchInvoicesAudit: vi.fn().mockResolvedValue({ summary: { total: 0, draft: 0, sent: 0, paid: 0, issues: 0 }, status_distribution: {}, recent_issues: [] }),
    fetchExpensesAudit: vi.fn().mockResolvedValue({
      summary: { total_expenses: 0, total_receipts: 0, uncategorized: 0, pending_receipts: 0 },
      expense_distribution: {},
      receipt_distribution: {},
      top_workspaces: [],
    }),
    fetchApprovals: vi.fn().mockResolvedValue({ results: [], count: 0, summary: { total_pending: 0, total_today: 0, high_risk_pending: 0, avg_response_minutes_24h: null } }),
    createApprovalRequest: vi.fn().mockResolvedValue({ id: "req-1", status: "PENDING" }),
    approveRequest: vi.fn().mockResolvedValue({ id: "req-1", status: "APPROVED" }),
    rejectRequest: vi.fn().mockResolvedValue({ id: "req-1", status: "REJECTED" }),
    breakGlassApproval: vi.fn().mockResolvedValue({ success: true, expires_at: "2024-01-01T00:00:00Z" }),
    fetchAutonomyStatus: vi.fn().mockResolvedValue({
      ok: true,
      tenant_id: 1,
      mode: "suggest_only",
      breakers: { recent: 0, ok: true },
      budgets: { tokens_per_day: 100000, tool_calls_per_day: 500, runs_per_day: 200 },
      last_tick_at: null,
      last_materialized_at: null,
      engine_version: "v1",
      mock_mode: { llm: "mock", tools: "mock" },
    }),
    fetchAutonomyQueues: vi.fn().mockResolvedValue({
      ok: true,
      source: "snapshot",
      stale: false,
      data: {
        generated_at: "2025-01-01T00:00:00Z",
        mode: "suggest_only",
        trust_score: 0,
        stats: {
          ready: 0,
          needs_attention: 0,
          waiting_approval: 0,
          applied_last_day: 0,
          dismissed_last_day: 0,
          breaker_events_last_day: 0,
        },
        job_totals: { queued: 0, running: 0, blocked: 0, failed: 0, succeeded: 0, canceled: 0 },
        job_by_agent: [],
        top_blockers: [],
        ready_queue: [],
        needs_attention_queue: [],
      },
    }),
    runAutonomyTick: vi.fn().mockResolvedValue({ ok: true }),
    runAutonomyMaterialize: vi.fn().mockResolvedValue({ ok: true }),
    updateAutonomyPolicy: vi.fn().mockResolvedValue({ ok: true }),
    updateUser: vi.fn(),
    updateWorkspace: vi.fn(),
    updateFeatureFlag: vi.fn(),
    updateSupportTicket: vi.fn(),
    startImpersonation: vi.fn().mockResolvedValue({ redirect_url: "" }),
    resetPassword: vi.fn().mockResolvedValue({ approval_required: true, approval_request_id: "req-1", approval_status: "PENDING" }),
  };
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("AdminApp", () => {
  it("renders the control center heading", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        authenticated: true,
        user: {
          email: "ops@cernbooks.com",
          internalAdmin: {
            role: "OPS",
            canAccessInternalAdmin: true,
            canManageAdminUsers: false,
            canGrantSuperadmin: false,
            adminPanelAccess: true,
          },
        },
      }),
    });

    vi.stubGlobal("fetch", mockFetch as unknown as typeof fetch);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/"]}>
          <AdminApp />
        </MemoryRouter>
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText(/Clover Books .* Admin/i)).toBeInTheDocument());
  });

  it("renders admin view for internal routes without customer navigation", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        authenticated: true,
        user: {
          email: "ops@cernbooks.com",
          internalAdmin: {
            role: "OPS",
            canAccessInternalAdmin: true,
            canManageAdminUsers: false,
            canGrantSuperadmin: false,
            adminPanelAccess: true,
          },
        },
      }),
    });

    vi.stubGlobal("fetch", mockFetch as unknown as typeof fetch);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/internal-admin"]}>
          <AdminRoutes />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() =>
      expect(screen.getByText(/Clover Books .* Admin/i)).toBeInTheDocument()
    );
    expect(screen.queryByText(/Products & Services/i)).not.toBeInTheDocument();
  });

  it("hides Employees nav for non-managers", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        authenticated: true,
        user: {
          email: "support@cernbooks.com",
          internalAdmin: {
            role: "SUPPORT",
            canAccessInternalAdmin: true,
            canManageAdminUsers: false,
            canGrantSuperadmin: false,
            adminPanelAccess: true,
          },
        },
      }),
    });
    vi.stubGlobal("fetch", mockFetch as unknown as typeof fetch);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/"]}>
          <AdminApp />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText(/Clover Books .* Admin/i)).toBeInTheDocument());
    expect(screen.queryByText(/^Employees$/i)).not.toBeInTheDocument();
  });

  it("uses runtime-backed shell chrome and a live top-bar action", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        authenticated: true,
        user: {
          email: "ops@cernbooks.com",
          internalAdmin: {
            role: "OPS",
            canAccessInternalAdmin: true,
            canManageAdminUsers: false,
            canGrantSuperadmin: false,
            adminPanelAccess: true,
          },
        },
      }),
    });

    vi.stubGlobal("fetch", mockFetch as unknown as typeof fetch);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/users"]}>
          <AdminApp />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText(/prod \/ rust-api/i)).toBeInTheDocument());
    expect(screen.queryByText(/Prod .* eu-central-1/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Open runtime settings/i }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /Admin settings/i })).toBeInTheDocument()
    );
    expect(screen.getByRole("button", { name: /Open audit logs/i })).toBeInTheDocument();
  });

  it("shows Not authorized on /employees for non-managers", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        authenticated: true,
        user: {
          email: "support@cernbooks.com",
          internalAdmin: {
            role: "SUPPORT",
            canAccessInternalAdmin: true,
            canManageAdminUsers: false,
            canGrantSuperadmin: false,
            adminPanelAccess: true,
          },
        },
      }),
    });
    vi.stubGlobal("fetch", mockFetch as unknown as typeof fetch);

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/employees"]}>
          <AdminApp />
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText(/Not authorized/i)).toBeInTheDocument());
  });
});
