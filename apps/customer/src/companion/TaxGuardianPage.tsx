import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  Download,
  Info,
  Sparkles,
  FileText,
  ShieldCheck,
  X,
  Check,
  ArrowRight,
  Search,
  MoreHorizontal,
  Database,
  Eye,
  EyeOff,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  CreditCard,
  Trash2,
  Pencil,
} from "lucide-react";
import { useTaxGuardian, type Severity, type Status, type TaxAnomaly, type PaymentStatus, type TaxPayment, type TaxPaymentKind } from "./useTaxGuardian";
import { useAuth } from "../contexts/AuthContext";
import { usePermissions } from "../hooks/usePermissions";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

export function formatCurrency(amount: number | string | undefined | null, currency: string = "CAD"): string {
  const num = typeof amount === "string" ? parseFloat(amount) || 0 : amount || 0;
  if (isNaN(num)) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(0);
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(num);
}

function classNames(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function paymentStatusLabel(status: PaymentStatus | null | undefined): string {
  switch (status) {
    case "PAID":
      return "Paid";
    case "PARTIALLY_PAID":
      return "Partially paid";
    case "UNPAID":
      return "Unpaid";
    case "OVERPAID":
      return "Overpaid";
    case "SETTLED_ZERO":
      return "Settled";
    case "NO_LIABILITY":
      return "No liability";
    case "REFUND_DUE":
      return "Refund due";
    case "REFUND_PARTIALLY_RECEIVED":
      return "Partial refund";
    case "REFUND_RECEIVED":
      return "Refund received";
    case "REFUND_OVERRECEIVED":
      return "Over-refunded";
    default:
      return "Settled";
  }
}

function paymentStatusClasses(status: PaymentStatus | null | undefined): string {
  switch (status) {
    case "PAID":
    case "REFUND_RECEIVED":
    case "SETTLED_ZERO":
    case "NO_LIABILITY":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100";
    case "PARTIALLY_PAID":
    case "REFUND_PARTIALLY_RECEIVED":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-100";
    case "UNPAID":
    case "REFUND_DUE":
      return "bg-rose-50 text-rose-700 ring-1 ring-rose-100";
    case "OVERPAID":
    case "REFUND_OVERRECEIVED":
      return "bg-blue-50 text-blue-700 ring-1 ring-blue-100";
    default:
      return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
  }
}

function periodSortKey(periodKey: string): number {
  const m = periodKey.match(/^(\d{4})-(\d{2})$/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    return Date.UTC(year, month - 1, 1);
  }
  const q = periodKey.match(/^(\d{4})Q([1-4])$/);
  if (q) {
    const year = Number(q[1]);
    const quarter = Number(q[2]);
    const endMonth = quarter * 3;
    return Date.UTC(year, endMonth - 1, 1);
  }
  return 0;
}

function useQueryParams(): { period?: string; severity?: Severity | "all" } {
  const params = new URLSearchParams(window.location.search);
  return {
    period: params.get("period") || undefined,
    severity: (params.get("severity") as Severity | "all") || undefined,
  };
}

// -----------------------------------------------------------------------------
// Toast Component
// -----------------------------------------------------------------------------
const Toast: React.FC<{ message: string; type: "success" | "error" | "info"; onClose: () => void }> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    success: "bg-emerald-600 text-white shadow-emerald-200",
    error: "bg-rose-600 text-white shadow-rose-200",
    info: "bg-slate-800 text-white shadow-slate-200",
  };

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-3 shadow-xl ${styles[type]} transition-all`}>
      {type === "success" && <Check className="h-4 w-4" />}
      {type === "error" && <AlertTriangle className="h-4 w-4" />}
      {type === "info" && <Info className="h-4 w-4" />}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Companion Panel
// -----------------------------------------------------------------------------
const DashboardCompanionPanel: React.FC<{
  summary?: string | null;
  isEnriching: boolean;
  onEnrich: () => void;
  userName?: string;
}> = ({ summary, isEnriching, onEnrich, userName }) => {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-8 shadow-sm ring-1 ring-black/5 font-sans">
      {/* Glass decorative blob */}
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-50/50 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-5">
          {/* AI Avatar */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white shadow-md">
            <span className="text-xs font-bold tracking-wider">AI</span>
          </div>

          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Tax Guardian Companion
              </h3>
            </div>

            {isEnriching ? (
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-slate-900 animate-pulse">
                  Analyzing your tax position...
                </h2>
                <div className="h-1.5 w-48 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full w-2/3 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-pulse" />
                </div>
              </div>
            ) : summary ? (
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-slate-900">
                  I've analyzed your current period.
                </h2>
                <p className="text-sm leading-relaxed text-slate-600">
                  {summary}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-slate-900">
                  Good day{userName ? `, ${userName}` : ""}. I'm ready to review.
                </h2>
                <p className="text-sm text-slate-600">
                  I can cross-check recent activity, anomalies, and jurisdiction coverage to bring you a clean tax summary.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Button Area */}
        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[10px] font-medium text-slate-500 shadow-sm ring-1 ring-slate-200 backdrop-blur-md">
            <Sparkles className="h-3 w-3 text-emerald-500" />
            <span>{isEnriching ? "Thinking..." : "Ready to analyze"}</span>
          </div>

          <button
            onClick={onEnrich}
            disabled={isEnriching}
            className="group relative inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-slate-900/10 transition-all hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70"
          >
            {isEnriching ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span>{summary ? "Refresh Analysis" : "Generate Analysis"}</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Helper Components
// -----------------------------------------------------------------------------

function MetricCard({
  label,
  value,
  subtext,
  tone = "neutral",
  badge,
}: {
  label: string;
  value: string;
  subtext?: string;
  tone?: "neutral" | "positive" | "negative";
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-100/50 transition-all hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
        {badge}
      </div>
      <div className="mt-2 flex items-baseline gap-2 min-w-0">
        <span className="text-3xl font-bold tracking-tight text-slate-900 truncate font-mono-soft">{value}</span>
      </div>
      {subtext && (
        <div className={classNames("mt-2 text-xs font-medium",
          tone === "negative" ? "text-rose-600" : tone === "positive" ? "text-emerald-600" : "text-slate-500"
        )}>
          {subtext}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Page
// -----------------------------------------------------------------------------

const TaxGuardianPage: React.FC = () => {
  const queryParams = useQueryParams();
  const { auth } = useAuth();
  const { can } = usePermissions();
  const userName = auth?.user?.firstName || auth?.user?.username || "there";
  const navigate = useNavigate();
  const location = useLocation();

  const {
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
  } = useTaxGuardian(queryParams.period, queryParams.severity);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [enriching, setEnriching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetReason, setResetReason] = useState("");
  const [resetting, setResetting] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentForm, setPaymentForm] = useState<{
    id: string | null;
    kind: TaxPaymentKind;
    bank_account_id: string;
    amount: string;
    payment_date: string;
    method: string;
    reference: string;
    notes: string;
  }>({
    id: null,
    kind: "PAYMENT",
    bank_account_id: "",
    amount: "",
    payment_date: new Date().toISOString().slice(0, 10),
    method: "EFT",
    reference: "",
    notes: "",
  });

  // Filtered anomalies
  const filteredAnomalies = useMemo(() => {
    return anomalies.filter((a: TaxAnomaly) => {
      if (severityFilter !== "all" && a.severity !== severityFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return a.code.toLowerCase().includes(q) || a.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [anomalies, severityFilter, statusFilter, searchQuery]);

  const showToast = (message: string, type: "success" | "error" | "info") => setToast({ message, type });

  useEffect(() => {
    if (!selectedPeriod) return;
    const params = new URLSearchParams(location.search);
    params.set("period", selectedPeriod);
    if (severityFilter !== "all") {
      params.set("severity", severityFilter);
    } else {
      params.delete("severity");
    }
    navigate(
      { pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : "" },
      { replace: true }
    );
  }, [location.pathname, location.search, navigate, selectedPeriod, severityFilter]);

  const handleRefresh = async () => {
    if (!selectedPeriod) return;
    setRefreshing(true);
    try {
      await refresh(selectedPeriod);
      showToast("Tax data refreshed from ledger", "success");
    } catch (e: any) {
      showToast(e.message || "Refresh failed", "error");
    } finally {
      setRefreshing(false);
    }
  };

  const handleEnrich = async () => {
    if (!selectedPeriod) return;
    setEnriching(true);
    try {
      await llmEnrich(selectedPeriod);
      showToast("AI analysis generated", "success");
    } catch (e: any) {
      showToast(e.message || "AI analysis failed", "error");
    } finally {
      setEnriching(false);
    }
  };

  const handleStatusUpdate = async (nextStatus: string) => {
    if (!selectedPeriod) return;
    try {
      await updatePeriodStatus(selectedPeriod, nextStatus);
      showToast(`Period marked as ${nextStatus}`, "success");
    } catch (e: any) {
      showToast(e.message || "Status update failed", "error");
    }
  };

  const handleAnomalyResolve = async (anomalyId: string) => {
    if (!selectedPeriod) return;
    try {
      await updateAnomalyStatus(selectedPeriod, anomalyId, "RESOLVED", statusFilter);
      showToast("Anomaly marked as resolved", "success");
    } catch (e: any) {
      showToast(e.message || "Failed to update anomaly", "error");
    }
  };

  const handleResetPeriod = async () => {
    if (!selectedPeriod) return;
    setResetting(true);
    try {
      await resetPeriod(selectedPeriod, resetReason);
      setResetOpen(false);
      setResetReason("");
      showToast("Return reset to REVIEWED. Refresh is now enabled.", "success");
    } catch (e: any) {
      showToast(e.message || "Failed to reset period", "error");
    } finally {
      setResetting(false);
    }
  };

  const beginEditPayment = (p: TaxPayment) => {
    setPaymentForm({
      id: p.id,
      kind: p.kind || "PAYMENT",
      bank_account_id: p.bank_account_id ? String(p.bank_account_id) : (bankAccounts[0]?.id ?? ""),
      amount: String(p.amount ?? ""),
      payment_date: (p.payment_date || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
      method: p.method || "EFT",
      reference: p.reference || "",
      notes: p.notes || "",
    });
  };

  const clearPaymentForm = () => {
    setPaymentForm({
      id: null,
      kind: netTax < 0 ? "REFUND" : "PAYMENT",
      bank_account_id: paymentForm.bank_account_id || (bankAccounts[0]?.id ?? ""),
      amount: "",
      payment_date: new Date().toISOString().slice(0, 10),
      method: "EFT",
      reference: "",
      notes: "",
    });
  };

  const savePayment = async () => {
    if (!selectedPeriod) return;
    setPaymentSaving(true);
    try {
      if (!paymentForm.amount.trim()) throw new Error("Amount is required.");
      if (!paymentForm.payment_date) throw new Error("Payment date is required.");
      if (!paymentForm.bank_account_id) throw new Error("Bank account is required.");
      const payload = {
        kind: paymentForm.kind,
        bank_account_id: paymentForm.bank_account_id,
        amount: paymentForm.amount,
        payment_date: paymentForm.payment_date,
        method: paymentForm.method,
        reference: paymentForm.reference,
        notes: paymentForm.notes,
      };
      if (paymentForm.id) {
        await updatePayment(selectedPeriod, paymentForm.id, payload);
        showToast("Payment updated", "success");
      } else {
        await createPayment(selectedPeriod, payload);
        showToast("Payment recorded", "success");
      }
      clearPaymentForm();
    } catch (e: any) {
      showToast(e.message || "Failed to save payment", "error");
    } finally {
      setPaymentSaving(false);
    }
  };

  const removePayment = async (paymentId: string) => {
    if (!selectedPeriod) return;
    if (!confirm("Delete this payment record?")) return;
    setPaymentSaving(true);
    try {
      await deletePayment(selectedPeriod, paymentId);
      showToast("Payment deleted", "success");
      if (paymentForm.id === paymentId) clearPaymentForm();
    } catch (e: any) {
      showToast(e.message || "Failed to delete payment", "error");
    } finally {
      setPaymentSaving(false);
    }
  };

  // Compute net tax from snapshot
  const netTax = useMemo(() => {
    if (!snapshot) return 0;
    if (snapshot.net_tax !== undefined && snapshot.net_tax !== null) return snapshot.net_tax;
    if (!snapshot.summary_by_jurisdiction) return 0;
    return Object.values(snapshot.summary_by_jurisdiction).reduce((sum: number, j: any) => sum + (j.net_tax || 0), 0);
  }, [snapshot]);

  useEffect(() => {
    if (paymentForm.id) return;
    const desired: TaxPaymentKind = netTax < 0 ? "REFUND" : "PAYMENT";
    if (paymentForm.kind !== desired) setPaymentForm((f) => ({ ...f, kind: desired }));
  }, [netTax, paymentForm.id, paymentForm.kind]);

  useEffect(() => {
    if (paymentForm.bank_account_id) return;
    if (!bankAccounts || bankAccounts.length === 0) return;
    setPaymentForm((f) => ({ ...f, bank_account_id: bankAccounts[0].id }));
  }, [bankAccounts, paymentForm.bank_account_id]);

  const currency = snapshot?.country === "US" ? "USD" : "CAD";
  const payments: TaxPayment[] = (snapshot?.payments as any) || [];
  const paymentsTotal = snapshot?.payments_total ?? snapshot?.payments_net_total ?? 0;
  const paymentsPaymentTotal = snapshot?.payments_payment_total ?? 0;
  const paymentsRefundTotal = snapshot?.payments_refund_total ?? 0;
  const paymentStatus: PaymentStatus | null = (snapshot?.payment_status as any) || null;
  const balance = snapshot?.balance ?? ((netTax || 0) - (paymentsTotal || 0));
  const remainingBalance = snapshot?.remaining_balance ?? balance;
  const dueBadge = useMemo(() => {
    if (snapshot?.is_overdue) return { text: `Overdue`, className: "text-rose-600" };
    if (snapshot?.is_due_soon) return { text: `Due soon`, className: "text-amber-600" };
    return { text: "On track", className: "text-emerald-600" };
  }, [snapshot]);

  // Format due date
  const dueDate = useMemo(() => {
    if (!snapshot?.due_date) return null;
    try {
      return new Date(snapshot.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return snapshot.due_date;
    }
  }, [snapshot]);

  const trendPeriods = useMemo(() => {
    const sorted = [...periods].sort((a, b) => periodSortKey(a.period_key) - periodSortKey(b.period_key));
    return sorted.slice(Math.max(0, sorted.length - 12));
  }, [periods]);

  if (loading && !snapshot) {
    return (
      <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-500 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Loading Tax Guardian...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#09090B] p-8">
        <div className="max-w-xl mx-auto p-6 bg-[#131316] border border-red-500/20 rounded-[24px] shadow-2xl">
          <AlertTriangle className="h-6 w-6 mb-3 text-red-500" />
          <p className="font-semibold text-white">Error loading Tax Guardian</p>
          <p className="text-sm mt-1 text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090B] font-sans text-white p-4 md:p-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {resetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-[24px] bg-[#131316] border border-white/5 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">Reset filed return?</h2>
                <p className="mt-1 text-xs text-gray-400">
                  This will reopen the period for changes. It does not delete transactions, but it clears the FILED lock.
                </p>
              </div>
              <button onClick={() => setResetOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-6">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Reason (optional)</label>
              <input value={resetReason} onChange={(e) => setResetReason(e.target.value)} placeholder="e.g., Filing was premature; adjusting rates" className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-[#18181B] px-3 text-sm text-white focus:outline-none focus:border-[#8B5CF6]/50" />
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button onClick={() => setResetOpen(false)} className="rounded-xl border border-white/5 bg-[#18181B] px-4 py-2.5 text-xs font-semibold text-gray-300 hover:text-white">Cancel</button>
              <button onClick={handleResetPeriod} disabled={resetting} className="rounded-xl bg-[#F87171]/10 border border-[#F87171]/20 px-4 py-2.5 text-xs font-semibold text-[#F87171] hover:bg-[#F87171]/20 disabled:opacity-50">
                {resetting ? "Resetting..." : "Reset return"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1360px] rounded-[28px] bg-[#131316] border border-white/5 p-5 shadow-2xl">
        <TopBar userName={userName} unread={filteredAnomalies.length} onExport={() => { }} />

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_1fr_1fr_1.08fr]">
          <PromoCard onEnrich={handleEnrich} isEnriching={enriching} summary={snapshot?.llm_summary} />
          <StatCard title="Tax Liability" value={formatCurrency(netTax, currency)} change={dueBadge.text} positive={!snapshot?.is_overdue} sub={`Period: ${selectedPeriod || 'Current'}`} />
          <StatCard title="Total Payments" value={formatCurrency(paymentsTotal, currency)} change="View history" positive={true} sub="Payments applied to period" />
          <StatCard title="Remaining Balance" value={formatCurrency(remainingBalance, currency)} change={paymentStatusLabel(paymentStatus)} positive={remainingBalance <= 0} sub="Outstanding amount" />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_1.35fr_0.9fr]">
          <TransactionCard trendPeriods={trendPeriods} />
          <SalesCard summary={snapshot?.summary_by_jurisdiction} />
          <ScheduleCard anomalies={filteredAnomalies} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_1.35fr_0.9fr]">
          <OrdersHeatmapCard />
          <ProductStatsCard trendPeriods={trendPeriods} />

          <div className="rounded-[24px] bg-transparent flex flex-col justify-end gap-3">
            <div className="rounded-[24px] bg-[#18181B] border border-white/5 p-6 shadow-sm flex flex-col justify-center items-center text-center h-[230px]">
              <div className="h-12 w-12 rounded-full bg-[#131316] border border-white/10 flex items-center justify-center mb-3">
                <ShieldCheck className="h-6 w-6 text-[#A3E635]" />
              </div>
              <h3 className="text-white font-semibold text-lg mb-1">Ready to File?</h3>
              <p className="text-gray-400 text-xs mb-5">Once anomalies are resolved, lock {selectedPeriod} period.</p>
              <div className="w-full flex gap-3">
                <button onClick={() => handleStatusUpdate("REVIEWED")} disabled={snapshot?.status !== "DRAFT"} className="flex-1 bg-[#27272A] hover:bg-[#3f3f46] text-white py-2.5 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50">Review</button>
                <button onClick={() => handleStatusUpdate("FILED")} disabled={snapshot?.status === "FILED"} className="flex-1 bg-[#A3E635] hover:bg-[#bef264] text-black py-2.5 rounded-xl text-xs font-semibold transition-colors shadow-[0_0_15px_rgba(163,230,53,0.2)] disabled:opacity-50 disabled:shadow-none">File Return</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

};

// Helper for greeting
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 18) return "Afternoon";
  return "Evening";
}

// -----------------------------------------------------------------------------
// New Dashboard Layout Components
// -----------------------------------------------------------------------------

function TopBar({ userName, unread, onExport }: any) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between px-2 mb-2">
      <div>
        <h1 className="text-[34px] font-semibold tracking-[-0.03em] text-white">Welcome Back, {userName}</h1>
        <p className="mt-1 text-sm text-gray-400">You have <span className="font-medium text-[#A3E635]">{unread} unread</span> tax anomalies</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-11 min-w-[250px] items-center gap-2 rounded-full bg-[#18181B] border border-white/5 px-4 shadow-sm focus-within:border-[#8B5CF6]/50 transition-colors">
          <Search className="h-4 w-4 text-gray-500" />
          <input
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-600"
            placeholder="Search periods..."
            defaultValue=""
          />
          <span className="text-xs text-gray-600">⌘ K</span>
        </div>

        <button className="flex h-11 items-center gap-2 rounded-full bg-[#18181B] border border-white/5 px-4 text-sm text-gray-300 hover:text-white hover:bg-[#27272A] shadow-sm transition-colors">
          Date
          <ChevronDown className="h-4 w-4" />
        </button>

        <button onClick={onExport} className="flex h-11 items-center gap-2 rounded-full bg-[#18181B] border border-white/5 px-4 text-sm font-medium text-white shadow-sm hover:bg-[#27272A] transition-colors">
          Export Return
          <Download className="h-4 w-4 text-gray-400" />
        </button>

        <button className="grid h-11 w-11 place-items-center rounded-full bg-[#18181B] border border-white/5 text-gray-400 shadow-sm hover:text-white hover:bg-[#27272A] transition-colors">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

function PromoCard({ onEnrich, isEnriching, summary }: any) {
  return (
    <div className="relative overflow-hidden rounded-[24px] bg-[#18181B] p-6 shadow-sm ring-1 ring-white/5 border border-white/5 flex flex-col justify-between" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(24,24,27,1) 50%, rgba(163,230,53,0.05) 100%)' }}>
      <div className="absolute right-0 top-0 h-full w-2/3 rounded-l-[80px] bg-[radial-gradient(circle_at_20%_40%,rgba(139,92,246,0.1),transparent_40%),radial-gradient(circle_at_80%_60%,rgba(163,230,53,0.1),transparent_40%)] pointer-events-none" />
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-[#A3E635]" />
          <span className="text-xs font-bold uppercase tracking-widest text-[#A3E635]">Companion AI</span>
        </div>
        <p className="text-[24px] font-semibold leading-[1.1] tracking-[-0.03em] text-white">
          {summary ? "Analysis Ready" : "Tax Audit Analysis"}
        </p>
        <p className="mt-2 text-xs text-gray-400 max-w-[200px] line-clamp-2 leading-relaxed">
          {summary || "Run an instant compliance check on your liabilities, anomalies, and jurisdiction exposure."}
        </p>
      </div>
      <button onClick={onEnrich} disabled={isEnriching} className="relative z-10 mt-5 w-max rounded-full bg-white px-5 py-2.5 text-xs font-bold text-black shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-all hover:bg-gray-100 disabled:opacity-50">
        {isEnriching ? "Analyzing..." : summary ? "Refresh Audit" : "Run AI Audit"}
      </button>
    </div>
  )
}

function StatCard({ title, value, change, positive, sub }: any) {
  return (
    <div className="rounded-[24px] bg-[#18181B] p-6 shadow-sm ring-1 ring-white/5 border border-white/5 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3 mb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{title}</p>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${positive ? 'bg-[#A3E635]/10 text-[#A3E635] border border-[#A3E635]/20' : 'bg-[#F87171]/10 text-[#F87171] border border-[#F87171]/20'}`}>
            {change}
          </span>
        </div>
        <p className="text-[34px] font-semibold tracking-[-0.04em] text-white font-mono">{value}</p>
      </div>
      <p className="mt-4 text-xs font-medium text-gray-500">{sub}</p>
    </div>
  )
}

function TransactionCard({ trendPeriods }: any) {
  const width = 360; const height = 150;
  const maxVal = trendPeriods?.length ? Math.max(10, ...trendPeriods.map((p: any) => Math.max(Number(p.net_tax) || 0, Number(p.payments_total) || 0))) : 100;
  const maxY = Math.ceil(maxVal / 100) * 100;

  const makePath = (key: string) => {
    if (!trendPeriods || trendPeriods.length === 0) return "";
    return trendPeriods.map((p: any, i: number) => {
      const v = Number(p[key]) || 0;
      const x = (i / Math.max(1, trendPeriods.length - 1)) * (width - 30) + 15;
      const y = height - (v / maxY) * (height - 30) - 15;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  return (
    <div className="rounded-[24px] bg-[#18181B] p-6 shadow-sm border border-white/5 flex flex-col justify-between">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">Tax Activity</h3>
          <button className="text-sm text-gray-500 hover:text-white">Trend ▾</button>
        </div>

        <div className="flex gap-4 text-xs font-medium text-gray-400">
          <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#8B5CF6] shadow-[0_0_8px_rgba(139,92,246,0.6)]" />Net Liability</span>
          <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#A3E635] shadow-[0_0_8px_rgba(163,230,53,0.6)]" />Total Paid</span>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-[20px] bg-[#131316] p-4 border border-white/[0.03] flex-1 min-h-[170px]">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible">
          {[0, 25, 50, 75, 100].map((tickPct) => {
            const y = height - (tickPct / 100) * (height - 30) - 15;
            const tickVal = (maxY * (tickPct / 100)).toFixed(0);
            return (
              <g key={tickPct}>
                <line x1="10" x2={width - 10} y1={y} y2={y} stroke="#ffffff" strokeOpacity="0.05" strokeWidth="1" strokeDasharray="3 3" />
                <text x="-5" y={y + 3} fontSize="9" fill="#52525b" textAnchor="end" className="font-mono">{tickVal}</text>
              </g>
            )
          })}
          {trendPeriods?.length > 0 && (
            <>
              <path d={makePath('net_tax')} fill="none" stroke="#8B5CF6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <path d={makePath('payments_total')} fill="none" stroke="#A3E635" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}
        </svg>
      </div>
    </div>
  )
}

function SalesCard({ summary }: any) {
  const jurisdictions = Object.entries(summary || {});
  let bars = jurisdictions.map(([code, data]: any) => ({ code, net: data.net_tax || 0 }));
  if (bars.length < 5) {
    const dummy = [42, 56, 32, 72, 28, 64, 49];
    while (bars.length < 5) bars.push({ code: `J${bars.length + 1}`, net: dummy[bars.length] });
  }
  const maxH = Math.max(1, ...bars.map(b => b.net));

  return (
    <div className="rounded-[24px] bg-[#18181B] p-6 shadow-sm border border-white/5 flex flex-col justify-between">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">Jurisdictions</h3>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-[28px] font-semibold tracking-[-0.04em] text-white leading-none">{jurisdictions.length}</span>
              <span className="rounded-full bg-[#8B5CF6]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#8B5CF6]">Active</span>
            </div>
          </div>
          <button className="text-sm text-gray-500 hover:text-white">All ▾</button>
        </div>
      </div>

      <div className="mt-5 flex h-[200px] items-end gap-3 rounded-[20px] bg-[#131316] px-4 py-5 border border-white/[0.03]">
        {bars.slice(0, 8).map((b, idx) => (
          <div key={idx} className="flex flex-1 flex-col items-center justify-end gap-3 group relative cursor-pointer">
            <div
              className="w-full rounded-t-[8px] transition-all bg-[#8B5CF6]/80 group-hover:bg-[#a78bfa] group-hover:shadow-[0_0_15px_rgba(139,92,246,0.3)]"
              style={{ height: `${Math.max(5, (b.net / maxH) * 150)}px` }}
            />
            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">{b.code}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ScheduleCard({ anomalies }: any) {
  const items = anomalies?.slice(0, 4) || [];
  return (
    <div className="rounded-[24px] bg-[#18181B] p-6 shadow-sm border border-white/5 flex flex-col min-h-[350px]">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">Anomalies</h3>
        <button className="text-sm font-medium text-gray-500 hover:text-white">See All</button>
      </div>

      <div className="mt-5 flex gap-5 border-b border-white/5 pb-3 text-sm">
        <button className="font-semibold text-white shadow-[0_2px_0_#A3E635]">Review Required</button>
        <button className="font-medium text-gray-500 hover:text-gray-300 transition-colors">Resolved</button>
      </div>

      <div className="mt-5 space-y-3 flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {items.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-500 flex-col gap-2">
            <ShieldCheck className="h-8 w-8 text-[#A3E635]/50" />
            <p>100% Compliant. No anomalies.</p>
          </div>
        ) : items.map((a: any, idx: number) => (
          <div key={idx} className="rounded-[18px] border border-white/5 bg-[#131316] p-4 transition hover:border-[#8B5CF6]/30 hover:bg-[#18181B] group">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${a.severity === 'high' ? 'bg-[#F87171]/10 text-[#F87171] border border-[#F87171]/20' : a.severity === 'medium' ? 'bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20' : 'bg-[#A3E635]/10 text-[#A3E635] border border-[#A3E635]/20'}`}>
              {a.severity} Priority
            </span>
            <h4 className="mt-3 text-sm font-semibold text-white truncate">{a.code}</h4>
            <p className="mt-1.5 text-xs text-gray-400 line-clamp-2 leading-relaxed">{a.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function OrdersHeatmapCard() {
  const rows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const heatmap = Array.from({ length: 5 }, () => Array.from({ length: 18 }, () => Math.random() > 0.8 ? 3 : Math.random() > 0.5 ? 2 : Math.random() > 0.3 ? 1 : 0));

  return (
    <div className="rounded-[24px] bg-[#18181B] p-6 shadow-sm border border-white/5 flex flex-col justify-between">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">Exception Heatmap</h3>
          <div className="mt-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
            <span className="h-2 w-2 rounded-sm bg-[#27272A]" />
            <span className="h-2 w-2 rounded-sm bg-[#8B5CF6]/40" />
            <span className="h-2 w-2 rounded-sm bg-[#8B5CF6]" />
            <span className="ml-1">Intensity</span>
          </div>
        </div>
        <button className="text-sm font-medium text-gray-500 hover:text-white">Q1 2025 ▾</button>
      </div>

      <div className="grid grid-cols-[30px_1fr] gap-3 mt-4">
        <div className="grid grid-rows-5 gap-2 pt-1 text-[10px] font-bold uppercase tracking-widest text-gray-600">
          {rows.map((label, i) => <span key={i} className="flex items-center">{label}</span>)}
        </div>
        <div className="space-y-2">
          {heatmap.map((row, r) => (
            <div key={r} className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(18, minmax(0, 1fr))" }}>
              {row.map((cell, c) => (
                <div
                  key={`${r}-${c}`}
                  className={`aspect-square rounded-[4px] transition-transform hover:scale-125 hover:z-10 ${cell === 3 ? 'bg-[#8B5CF6] shadow-[0_0_10px_rgba(139,92,246,0.5)]' : cell === 2 ? 'bg-[#8B5CF6]/60' : cell === 1 ? 'bg-[#8B5CF6]/20' : 'bg-[#27272A]'}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ProductStatsCard({ trendPeriods }: any) {
  let bars = trendPeriods?.slice(-12).map((p: any) => ({
    taxable: Number(p.net_tax) * 1.5,
    nontaxable: Number(p.net_tax) * 0.4
  })) || [];
  if (bars.length < 12) {
    const d = [28, 52, 24, 39, 20, 33, 18, 31, 14, 54, 19, 44];
    bars = d.map(v => ({ taxable: v * 1.5, nontaxable: v * 0.5 }));
  }
  const maxH = Math.max(1, ...bars.map((b: any) => b.taxable + b.nontaxable));

  return (
    <div className="rounded-[24px] bg-[#18181B] p-6 shadow-sm border border-white/5 flex flex-col justify-between">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold tracking-[-0.03em] text-white">Taxable Scope</h3>
          <button className="text-sm font-medium text-gray-500 hover:text-white">Last Year ▾</button>
        </div>
        <div className="flex gap-4 text-xs font-medium text-gray-400">
          <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-sm bg-[#38BDF8]" />Taxable</span>
          <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-sm bg-[#0C4A6E]" />Exempt</span>
        </div>
      </div>

      <div className="mt-5 flex h-[190px] items-end gap-3 rounded-[20px] bg-[#131316] px-4 py-5 border border-white/[0.03]">
        {bars.map((b: any, idx: number) => {
          const th = (b.taxable / maxH) * 150;
          const nh = (b.nontaxable / maxH) * 150;
          return (
            <div key={idx} className="flex flex-1 flex-col items-center justify-end gap-2 group cursor-pointer relative">
              <div className="relative flex w-full flex-col items-center justify-end gap-[3px]">
                <div className="w-full max-w-[12px] rounded-[3px] bg-[#38BDF8] transition-all group-hover:brightness-110 shadow-[0_0_8px_rgba(56,189,248,0.2)]" style={{ height: `${Math.max(4, th)}px` }} />
                <div className="w-full max-w-[12px] rounded-[3px] bg-[#0C4A6E] transition-all group-hover:bg-[#0EA5E9]" style={{ height: `${Math.max(4, nh)}px` }} />
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-600 mt-1 opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-4">Q{idx % 4 + 1}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TaxGuardianPage;
