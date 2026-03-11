import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import CloverBooksDashboard from "./CloverBooksDashboard";
import { allowConsole } from "../test/strictConsole";

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ logout: vi.fn() }),
}));

vi.mock("../onboarding/useOnboardingReadiness", () => ({
  useOnboardingReadiness: () => ({
    loading: false,
    error: null,
    status: "completed",
    unknowns: [],
    readiness: {
      status: "completed",
      score: 100,
      missing_required_fields: [],
      required_fields_complete: true,
      missing_consents: [],
      consents_complete: true,
      ai_handshake_complete: true,
    },
    hasProfile: true,
    refresh: vi.fn(),
  }),
}));

const summaryPayload = {
  tax: {
    period_key: "2025-12",
    net_tax: 14500,
    anomaly_counts: { low: 0, medium: 2, high: 0 },
  },
};

const periodsPayload = {
  periods: [
    {
      period_key: "2025-12",
      due_date: "2099-01-30",
      is_due_soon: false,
      is_overdue: false,
    },
  ],
};

describe("CloverBooksDashboard Tax Guardian card", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.startsWith("/api/agentic/companion/summary")) {
        return new Response(JSON.stringify(summaryPayload), {
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.startsWith("/api/tax/periods/")) {
        return new Response(JSON.stringify(periodsPayload), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not found", { status: 404 });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders tax guardian summary and link", async () => {
    render(
      <MemoryRouter>
        <CloverBooksDashboard metrics={{}} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Tax Guardian/i)).toBeInTheDocument();
    expect(await screen.findByText("Attention", {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByText(/2 anomalies need review/i)).toBeInTheDocument();
    expect(screen.getByText(/Due Jan 30/i)).toBeInTheDocument();

    const link = screen.getByRole("link", { name: /^View$/i });
    expect(link).toHaveAttribute("href", "/companion/tax?period=2025-12");
  });

  it("shows inline retry on error", async () => {
    allowConsole(/Request failed \(500\) fail/);

    let summaryRequests = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.startsWith("/api/agentic/companion/summary")) {
        summaryRequests += 1;
        if (summaryRequests === 1) {
          return new Response("fail", { status: 500 });
        }
        return new Response(JSON.stringify(summaryPayload), {
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.startsWith("/api/tax/periods/")) {
        return new Response(JSON.stringify(periodsPayload), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not found", { status: 404 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <MemoryRouter>
        <CloverBooksDashboard metrics={{}} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText(/Unable to load tax status/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Try again/i }));
    await waitFor(() => expect(screen.getByText(/Due Jan 30/i)).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalled();
  });

  it("skips secondary tax requests when bootstrap data is present", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <MemoryRouter>
        <CloverBooksDashboard
          metrics={{}}
          bootstrapPending={false}
          taxGuardianCard={{
            periodKey: "2026-03",
            netTaxDue: 0,
            dueDate: null,
            status: "all_clear",
            openAnomalies: 0,
            dueLabel: "Unknown",
          }}
          onboardingReadiness={{
            status: "in_progress",
            score: 55,
            unknowns: ["industry"],
            hasProfile: true,
          }}
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Tax Guardian/i)).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });
});
