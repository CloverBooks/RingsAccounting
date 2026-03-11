import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { WorkspacesSection } from "./WorkspacesSection";
import * as api from "./api";

vi.mock("./api", () => {
  const mockWorkspaces = {
    results: [
      {
        id: 1,
        name: "Clover Books Labs Inc.",
        owner_email: "owner@example.com",
        plan: "Pro",
        status: "active",
        is_deleted: false,
        created_at: "2024-01-01T00:00:00Z",
        unreconciled_count: 0,
        ledger_status: "balanced",
      },
    ],
    next: null,
    previous: null,
  };
  return {
    fetchWorkspaces: vi.fn().mockResolvedValue(mockWorkspaces),
    fetchWorkspace360: vi.fn().mockResolvedValue({
      workspace: {
        id: 1,
        name: "Clover Books Labs Inc.",
        created_at: "2024-01-01T00:00:00Z",
      },
      owner: {
        id: 10,
        email: "owner@example.com",
        full_name: "Owner Example",
      },
      plan: "Pro",
      banking: {
        account_count: 1,
        accounts: [
          {
            id: 1,
            name: "Main Ops",
            bank_name: "Clover Bank",
            is_active: true,
            last_imported_at: "2024-01-02T00:00:00Z",
          },
        ],
        unreconciled_count: 0,
      },
      ledger_health: {
        unbalanced_entries: 0,
        orphan_accounts: 0,
        total_accounts: 12,
        total_entries: 42,
      },
      invoices: {
        total: 4,
        draft: 1,
        sent: 2,
        paid: 1,
      },
      expenses: {
        total: 3,
        uncategorized: 0,
        total_amount: 2400,
      },
      tax: {
        has_tax_guardian: true,
        last_period: {
          id: 1,
          start_date: "2024-01-01",
          end_date: "2024-01-31",
          status: "OPEN",
        },
        open_anomalies: {
          high: 0,
          medium: 1,
          low: 2,
        },
      },
      ai: {
        last_monitor_run: null,
        open_ai_flags: 0,
      },
    }),
    updateWorkspace: vi.fn().mockResolvedValue(mockWorkspaces.results[0]),
  };
});

describe("WorkspacesSection", () => {
  it("renders workspaces table", async () => {
    render(<WorkspacesSection roleLevel={2} />);
    await waitFor(() => expect(screen.getAllByText(/Clover Books Labs Inc./i).length).toBeGreaterThan(0));
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.getByText("Plan")).toBeInTheDocument();
    expect(await screen.findByDisplayValue(/Clover Books Labs Inc./i)).toBeInTheDocument();
    expect(screen.getByText(/Internal control plane/i)).toBeInTheDocument();
  });

  it("collects a reason before soft-delete workspace updates", async () => {
    const user = userEvent.setup();
    render(<WorkspacesSection roleLevel={4} />);
    await screen.findByDisplayValue(/Clover Books Labs Inc./i);

    const softDeleteToggle = screen.getByRole("checkbox", { name: /soft delete tenant/i });
    await user.click(softDeleteToggle);
    expect(softDeleteToggle).toBeChecked();
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await screen.findByText(/reason required/i);
    await user.type(screen.getByLabelText(/reason/i), "Fraud review closure.");
    await user.click(screen.getByRole("button", { name: /submit deletion request/i }));

    await waitFor(() =>
      expect(api.updateWorkspace).toHaveBeenLastCalledWith(1, {
        name: "Clover Books Labs Inc.",
        plan: "Pro",
        status: "active",
        is_deleted: true,
        reason: "Fraud review closure.",
      }),
    );
  }, 10000);
});
