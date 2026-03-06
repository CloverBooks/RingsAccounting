import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const permissionsMock = vi.hoisted(() => ({
  workspace: { businessId: 42 },
  can: vi.fn(() => true),
}));

const aiSettingsMock = vi.hoisted(() => ({
  data: {
    global_ai_enabled: true,
    settings: {
      ai_enabled: true,
      kill_switch: false,
      ai_mode: "shadow_only",
    },
  },
  loading: false,
  patch: vi.fn(),
}));

const proposalsMock = vi.hoisted(() => ({
  events: [
    {
      id: "proposal-1",
      event_type: "categorize_tx",
      metadata: { proposal_group: "Banking" },
      data: { bank_transaction_description: "Software subscription" },
      human_in_the_loop: { risk_reasons: [], questions: [] },
    },
  ],
  loading: false,
  error: null,
  refresh: vi.fn(),
  apply: vi.fn(),
  reject: vi.fn(),
  counts: { total: 1, byType: { categorize_tx: 1 } },
}));

const readinessMock = vi.hoisted(() => ({
  readiness: {
    status: "in_progress",
    score: 50,
    missing_required_fields: ["entity_type"],
    required_fields_complete: false,
    missing_consents: ["ai_data_processing"],
    consents_complete: false,
    ai_handshake_complete: false,
  },
  unknowns: ["entity_type", "tax_registration_status"],
}));

vi.mock("../hooks/usePermissions", () => ({
  usePermissions: () => ({
    workspace: permissionsMock.workspace,
    can: permissionsMock.can,
  }),
}));

vi.mock("./useAISettings", () => ({
  useAISettings: () => aiSettingsMock,
}));

vi.mock("./useCompanionProposals", () => ({
  useCompanionProposals: () => proposalsMock,
}));

vi.mock("../onboarding/useOnboardingReadiness", () => ({
  useOnboardingReadiness: () => ({
    loading: false,
    error: null,
    status: readinessMock.readiness.status,
    unknowns: readinessMock.unknowns,
    readiness: readinessMock.readiness,
    hasProfile: true,
    refresh: vi.fn(),
  }),
}));

import CompanionProposalsPage from "./CompanionProposalsPage";

describe("CompanionProposalsPage", () => {
  beforeEach(() => {
    permissionsMock.can.mockReturnValue(true);
    aiSettingsMock.data = {
      global_ai_enabled: true,
      settings: {
        ai_enabled: true,
        kill_switch: false,
        ai_mode: "shadow_only",
      },
    };
    proposalsMock.events = [
      {
        id: "proposal-1",
        event_type: "categorize_tx",
        metadata: { proposal_group: "Banking" },
        data: { bank_transaction_description: "Software subscription" },
        human_in_the_loop: { risk_reasons: [], questions: [] },
      },
    ];
    readinessMock.readiness = {
      status: "in_progress",
      score: 50,
      missing_required_fields: ["entity_type"],
      required_fields_complete: false,
      missing_consents: ["ai_data_processing"],
      consents_complete: false,
      ai_handshake_complete: false,
    };
    readinessMock.unknowns = ["entity_type", "tax_registration_status"];
  });

  it("surfaces onboarding blockers before advanced apply actions", async () => {
    render(
      <MemoryRouter>
        <CompanionProposalsPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/Advanced Companion modes are locked until onboarding and consent are complete/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Missing setup: entity_type, tax_registration_status/i)).toBeInTheDocument();
    expect(screen.getByText(/Apply is disabled until setup is complete/i)).toBeInTheDocument();
  });

  it("shows suggest-only promotion control when setup is complete but mode is shadow-only", async () => {
    readinessMock.readiness = {
      status: "ready_for_companion",
      score: 90,
      missing_required_fields: [],
      required_fields_complete: true,
      missing_consents: [],
      consents_complete: true,
      ai_handshake_complete: true,
    };
    readinessMock.unknowns = [];

    render(
      <MemoryRouter>
        <CompanionProposalsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("button", { name: /Switch to suggest-only/i })).toBeInTheDocument();
    expect(screen.queryByText(/Advanced Companion modes are locked/i)).not.toBeInTheDocument();
  });
});
