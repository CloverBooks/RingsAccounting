import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const onboardingMock = vi.hoisted(() => ({
  currentStep: "welcome",
  profile: {} as Record<string, unknown>,
  readiness: {
    status: "in_progress",
    score: 80,
    missing_required_fields: [],
    required_fields_complete: true,
    missing_consents: [],
    consents_complete: true,
    ai_handshake_complete: false,
  },
  contextUnknowns: [] as string[],
  updateProfile: vi.fn(),
  updateField: vi.fn(),
  setStep: vi.fn(),
  skipStep: vi.fn(),
  completeOnboarding: vi.fn(),
  logEvent: vi.fn(),
  setFastPath: vi.fn(),
  resetError: vi.fn(),
  retrySync: vi.fn(),
}));

vi.mock("./OnboardingContext", () => ({
  FAST_PATH_STEPS: ["welcome", "intent", "business_basics", "industry", "team_size", "professional_profile", "ai_handshake", "done"],
  GUIDED_PATH_STEPS: [
    "welcome",
    "intent",
    "business_basics",
    "industry",
    "entity",
    "fiscal_pulse",
    "team_size",
    "business_age",
    "challenges",
    "current_tools",
    "transaction_volume",
    "accounting_habits",
    "data_source",
    "professional_profile",
    "ai_handshake",
    "done",
  ],
  OnboardingProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useOnboarding: () => ({
    profile: onboardingMock.profile,
    currentStep: onboardingMock.currentStep,
    status: "in_progress",
    fastPath: true,
    loading: false,
    syncStatus: "synced",
    error: null,
    serverUpdatedAt: null,
    readiness: onboardingMock.readiness,
    contextUnknowns: onboardingMock.contextUnknowns,
    updateProfile: onboardingMock.updateProfile,
    updateField: onboardingMock.updateField,
    setStep: onboardingMock.setStep,
    skipStep: onboardingMock.skipStep,
    completeOnboarding: onboardingMock.completeOnboarding,
    logEvent: onboardingMock.logEvent,
    setFastPath: onboardingMock.setFastPath,
    resetError: onboardingMock.resetError,
    retrySync: onboardingMock.retrySync,
  }),
}));

import OnboardingPage from "./OnboardingPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <OnboardingPage />
    </MemoryRouter>,
  );
}

describe("OnboardingPage", () => {
  beforeEach(() => {
    onboardingMock.currentStep = "welcome";
    onboardingMock.profile = {};
    onboardingMock.readiness = {
      status: "in_progress",
      score: 80,
      missing_required_fields: [],
      required_fields_complete: true,
      missing_consents: [],
      consents_complete: true,
      ai_handshake_complete: false,
    };
    onboardingMock.contextUnknowns = [];
    onboardingMock.updateProfile.mockReset();
    onboardingMock.updateField.mockReset();
    onboardingMock.setStep.mockReset();
    onboardingMock.skipStep.mockReset();
    onboardingMock.completeOnboarding.mockReset();
    onboardingMock.logEvent.mockReset();
    onboardingMock.setFastPath.mockReset();
    onboardingMock.resetError.mockReset();
    onboardingMock.retrySync.mockReset();
  });

  it("lets the user choose quick or guided onboarding", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Quick setup/i }));
    expect(onboardingMock.setFastPath).toHaveBeenCalledWith(true);
    expect(onboardingMock.setStep).toHaveBeenCalledWith("intent");

    onboardingMock.setFastPath.mockClear();
    onboardingMock.setStep.mockClear();

    fireEvent.click(screen.getByRole("button", { name: /Guided setup/i }));
    expect(onboardingMock.setFastPath).toHaveBeenCalledWith(false);
    expect(onboardingMock.setStep).toHaveBeenCalledWith("intent");
  });

  it("blocks professional setup completion when required fields are still missing", async () => {
    onboardingMock.currentStep = "professional_profile";
    onboardingMock.profile = {
      legal_business_name: "",
      industry: "",
      entity_type: "",
    };

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    expect(await screen.findByText(/Missing required fields:/i)).toBeInTheDocument();
    expect(onboardingMock.updateProfile).not.toHaveBeenCalled();
    expect(onboardingMock.setStep).not.toHaveBeenCalledWith("ai_handshake");
  });

  it("advances to AI handshake when professional setup is complete", async () => {
    onboardingMock.currentStep = "professional_profile";
    onboardingMock.profile = {
      legal_business_name: "Rings Accounting LLC",
      business_name: "Rings Accounting LLC",
      operating_name: "Rings",
      entity_type: "llc",
      industry: "Technology",
      business_age: "3_5_years",
      team_size: "2_10",
      country: "US",
      primary_timezone: "America/Toronto",
      base_currency: "USD",
      tax_registration_status: "registered",
      primary_tax_jurisdiction: "CA",
      tax_ids_by_jurisdiction: [{ jurisdiction: "CA", tax_id: "123" }],
      fiscal_year_end_month: 12,
      fiscal_year_end_day: 31,
      accounting_method: "accrual",
      filing_cadence: "monthly",
      monthly_transaction_band: "101_500",
      bank_account_count: "2_3",
      current_system_tool: "QuickBooks",
      data_source: "bank_connect",
      has_accountant: true,
      accounting_review_frequency: "monthly",
      default_invoice_terms: "Net 30",
      default_bill_terms: "Net 30",
      default_tax_behavior: "exclusive",
      high_risk_approval_threshold: 1000,
      companion_intent_goals: "Stay close-ready all month",
      top_accounting_challenges: ["Cash flow visibility"],
      risk_appetite: "balanced",
      preferred_explanation_style: "concise",
      notification_preference: "in_app",
    };
    onboardingMock.updateProfile.mockResolvedValue(undefined);

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    await waitFor(() => expect(onboardingMock.updateProfile).toHaveBeenCalled());
    await waitFor(() =>
      expect(onboardingMock.logEvent).toHaveBeenCalledWith(
        "Onboarding_Step_Completed",
        expect.objectContaining({
          step: "professional_profile",
          required_fields_complete: true,
        }),
      ),
    );
    await waitFor(() => expect(onboardingMock.setStep).toHaveBeenCalledWith("ai_handshake"));
  });

  it("sends incomplete completion back to professional setup", () => {
    onboardingMock.currentStep = "done";
    onboardingMock.profile = { legal_business_name: "Rings Accounting LLC" };
    onboardingMock.readiness = {
      ...onboardingMock.readiness,
      required_fields_complete: false,
    };
    onboardingMock.contextUnknowns = ["entity_type"];

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /Go to Dashboard/i }));

    expect(onboardingMock.setStep).toHaveBeenCalledWith("professional_profile");
    expect(onboardingMock.completeOnboarding).not.toHaveBeenCalled();
  });
});
