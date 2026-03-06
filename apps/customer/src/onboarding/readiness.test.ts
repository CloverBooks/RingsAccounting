import { describe, expect, it } from "vitest";
import { deriveOnboardingReadiness, getMissingRequiredFields } from "./readiness";

describe("onboarding readiness", () => {
  it("treats legacy aliases as valid required field coverage", () => {
    const missing = getMissingRequiredFields({
      business_name: "Legacy Co",
      employee_count: "2-5",
      tax_registration: "registered",
      fiscal_year_end: "December",
      monthly_transactions: "50-200",
      bank_accounts_count: "2",
      current_tools: "QuickBooks",
      accounting_frequency: "monthly",
      biggest_challenges: ["cash flow"],
    });

    expect(missing).not.toContain("legal_business_name");
    expect(missing).not.toContain("team_size");
    expect(missing).not.toContain("tax_registration_status");
    expect(missing).not.toContain("fiscal_year_end_month");
    expect(missing).not.toContain("monthly_transaction_band");
    expect(missing).not.toContain("bank_account_count");
    expect(missing).not.toContain("current_system_tool");
    expect(missing).not.toContain("accounting_review_frequency");
    expect(missing).not.toContain("top_accounting_challenges");
  });

  it("returns completed when required fields + consent + handshake are complete", () => {
    const readiness = deriveOnboardingReadiness(
      {
        legal_business_name: "Acme Corp",
        operating_name: "Acme",
        entity_type: "LLC",
        industry: "Retail",
        business_age: "1-3",
        team_size: "2-5",
        country: "US",
        primary_timezone: "America/New_York",
        base_currency: "USD",
        tax_registration_status: "registered",
        primary_tax_jurisdiction: "US-NY",
        tax_ids_by_jurisdiction: [{ jurisdiction: "US-NY", tax_id: "123" }],
        fiscal_year_end_month: 12,
        fiscal_year_end_day: 31,
        accounting_method: "accrual",
        filing_cadence: "monthly",
        monthly_transaction_band: "50-200",
        bank_account_count: "2-3",
        current_system_tool: "QuickBooks",
        data_source: "bank_connect",
        has_accountant: true,
        accounting_review_frequency: "monthly",
        default_invoice_terms: "Net 30",
        default_bill_terms: "Net 30",
        default_tax_behavior: "exclusive",
        high_risk_approval_threshold: 1000,
        companion_intent_goals: "Close faster",
        top_accounting_challenges: ["AR follow-up"],
        risk_appetite: "balanced",
        preferred_explanation_style: "concise",
        notification_preference: "email",
      },
      {
        onboardingStatus: "completed",
        grantedConsents: ["ai_data_processing", "ai_recommendations"],
        aiHandshakeComplete: true,
      },
    );

    expect(readiness.status).toBe("completed");
    expect(readiness.score).toBe(100);
  });

  it("returns in_progress when required profile fields are missing", () => {
    const readiness = deriveOnboardingReadiness(
      {
        legal_business_name: "Acme",
        industry: "Retail",
      },
      { onboardingStatus: "in_progress" },
    );
    expect(readiness.status).toBe("in_progress");
    expect(readiness.required_fields_complete).toBe(false);
    expect(readiness.missing_required_fields.length).toBeGreaterThan(0);
  });
});
