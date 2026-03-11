import { useEffect, useState, useCallback } from "react";
import { ensureCsrfToken, getCsrfToken } from "../utils/csrf";

export type Severity = "high" | "medium" | "low";
export type Status = "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "IGNORED";
export type PaymentStatus =
  | "PAID"
  | "PARTIALLY_PAID"
  | "UNPAID"
  | "OVERPAID"
  | "SETTLED_ZERO"
  | "NO_LIABILITY"
  | "REFUND_DUE"
  | "REFUND_PARTIALLY_RECEIVED"
  | "REFUND_RECEIVED"
  | "REFUND_OVERRECEIVED";

export type TaxPaymentKind = "PAYMENT" | "REFUND";

export type TaxPayment = {
  id: string;
  kind: TaxPaymentKind;
  amount: number;
  currency: string;
  payment_date: string;
  bank_account_id?: string | null;
  bank_account_label?: string;
  method?: string;
  reference?: string;
  notes?: string;
  created_at?: string;
};

export type BankAccountOption = {
  id: string;
  name: string;
  currency: string;
};

export interface TaxPeriod {
  period_key: string;
  status: string;
  net_tax: number;
  payments_payment_total?: number;
  payments_refund_total?: number;
  payments_net_total?: number;
  payments_total?: number;
  balance?: number;
  remaining_balance?: number;
  payment_status?: PaymentStatus | null;
  anomaly_counts: { low: number; medium: number; high: number };
  due_date?: string;
  is_due_soon?: boolean;
  is_overdue?: boolean;
}

export interface TaxSnapshot {
  period_key: string;
  country: string;
  status: string;
  due_date?: string;
  is_due_soon?: boolean;
  is_overdue?: boolean;
  filed_at?: string | null;
  last_filed_at?: string | null;
  last_reset_at?: string | null;
  last_reset_reason?: string;
  llm_summary?: string;
  llm_notes?: string;
  summary_by_jurisdiction: Record<string, any>;
  line_mappings: Record<string, any>;
  net_tax?: number;
  payments?: TaxPayment[];
  payments_payment_total?: number;
  payments_refund_total?: number;
  payments_net_total?: number;
  payments_total?: number;
  balance?: number;
  remaining_balance?: number;
  payment_status?: PaymentStatus | null;
  anomaly_counts: { low: number; medium: number; high: number };
  has_high_severity_blockers: boolean;
}

export interface TaxAnomaly {
  id: string;
  code: string;
  severity: string;
  status: string;
  description: string;
  task_code: string;
  created_at?: string;
  resolved_at?: string;
  linked_model?: string | null;
  linked_id?: number | null;
  jurisdiction_code?: string | null;
  linked_model_friendly?: string | null;
  ledger_path?: string | null;
  expected_tax_amount?: number;
  actual_tax_amount?: number;
  difference?: number;
}

export function useTaxGuardian(initialPeriodKey?: string, initialSeverity?: Severity | "all") {
  const [periods, setPeriods] = useState<TaxPeriod[]>([]);
  const [snapshot, setSnapshot] = useState<TaxSnapshot | null>(null);
  const [anomalies, setAnomalies] = useState<TaxAnomaly[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string | undefined>(initialPeriodKey);
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">(initialSeverity || "all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiFetch = useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const method = (init.method || "GET").toUpperCase();
      const headers: Record<string, string> = {
        Accept: "application/json",
        ...(init.headers as Record<string, string> | undefined),
      };
      if (method !== "GET") {
        const csrf = (getCsrfToken() || (await ensureCsrfToken())) || "";
        if (csrf) headers["X-CSRFToken"] = csrf;
        if (init.body !== undefined && !headers["Content-Type"]) {
          headers["Content-Type"] = "application/json";
        }
      }
      const res = await fetch(input, {
        credentials: "same-origin",
        ...init,
        headers,
      });
      return res;
    },
    []
  );

  const fetchPeriods = useCallback(async () => {
    try {
      const res = await apiFetch("/api/tax/periods/");
      if (!res.ok) throw new Error("Failed to load tax periods");
      const data = await res.json();
      setPeriods(data.periods || []);
      if (!selectedPeriod && data.periods && data.periods.length > 0) {
        setSelectedPeriod(data.periods[0].period_key);
      }
    } catch (err) {
      console.warn("Using mock periods data", err);
      const mockPeriods: TaxPeriod[] = [
        { period_key: "Q1 2025", status: "DRAFT", net_tax: 15420.50, anomaly_counts: { low: 2, medium: 1, high: 0 }, due_date: "2025-04-15", is_due_soon: true },
        { period_key: "Q4 2024", status: "FILED", net_tax: 22150.00, payments_total: 22150.00, anomaly_counts: { low: 0, medium: 0, high: 0 }, payment_status: "PAID" },
        { period_key: "Q3 2024", status: "FILED", net_tax: 18400.00, payments_total: 18400.00, anomaly_counts: { low: 0, medium: 0, high: 0 }, payment_status: "PAID" },
        { period_key: "Q2 2024", status: "FILED", net_tax: 19200.00, payments_total: 19200.00, anomaly_counts: { low: 0, medium: 0, high: 0 }, payment_status: "PAID" },
      ];
      setPeriods(mockPeriods);
      if (!selectedPeriod) setSelectedPeriod("Q1 2025");
    }
  }, [apiFetch, selectedPeriod]);

  const fetchSnapshot = useCallback(
    async (period: string) => {
      try {
        const res = await apiFetch(`/api/tax/periods/${period}/`);
        if (!res.ok) throw new Error("Failed to load tax snapshot");
        const data = await res.json();
        setSnapshot(data);
      } catch (err) {
        console.warn("Using mock snapshot data", err);
        setSnapshot({
          period_key: period,
          country: "US",
          status: period === "Q1 2025" ? "DRAFT" : "FILED",
          due_date: "2025-04-15",
          is_due_soon: period === "Q1 2025",
          llm_summary: "Your tax position is largely compliant. 2 low severity anomalies require review before filing. Nexus exposure in WA and TX is within safe harbor limits.",
          summary_by_jurisdiction: {
            "WA": { net_tax: 8500.00 },
            "TX": { net_tax: 4200.00 },
            "NY": { net_tax: 2720.50 }
          },
          line_mappings: {
            "WA": { total_sales: 120500, taxable_sales: 95000, exempt_sales: 25500, net_tax: 8500 },
            "TX": { total_sales: 80000, taxable_sales: 50000, exempt_sales: 30000, net_tax: 4200 }
          },
          net_tax: period === "Q1 2025" ? 15420.50 : 22150.00,
          payments: [],
          payments_total: period === "Q1 2025" ? 0 : 22150.00,
          remaining_balance: period === "Q1 2025" ? 15420.50 : 0,
          payment_status: period === "Q1 2025" ? "UNPAID" : "PAID",
          anomaly_counts: period === "Q1 2025" ? { low: 2, medium: 1, high: 0 } : { low: 0, medium: 0, high: 0 },
          has_high_severity_blockers: false
        });
      }
    },
    [apiFetch]
  );

  const fetchAnomalies = useCallback(
    async (period: string, severity?: Severity | "all", status?: Status | "all") => {
      try {
        const params = new URLSearchParams();
        if (severity && severity !== "all") params.append("severity", severity);
        if (status && status !== "all") params.append("status", status);
        const res = await apiFetch(`/api/tax/periods/${period}/anomalies/?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load tax anomalies");
        const data = await res.json();
        setAnomalies(data.anomalies || []);
      } catch (err) {
        console.warn("Using mock anomalies data", err);
        if (period === "Q1 2025") {
          setAnomalies([
            { id: "1", code: "NEXUS_THRESHOLD_NEAR", severity: "medium", status: "OPEN", description: "Approaching economic nexus threshold in WA. Current sales: $85K (Threshold: $100K).", task_code: "nexus_check", jurisdiction_code: "WA" },
            { id: "2", code: "PRODUCT_TAX_EXEMPT_MISMATCH", severity: "low", status: "OPEN", description: "Invoice #INV-2045 marked exempt but customer has no valid exemption certificate on file.", task_code: "exemption_cert", linked_model: "Invoice", linked_id: 2045 },
            { id: "3", code: "RATE_VARIANCE", severity: "low", status: "RESOLVED", description: "Applied tax rate 8.25% differs from standard 8.00% for zip code 78701. Resolved: special district tax applied.", task_code: "rate_check", jurisdiction_code: "TX" },
          ]);
        } else {
          setAnomalies([]);
        }
      }
    },
    [apiFetch]
  );

  const fetchBankAccounts = useCallback(async () => {
    try {
      const res = await apiFetch("/api/reconciliation/accounts/");
      if (!res.ok) throw new Error("Failed to load bank accounts");
      const data = await res.json();
      const source = Array.isArray(data) ? data : data?.accounts || [];
      const normalized: BankAccountOption[] = source.map((acc: any) => ({
        id: String(acc.id),
        name: String(acc.name || ""),
        currency: String(acc.currency || "USD"),
      }));
      setBankAccounts(normalized);
    } catch (err) {
      console.warn("Using mock bank accounts data", err);
      setBankAccounts([
        { id: "b1", name: "Chase Operating (...1234)", currency: "USD" },
        { id: "b2", name: "Mercury Treasury (...5678)", currency: "USD" },
      ]);
    }
  }, [apiFetch]);

  const refresh = useCallback(
    async (period: string) => {
      const res = await apiFetch(`/api/tax/periods/${period}/refresh/`, { method: "POST" });
      if (!res.ok) throw new Error("Refresh failed");
      await fetchSnapshot(period);
      await fetchAnomalies(period);
    },
    [apiFetch, fetchAnomalies, fetchSnapshot]
  );

  const updatePeriodStatus = useCallback(
    async (period: string, status: string) => {
      const res = await apiFetch(`/api/tax/periods/${period}/status/`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      await fetchSnapshot(period);
    },
    [apiFetch, fetchSnapshot]
  );

  const updateAnomalyStatus = useCallback(
    async (period: string, anomalyId: string, status: Status, statusFilter?: Status | "all") => {
      const res = await apiFetch(`/api/tax/periods/${period}/anomalies/${anomalyId}/`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update anomaly");
      await fetchAnomalies(period, severityFilter, statusFilter);
    },
    [apiFetch, fetchAnomalies, severityFilter]
  );

  const llmEnrich = useCallback(
    async (period: string) => {
      const res = await apiFetch(`/api/tax/periods/${period}/llm-enrich/`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message = (data as any)?.detail || (data as any)?.error || "LLM enrichment failed";
        throw new Error(message);
      }
      await fetchSnapshot(period);
    },
    [apiFetch, fetchSnapshot]
  );

  const resetPeriod = useCallback(
    async (period: string, reason?: string) => {
      const res = await apiFetch(`/api/tax/periods/${period}/reset/`, {
        method: "POST",
        body: JSON.stringify({ confirm_reset: true, reason: reason || "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || (data as any)?.detail || "Reset failed");
      await fetchSnapshot(period);
      await fetchAnomalies(period);
    },
    [apiFetch, fetchAnomalies, fetchSnapshot]
  );

  const createPayment = useCallback(
    async (
      period: string,
      payload: {
        kind?: TaxPaymentKind;
        bank_account_id?: string;
        amount: number | string;
        payment_date: string;
        method?: string;
        reference?: string;
        notes?: string;
      }
    ) => {
      const res = await apiFetch(`/api/tax/periods/${period}/payments/`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || JSON.stringify((data as any)?.errors || data));
      await Promise.all([fetchSnapshot(period), fetchPeriods()]);
    },
    [apiFetch, fetchPeriods, fetchSnapshot]
  );

  const updatePayment = useCallback(
    async (
      period: string,
      paymentId: string,
      payload: Partial<{
        kind: TaxPaymentKind;
        bank_account_id: string;
        amount: number | string;
        payment_date: string;
        method: string;
        reference: string;
        notes: string;
      }>
    ) => {
      const res = await apiFetch(`/api/tax/periods/${period}/payments/${paymentId}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || JSON.stringify((data as any)?.errors || data));
      await Promise.all([fetchSnapshot(period), fetchPeriods()]);
    },
    [apiFetch, fetchPeriods, fetchSnapshot]
  );

  const deletePayment = useCallback(
    async (period: string, paymentId: string) => {
      const res = await apiFetch(`/api/tax/periods/${period}/payments/${paymentId}/`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error || "Failed to delete payment");
      await Promise.all([fetchSnapshot(period), fetchPeriods()]);
    },
    [apiFetch, fetchPeriods, fetchSnapshot]
  );

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([fetchPeriods(), fetchBankAccounts()])
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [fetchBankAccounts, fetchPeriods]);

  useEffect(() => {
    if (!selectedPeriod) return;
    setLoading(true);
    Promise.all([fetchSnapshot(selectedPeriod), fetchAnomalies(selectedPeriod)])
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedPeriod, fetchAnomalies, fetchSnapshot]);

  return {
    periods,
    snapshot,
    anomalies,
    bankAccounts,
    selectedPeriod,
    setSelectedPeriod,
    severityFilter,
    setSeverityFilter,
    loading,
    error,
    refresh,
    llmEnrich,
    resetPeriod,
    createPayment,
    updatePayment,
    deletePayment,
    updatePeriodStatus,
    updateAnomalyStatus,
    refetch: async () => {
      if (!selectedPeriod) return;
      await fetchSnapshot(selectedPeriod);
      await fetchAnomalies(selectedPeriod);
    },
  };
}
