export type OnboardingReadinessStatus =
  | "not_started"
  | "in_progress"
  | "ready_for_companion"
  | "completed";

export type ConsentKey = "ai_data_processing" | "ai_recommendations";

export interface TaxIdByJurisdiction {
  jurisdiction: string;
  tax_id: string;
}

export interface ContactRoleInput {
  role: string;
  name?: string;
  email?: string;
}

export interface AIRuleInput {
  rule_type: string;
  rule: Record<string, unknown>;
  confidence: number;
}

export interface OnboardingProfileV2 {
  // Legacy keys
  business_name?: string;
  intent?: string;
  annual_revenue_bracket?: string;
  tax_registration?: string;
  employee_count?: string;
  fiscal_year_end?: string;
  monthly_transactions?: string;
  bank_accounts_count?: string;
  current_tools?: string;
  accounting_frequency?: string;
  biggest_challenges?: string[];
  tax_concerns?: string[];

  // Company identity
  legal_business_name?: string;
  operating_name?: string;
  entity_type?: string;
  industry?: string;
  business_age?: string;
  team_size?: string;
  country?: string;
  primary_timezone?: string;
  base_currency?: string;

  // Tax & compliance
  tax_registration_status?: string;
  primary_tax_jurisdiction?: string;
  tax_ids_by_jurisdiction?: TaxIdByJurisdiction[];
  fiscal_year_end_month?: number;
  fiscal_year_end_day?: number;
  accounting_method?: string;
  filing_cadence?: string;

  // Accounting ops
  monthly_transaction_band?: string;
  bank_account_count?: string;
  current_system_tool?: string;
  data_source?: string;
  has_accountant?: boolean;
  accounting_review_frequency?: string;

  // AR/AP defaults
  default_invoice_terms?: string;
  default_bill_terms?: string;
  default_tax_behavior?: string;
  high_risk_approval_threshold?: number;

  // Companion context
  companion_intent_goals?: string;
  top_accounting_challenges?: string[];
  risk_appetite?: string;
  preferred_explanation_style?: string;
  notification_preference?: string;

  // Optional professional fields
  contact_roles?: ContactRoleInput[];
  industry_specific_flags?: string[];
  reporting_preferences?: string[];

  // Provenance
  _inferred?: Record<string, { value: unknown; confidence: number; source: string }>;
}

export interface OnboardingReadiness {
  status: OnboardingReadinessStatus;
  score: number;
  missing_required_fields: string[];
  required_fields_complete: boolean;
  missing_consents: ConsentKey[];
  consents_complete: boolean;
  ai_handshake_complete: boolean;
}

const REQUIRED_PROFILE_FIELDS: string[] = [
  "legal_business_name",
  "operating_name",
  "entity_type",
  "industry",
  "business_age",
  "team_size",
  "country",
  "primary_timezone",
  "base_currency",
  "tax_registration_status",
  "primary_tax_jurisdiction",
  "tax_ids_by_jurisdiction",
  "fiscal_year_end_month",
  "fiscal_year_end_day",
  "accounting_method",
  "filing_cadence",
  "monthly_transaction_band",
  "bank_account_count",
  "current_system_tool",
  "data_source",
  "has_accountant",
  "accounting_review_frequency",
  "default_invoice_terms",
  "default_bill_terms",
  "default_tax_behavior",
  "high_risk_approval_threshold",
  "companion_intent_goals",
  "top_accounting_challenges",
  "risk_appetite",
  "preferred_explanation_style",
  "notification_preference",
];

export const REQUIRED_CONSENTS: ConsentKey[] = ["ai_data_processing", "ai_recommendations"];

function hasPresentValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return false;
}

function fieldIsPresent(profile: OnboardingProfileV2, canonicalKey: string): boolean {
  switch (canonicalKey) {
    case "legal_business_name":
      return hasPresentValue(profile.legal_business_name) || hasPresentValue(profile.business_name);
    case "team_size":
      return hasPresentValue(profile.team_size) || hasPresentValue(profile.employee_count);
    case "tax_registration_status":
      return hasPresentValue(profile.tax_registration_status) || hasPresentValue(profile.tax_registration);
    case "fiscal_year_end_month":
    case "fiscal_year_end_day":
      return (
        (hasPresentValue(profile.fiscal_year_end_month) && hasPresentValue(profile.fiscal_year_end_day)) ||
        hasPresentValue(profile.fiscal_year_end)
      );
    case "monthly_transaction_band":
      return hasPresentValue(profile.monthly_transaction_band) || hasPresentValue(profile.monthly_transactions);
    case "bank_account_count":
      return hasPresentValue(profile.bank_account_count) || hasPresentValue(profile.bank_accounts_count);
    case "current_system_tool":
      return hasPresentValue(profile.current_system_tool) || hasPresentValue(profile.current_tools);
    case "accounting_review_frequency":
      return hasPresentValue(profile.accounting_review_frequency) || hasPresentValue(profile.accounting_frequency);
    case "top_accounting_challenges":
      return (
        hasPresentValue(profile.top_accounting_challenges) ||
        hasPresentValue(profile.biggest_challenges) ||
        hasPresentValue(profile.tax_concerns)
      );
    default:
      return hasPresentValue(profile[canonicalKey as keyof OnboardingProfileV2]);
  }
}

export function hasAnyRequiredField(profile: OnboardingProfileV2): boolean {
  return REQUIRED_PROFILE_FIELDS.some((key) => fieldIsPresent(profile, key));
}

export function getMissingRequiredFields(profile: OnboardingProfileV2): string[] {
  return REQUIRED_PROFILE_FIELDS.filter((key) => !fieldIsPresent(profile, key));
}

export function deriveOnboardingReadiness(
  profile: OnboardingProfileV2,
  options: {
    onboardingStatus?: string;
    grantedConsents?: string[];
    aiHandshakeComplete?: boolean;
  } = {},
): OnboardingReadiness {
  const onboardingStatus = options.onboardingStatus || "not_started";
  const grantedConsents = options.grantedConsents || [];
  const aiHandshakeComplete = Boolean(options.aiHandshakeComplete);

  const missingRequiredFields = getMissingRequiredFields(profile);
  const requiredFieldsComplete = missingRequiredFields.length === 0;
  const missingConsents = REQUIRED_CONSENTS.filter((consent) => !grantedConsents.includes(consent));
  const consentsComplete = missingConsents.length === 0;

  const requiredCompletionRatio =
    REQUIRED_PROFILE_FIELDS.length > 0
      ? (REQUIRED_PROFILE_FIELDS.length - missingRequiredFields.length) / REQUIRED_PROFILE_FIELDS.length
      : 1;
  let score = Math.round(requiredCompletionRatio * 80 + (consentsComplete ? 10 : 0) + (aiHandshakeComplete ? 10 : 0));

  let status: OnboardingReadinessStatus;
  if (!hasAnyRequiredField(profile)) {
    status = "not_started";
  } else if (!requiredFieldsComplete) {
    status = "in_progress";
  } else if (onboardingStatus === "completed" && consentsComplete && aiHandshakeComplete) {
    status = "completed";
    score = 100;
  } else {
    status = "ready_for_companion";
  }

  return {
    status,
    score,
    missing_required_fields: missingRequiredFields,
    required_fields_complete: requiredFieldsComplete,
    missing_consents: missingConsents,
    consents_complete: consentsComplete,
    ai_handshake_complete: aiHandshakeComplete,
  };
}

export function normalizeReadinessPayload(
  payload: any,
  fallback: OnboardingReadiness,
): OnboardingReadiness {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const status = String(payload.status || fallback.status) as OnboardingReadinessStatus;
  const score = Number(payload.score);
  const missingRequired = Array.isArray(payload.missing_required_fields)
    ? payload.missing_required_fields.map(String)
    : fallback.missing_required_fields;
  const missingConsents = Array.isArray(payload.missing_consents)
    ? payload.missing_consents
        .map(String)
        .filter((k: string) => REQUIRED_CONSENTS.includes(k as ConsentKey)) as ConsentKey[]
    : fallback.missing_consents;

  return {
    status:
      status === "not_started" ||
      status === "in_progress" ||
      status === "ready_for_companion" ||
      status === "completed"
        ? status
        : fallback.status,
    score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : fallback.score,
    missing_required_fields: missingRequired,
    required_fields_complete:
      typeof payload.required_fields_complete === "boolean"
        ? payload.required_fields_complete
        : missingRequired.length === 0,
    missing_consents: missingConsents,
    consents_complete:
      typeof payload.consents_complete === "boolean"
        ? payload.consents_complete
        : missingConsents.length === 0,
    ai_handshake_complete:
      typeof payload.ai_handshake_complete === "boolean"
        ? payload.ai_handshake_complete
        : fallback.ai_handshake_complete,
  };
}

export function buildInitialHandshakeRules(profile: OnboardingProfileV2): AIRuleInput[] {
  const rules: AIRuleInput[] = [];

  if (hasPresentValue(profile.default_invoice_terms)) {
    rules.push({
      rule_type: "default_invoice_terms",
      rule: { terms: profile.default_invoice_terms },
      confidence: 1,
    });
  }

  if (hasPresentValue(profile.default_bill_terms)) {
    rules.push({
      rule_type: "default_bill_terms",
      rule: { terms: profile.default_bill_terms },
      confidence: 1,
    });
  }

  const challengeList =
    profile.top_accounting_challenges ||
    profile.biggest_challenges ||
    profile.tax_concerns ||
    [];
  if (Array.isArray(challengeList) && challengeList.length > 0) {
    rules.push({
      rule_type: "challenge_focus",
      rule: { challenges: challengeList.slice(0, 5) },
      confidence: 0.9,
    });
  }

  if (hasPresentValue(profile.risk_appetite) || hasPresentValue(profile.high_risk_approval_threshold)) {
    rules.push({
      rule_type: "risk_policy",
      rule: {
        risk_appetite: profile.risk_appetite || "balanced",
        high_risk_approval_threshold: profile.high_risk_approval_threshold ?? 1000,
      },
      confidence: 1,
    });
  }

  return rules;
}
